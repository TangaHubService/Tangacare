import { AppDataSource } from '../../config/database';
import { InventoryNotificationService } from './inventory-notification.service';
import { MoreThan, LessThan } from 'typeorm';
import { Stock } from '../../entities/Stock.entity';
import { Facility } from '../../entities/Facility.entity';
import { Medicine } from '../../entities/Medicine.entity';

export class AlertService {
    private inventoryNotificationService: InventoryNotificationService;
    private stockRepository = AppDataSource.getRepository(Stock);
    private facilityRepository = AppDataSource.getRepository(Facility);
    private medicineRepository = AppDataSource.getRepository(Medicine);
    private alertRepository = AppDataSource.getRepository(require('../../entities/Alert.entity').Alert);

    constructor() {
        this.inventoryNotificationService = new InventoryNotificationService();
    }

    private async syncAlerts(
        facilityId: number,
        organizationId: number,
        type: import('../../entities/Alert.entity').AlertType,
        alerts: Array<{
            medicine_id?: number;
            batch_id?: number;
            title: string;
            message: string;
            current_value: number;
            threshold_value: number;
            severity: string;
        }>,
        medicineIdScoping?: number,
    ): Promise<number[]> {
        const AlertStatus = require('../../entities/Alert.entity').AlertStatus;
        const newOrUpdatedAlertIds: number[] = [];

        // Get existing active alerts of this type for the facility
        const where: any = {
            facility_id: facilityId,
            organization_id: organizationId,
            alert_type: type,
            status: AlertStatus.ACTIVE,
        };

        if (medicineIdScoping) {
            where.medicine_id = medicineIdScoping;
        }

        const existingAlerts = await this.alertRepository.find({ where });

        for (const alertData of alerts) {
            const existing = existingAlerts.find(
                (a: any) => a.medicine_id === alertData.medicine_id && a.batch_id === alertData.batch_id,
            );

            if (!existing) {
                const newAlert = this.alertRepository.create({
                    ...alertData,
                    facility_id: facilityId,
                    organization_id: organizationId,
                    alert_type: type,
                    status: AlertStatus.ACTIVE,
                });
                const saved = await this.alertRepository.save(newAlert);
                newOrUpdatedAlertIds.push(saved.id);
            } else {
                // Update existing alert with latest info
                existing.message = alertData.message;
                existing.current_value = alertData.current_value;
                existing.threshold_value = alertData.threshold_value;
                existing.title = alertData.title;
                existing.severity = alertData.severity;
                await this.alertRepository.save(existing);

                // Check if we should notify (Throttling: 24h)
                if (this.shouldNotify(existing)) {
                    newOrUpdatedAlertIds.push(existing.id);
                }
            }
        }

        // Auto-resolve: if an active alert is NOT in the current list, it's resolved
        for (const existing of existingAlerts) {
            const stillRelevant = alerts.find(
                (a) => a.medicine_id === existing.medicine_id && a.batch_id === existing.batch_id,
            );
            if (!stillRelevant) {
                existing.status = AlertStatus.RESOLVED;
                existing.resolved_at = new Date();
                await this.alertRepository.save(existing);
            }
        }

        return newOrUpdatedAlertIds;
    }

    private shouldNotify(alert: any): boolean {
        if (!alert.last_notified_at) return true;
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return alert.last_notified_at < oneDayAgo;
    }

    private calculateSeverity(current: number, threshold: number): string {
        if (current <= 0) return 'out_of_stock';
        const percent = (current / threshold) * 100;
        if (percent <= 25) return 'critical';
        if (percent <= 50) return 'warning';
        return 'info';
    }

    async checkLowStock(facilityId: number, organizationId: number, medicineId?: number) {
        const AlertType = require('../../entities/Alert.entity').AlertType;
        const MedicineFacilitySetting =
            require('../../entities/MedicineFacilitySetting.entity').MedicineFacilitySetting;

        const settingsRepo = AppDataSource.getRepository(MedicineFacilitySetting);

        // Get total stock levels for the facility (optionally filtered by medicine)
        const query = this.stockRepository
            .createQueryBuilder('stock')
            .select('stock.medicine_id', 'medicine_id')
            .addSelect('SUM(stock.quantity)', 'total_quantity')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .groupBy('stock.medicine_id');

        if (medicineId) {
            query.andWhere('stock.medicine_id = :medicineId', { medicineId });
        }

        const stockLevels = await query.getRawMany();
        const alertsToSync = [];

        for (const stock of stockLevels) {
            const mid = parseInt(stock.medicine_id);
            const totalQuantity = parseFloat(stock.total_quantity);

            // Find threshold: Override -> Global -> fallback 0
            const setting = await settingsRepo.findOne({
                where: { facility_id: facilityId, medicine_id: mid },
            });
            const medicine = await this.medicineRepository.findOne({
                where: { id: mid, organization_id: organizationId },
            });

            if (!medicine) continue;

            const threshold = setting?.min_stock_level ?? medicine.min_stock_level ?? 0;

            if (threshold > 0 && totalQuantity < threshold) {
                const severity = this.calculateSeverity(totalQuantity, threshold);
                alertsToSync.push({
                    medicine_id: mid,
                    title: totalQuantity === 0 ? 'OUT OF STOCK' : 'Low Stock Alert',
                    message: `Medicine ${medicine.name} is ${totalQuantity === 0 ? 'out of stock' : 'running low'}. Current: ${totalQuantity}, Min: ${threshold}.`,
                    current_value: totalQuantity,
                    threshold_value: threshold,
                    severity,
                });
            }
        }

        // Handle 0 stock case if checking specific medicine and not found in stockLevels
        const isTargetInResults = stockLevels.some((s: any) => parseInt(s.medicine_id) === medicineId);
        if (medicineId && !isTargetInResults) {
            const medicine = await this.medicineRepository.findOne({
                where: { id: medicineId, organization_id: organizationId },
            });
            if (medicine) {
                const setting = await settingsRepo.findOne({
                    where: { facility_id: facilityId, medicine_id: medicineId },
                });
                const threshold = setting?.min_stock_level ?? medicine.min_stock_level ?? 0;
                if (threshold > 0) {
                    alertsToSync.push({
                        medicine_id: medicineId,
                        title: 'OUT OF STOCK',
                        message: `Medicine ${medicine.name} is out of stock. Current: 0, Min: ${threshold}.`,
                        current_value: 0,
                        threshold_value: threshold,
                        severity: 'out_of_stock',
                    });
                }
            }
        }

        const alertedIds = await this.syncAlerts(facilityId, organizationId, AlertType.LOW_STOCK, alertsToSync, medicineId);

        // Notify for new or un-throttled alerts
        for (const alertId of alertedIds) {
            const alert = await this.alertRepository.findOne({
                where: { id: alertId, organization_id: organizationId },
                relations: ['medicine'],
            });
            if (alert) {
                await this.inventoryNotificationService
                    .notifyLowStock(facilityId, alert.medicine.name, alert.current_value!, alert.threshold_value!)
                    .then(async () => {
                        alert.last_notified_at = new Date();
                        await this.alertRepository.save(alert);
                    })
                    .catch((err) => console.error('Failed to send low stock notification:', err));
            }
        }
    }

    async checkExpiries(facilityId: number, organizationId: number) {
        const AlertType = require('../../entities/Alert.entity').AlertType;
        const today = new Date();

        const facility = await this.facilityRepository.findOne({
            where: { id: facilityId, organization_id: organizationId },
        });
        const criticalDays = facility?.expiry_critical_days || 30;
        const warningDays = facility?.expiry_warning_days || 60;
        const infoDays = facility?.expiry_alert_days || 90;

        const maxThreshold = new Date();
        maxThreshold.setDate(maxThreshold.getDate() + infoDays);

        const allRelevantStocks = await this.stockRepository.find({
            where: {
                facility_id: facilityId,
                organization_id: organizationId,
                quantity: MoreThan(0),
                batch: {
                    expiry_date: LessThan(maxThreshold),
                    organization_id: organizationId,
                },
            },
            relations: ['medicine', 'batch'],
        });

        const alertsToSync = allRelevantStocks.map((stock) => {
            const expiryDate = new Date(stock.batch.expiry_date);
            const isExpired = expiryDate < today;
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let type = AlertType.EXPIRY_SOON;
            let title = 'Item Expiring Soon';
            let severity = 'info';

            if (isExpired) {
                type = AlertType.EXPIRED;
                title = 'Item Expired';
                severity = 'critical';
            } else if (daysUntilExpiry < criticalDays) {
                severity = 'critical';
                title = 'Item Expiring Soon (Critical)';
            } else if (daysUntilExpiry < warningDays) {
                severity = 'warning';
                title = 'Item Expiring Soon (Warning)';
            } else {
                severity = 'info';
                title = 'Item Expiring Soon (Info)';
            }

            return {
                medicine_id: stock.medicine.id,
                batch_id: stock.batch.id,
                title: title,
                message: `Batch ${stock.batch.batch_number} of ${stock.medicine.name} ${isExpired ? 'expired' : 'expires'} on ${expiryDate.toLocaleDateString()}${!isExpired ? ` (${daysUntilExpiry} days)` : ''}.`,
                current_value: stock.quantity,
                threshold_value: daysUntilExpiry,
                typeOverride: type,
                severity,
            };
        });

        const expiring = alertsToSync.filter((a) => a.typeOverride === AlertType.EXPIRY_SOON);
        const expired = alertsToSync.filter((a) => a.typeOverride === AlertType.EXPIRED);

        const alertedExpiringIds = await this.syncAlerts(
            facilityId,
            organizationId,
            AlertType.EXPIRY_SOON,
            expiring as any,
        );
        const alertedExpiredIds = await this.syncAlerts(facilityId, organizationId, AlertType.EXPIRED, expired as any);

        const allAlertedIds = [...alertedExpiringIds, ...alertedExpiredIds];

        for (const alertId of allAlertedIds) {
            const alert = await this.alertRepository.findOne({
                where: { id: alertId, organization_id: organizationId },
                relations: ['medicine', 'batch'],
            });
            if (alert) {
                await this.inventoryNotificationService
                    .notifyExpiry(
                        facilityId,
                        alert.medicine.name,
                        alert.batch.batch_number,
                        new Date(alert.batch.expiry_date),
                        alert.severity as any,
                    )
                    .then(async () => {
                        alert.last_notified_at = new Date();
                        await this.alertRepository.save(alert);
                    })
                    .catch((err) => console.error('Failed to send expiry notification:', err));
            }
        }
    }

    async runAllChecks(facilityId: number, organizationId: number) {
        await this.checkLowStock(facilityId, organizationId);
        await this.checkExpiries(facilityId, organizationId);
    }

    async getAlertStats(facilityId: number, organizationId: number): Promise<any> {
        const AlertStatus = require('../../entities/Alert.entity').AlertStatus;
        const AlertType = require('../../entities/Alert.entity').AlertType;

        const stats = await this.alertRepository
            .createQueryBuilder('alert')
            .select('alert.alert_type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('alert.facility_id = :facilityId', { facilityId })
            .andWhere('alert.organization_id = :organizationId', { organizationId })
            .andWhere('alert.status = :status', { status: AlertStatus.ACTIVE })
            .groupBy('alert.alert_type')
            .getRawMany();

        const result = {
            low_stock: 0,
            expiry_soon: 0,
            expired: 0,
            total: 0,
        };

        stats.forEach((s: any) => {
            if (s.type === AlertType.LOW_STOCK) result.low_stock = parseInt(s.count);
            if (s.type === AlertType.EXPIRY_SOON) result.expiry_soon = parseInt(s.count);
            if (s.type === AlertType.EXPIRED) result.expired = parseInt(s.count);
        });

        result.total = result.low_stock + result.expiry_soon + result.expired;

        return result;
    }

    // Get list of alerts with pagination and filtering
    async findAll(
        facilityId: number,
        organizationId: number,
        status?: string,
        type?: string,
        page: number = 1,
        limit: number = 50,
    ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
        const where: any = {
            facility_id: facilityId,
            organization_id: organizationId,
        };

        if (status) {
            where.status = status;
        }

        if (type) {
            where.alert_type = type;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await this.alertRepository.findAndCount({
            where,
            order: {
                created_at: 'DESC',
            },
            relations: ['medicine', 'batch'],
            skip,
            take: limit,
        });

        return { data, total, page, limit };
    }

    // New method to actually get the list of alerts
    async getAlerts(facilityId: number | undefined, organizationId: number, status?: string): Promise<any[]> {
        const where: any = {
            organization_id: organizationId,
        };

        if (facilityId) {
            where.facility_id = facilityId;
        }

        if (status) {
            where.status = status;
        }

        return this.alertRepository.find({
            where,
            order: {
                created_at: 'DESC',
            },
            relations: ['medicine', 'batch'],
        });
    }

    async getAlertStatsAggregated(organizationId: number): Promise<any> {
        const AlertStatus = require('../../entities/Alert.entity').AlertStatus;
        const AlertType = require('../../entities/Alert.entity').AlertType;

        const stats = await this.alertRepository
            .createQueryBuilder('alert')
            .select('alert.alert_type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('alert.organization_id = :organizationId', { organizationId })
            .andWhere('alert.status = :status', { status: AlertStatus.ACTIVE })
            .groupBy('alert.alert_type')
            .getRawMany();

        const result = {
            low_stock: 0,
            expiry_soon: 0,
            expired: 0,
            total: 0,
        };

        stats.forEach((s: any) => {
            if (s.type === AlertType.LOW_STOCK) result.low_stock = parseInt(s.count);
            if (s.type === AlertType.EXPIRY_SOON) result.expiry_soon = parseInt(s.count);
            if (s.type === AlertType.EXPIRED) result.expired = parseInt(s.count);
        });

        result.total = result.low_stock + result.expiry_soon + result.expired;

        return result;
    }
}
