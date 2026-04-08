import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Medicine } from '../../entities/Medicine.entity';
import { SaleStatus } from '../../entities/Sale.entity';
import { SaleItem } from '../../entities/Sale.entity';
import { InventoryNotificationService } from './inventory-notification.service';
import { Alert, AlertStatus, AlertType } from '../../entities/Alert.entity';
import { AlertService } from './alert.service';

export interface PredictiveReorderSuggestion {
    medicine_id: number;
    organization_id?: number;
    medicine_name: string;
    current_stock: number;
    min_stock_level: number;
    daily_usage_rate: number;
    days_until_stockout: number;
    suggested_order_quantity: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

export class PredictiveReorderService {
    private medicineRepository: Repository<Medicine>;
    private saleItemRepository: Repository<SaleItem>;
    private inventoryNotificationService: InventoryNotificationService;
    private alertRepository: Repository<Alert>;
    private alertService: AlertService;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.inventoryNotificationService = new InventoryNotificationService();
        this.alertRepository = AppDataSource.getRepository(Alert);
        this.alertService = new AlertService();
    }

    async generateReorderSuggestions(
        facilityId: number,
        lookbackDays: number = 30,
    ): Promise<PredictiveReorderSuggestion[]> {
        // Get all medicines with stock
        const medicines = await this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.stocks', 'stock')
            .where('stock.facility_id = :facilityId', { facilityId })
            .select([
                'medicine.id',
                'medicine.organization_id',
                'medicine.name',
                'medicine.min_stock_level',
                'medicine.reorder_point',
                'SUM(stock.quantity) as current_stock',
            ])
            .groupBy('medicine.id')
            .getRawMany();

        const suggestions: PredictiveReorderSuggestion[] = [];

        // Calculate usage rate for each medicine
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);

        for (const med of medicines) {
            const medicineId = med.medicine_id;
            const currentStock = Number(med.current_stock) || 0;
            const minStockLevel = med.medicine_min_stock_level || 0;

            // Get sales history
            const salesData = await this.saleItemRepository
                .createQueryBuilder('item')
                .leftJoin('item.sale', 'sale')
                .where('item.medicine_id = :medicineId', { medicineId })
                .andWhere('sale.facility_id = :facilityId', { facilityId })
                .andWhere('sale.created_at >= :startDate', { startDate })
                .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
                .select('SUM(item.quantity)', 'total_quantity')
                .getRawOne();

            const totalSold = Number(salesData?.total_quantity) || 0;
            const dailyUsageRate = totalSold / lookbackDays;

            // Calculate days until stockout
            const daysUntilStockout = dailyUsageRate > 0 ? currentStock / dailyUsageRate : 999;

            // Determine if reorder is needed
            if (currentStock <= minStockLevel || daysUntilStockout <= 14) {
                // Suggest ordering enough for 30 days + buffer
                const suggestedQuantity = Math.ceil(dailyUsageRate * 30 * 1.2); // 20% buffer

                let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
                if (currentStock === 0 || daysUntilStockout <= 3) priority = 'critical';
                else if (daysUntilStockout <= 7) priority = 'high';
                else if (daysUntilStockout <= 14) priority = 'medium';

                suggestions.push({
                    medicine_id: medicineId,
                    organization_id: Number(med.medicine_organization_id) || undefined,
                    medicine_name: med.medicine_name,
                    current_stock: currentStock,
                    min_stock_level: minStockLevel,
                    daily_usage_rate: Math.round(dailyUsageRate * 100) / 100,
                    days_until_stockout: Math.round(daysUntilStockout),
                    suggested_order_quantity: suggestedQuantity,
                    priority,
                });
            }
        }

        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedSuggestions = suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        const organizationIds = Array.from(
            new Set(medicines.map((medicine) => Number(medicine.medicine_organization_id)).filter(Boolean)),
        ) as number[];

        if (organizationIds.length > 0) {
            const existingAlerts = await this.alertRepository.find({
                where: organizationIds.map((organizationId) => ({
                    facility_id: facilityId,
                    organization_id: organizationId,
                    alert_type: AlertType.REORDER_SUGGESTION,
                    reference_type: 'predictive_reorder',
                    status: In([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
                })),
            });

            const activeMedicineIds = new Set(sortedSuggestions.map((suggestion) => suggestion.medicine_id));
            for (const alert of existingAlerts) {
                if (!activeMedicineIds.has(Number(alert.reference_id))) {
                    await this.alertService.resolveAlertByReference({
                        facilityId,
                        organizationId: alert.organization_id!,
                        type: AlertType.REORDER_SUGGESTION,
                        referenceType: 'predictive_reorder',
                        referenceId: Number(alert.reference_id),
                        actionTaken: 'Deferred',
                        actionReason: 'Predictive reorder condition cleared after stock or demand changed.',
                        note: 'Predictive reorder alert auto-resolved after recalculation',
                    });
                }
            }
        }

        if (sortedSuggestions.length > 0) {
            const alertsToNotify: Array<PredictiveReorderSuggestion & { alert_id?: number }> = [];

            for (const suggestion of sortedSuggestions) {
                if (!suggestion.organization_id) {
                    continue;
                }

                const severity =
                    suggestion.priority === 'critical'
                        ? 'critical'
                        : suggestion.priority === 'high' || suggestion.priority === 'medium'
                          ? 'warning'
                          : 'info';

                try {
                    const alert = await this.alertService.upsertOperationalAlert({
                        facilityId,
                        organizationId: suggestion.organization_id,
                        type: AlertType.REORDER_SUGGESTION,
                        referenceType: 'predictive_reorder',
                        referenceId: suggestion.medicine_id,
                        medicineId: suggestion.medicine_id,
                        title: `Reorder Suggestion: ${suggestion.medicine_name}`,
                        message: `${suggestion.medicine_name} is projected to stock out in ${Math.max(0, suggestion.days_until_stockout)} day(s). Suggested order quantity: ${suggestion.suggested_order_quantity}.`,
                        severity,
                        currentValue: suggestion.current_stock,
                        thresholdValue: suggestion.min_stock_level,
                        contextData: {
                            priority: suggestion.priority,
                            days_until_stockout: suggestion.days_until_stockout,
                            suggested_order_quantity: suggestion.suggested_order_quantity,
                            daily_usage_rate: suggestion.daily_usage_rate,
                        },
                    });

                    const oneDayAgo = new Date();
                    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                    const eligibleForNotification =
                        suggestion.priority === 'critical' &&
                        (!alert.last_notified_at || new Date(alert.last_notified_at) < oneDayAgo);

                    if (eligibleForNotification) {
                        alertsToNotify.push({
                            ...suggestion,
                            alert_id: alert.id,
                        });
                    }
                } catch (error) {
                    console.error(`Failed to upsert predictive reorder alert for medicine ${suggestion.medicine_id}:`, error);
                }
            }

            if (alertsToNotify.length > 0) {
                this.inventoryNotificationService
                    .notifyCriticalReorder(facilityId, alertsToNotify)
                    .then(async () => {
                        await Promise.all(
                            alertsToNotify
                                .filter((suggestion) => suggestion.alert_id)
                                .map((suggestion) =>
                                    this.alertService.markAlertNotified(suggestion.alert_id!, {
                                        source: 'predictive_reorder_notification',
                                        medicineId: suggestion.medicine_id,
                                    }),
                                ),
                        );
                    })
                    .catch((err: Error) => {
                        console.error('Failed to send predictive reorder notifications:', err);
                    });
            }
        }

        return sortedSuggestions;
    }
}
