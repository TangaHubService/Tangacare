import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Medicine } from '../../entities/Medicine.entity';
import { SaleStatus } from '../../entities/Sale.entity';
import { SaleItem } from '../../entities/Sale.entity';
import { InventoryNotificationService } from './inventory-notification.service';

export interface PredictiveReorderSuggestion {
    medicine_id: number;
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

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.inventoryNotificationService = new InventoryNotificationService();
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

        // Trigger notifications for critical items
        if (sortedSuggestions.length > 0) {
            this.inventoryNotificationService
                .notifyCriticalReorder(facilityId, sortedSuggestions)
                .catch((err: Error) => {
                    console.error('Failed to send predictive reorder notifications:', err);
                });
        }

        return sortedSuggestions;
    }
}
