import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Facility } from '../../entities/Facility.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { MedicineFacilitySetting } from '../../entities/MedicineFacilitySetting.entity';
import { Stock } from '../../entities/Stock.entity';
import { Alert, AlertStatus, AlertType } from '../../entities/Alert.entity';
import { AlertEvent, AlertEventType } from '../../entities/AlertEvent.entity';
import { InventoryNotificationService } from './inventory-notification.service';
import { eventBus, EventTypes } from '../../utils/eventBus';

interface AlertSyncCandidate {
    medicine_id?: number | null;
    batch_id?: number | null;
    reference_type?: string | null;
    reference_id?: number | null;
    title: string;
    message: string;
    current_value: number;
    threshold_value: number;
    severity: string;
    context_data?: Record<string, any> | null;
}

interface OperationalAlertInput {
    facilityId: number;
    organizationId: number;
    type: AlertType;
    title: string;
    message: string;
    severity: string;
    referenceType: string;
    referenceId: number;
    medicineId?: number | null;
    batchId?: number | null;
    currentValue?: number | null;
    thresholdValue?: number | null;
    contextData?: Record<string, any> | null;
}

interface AlertStatsResult {
    low_stock: number;
    expiry_soon: number;
    expired: number;
    controlled_drug_threshold: number;
    reorder_suggestion: number;
    batch_recall: number;
    stock_variance: number;
    cold_chain_excursion: number;
    total: number;
}

export class AlertService {
    private inventoryNotificationService: InventoryNotificationService;
    private stockRepository: Repository<Stock>;
    private facilityRepository: Repository<Facility>;
    private medicineRepository: Repository<Medicine>;
    private medicineFacilitySettingRepository: Repository<MedicineFacilitySetting>;
    private alertRepository: Repository<Alert>;
    private alertEventRepository: Repository<AlertEvent>;

    constructor() {
        this.inventoryNotificationService = new InventoryNotificationService();
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.facilityRepository = AppDataSource.getRepository(Facility);
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.medicineFacilitySettingRepository = AppDataSource.getRepository(MedicineFacilitySetting);
        this.alertRepository = AppDataSource.getRepository(Alert);
        this.alertEventRepository = AppDataSource.getRepository(AlertEvent);
    }

    private emitAlertRealtimeEvent(eventType: EventTypes, alert: Alert): void {
        eventBus.emit(eventType, {
            id: alert.id,
            facility_id: alert.facility_id,
            organization_id: alert.organization_id ?? null,
            type: alert.alert_type,
            status: alert.status,
            severity: alert.severity,
        });
    }

    private normalizeNumber(value?: number | null): number | null {
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }

    private normalizeText(value?: string | null): string | null {
        const normalized = String(value || '').trim();
        return normalized ? normalized : null;
    }

    private normalizeContextData(contextData?: Record<string, any> | null): Record<string, any> | null {
        return contextData ?? null;
    }

    private matchesAlert(existing: Alert, alertData: AlertSyncCandidate): boolean {
        const referenceType = this.normalizeText(alertData.reference_type);
        const referenceId = this.normalizeNumber(alertData.reference_id);

        if (referenceType || referenceId !== null) {
            return (
                this.normalizeText(existing.reference_type) === referenceType &&
                this.normalizeNumber(existing.reference_id) === referenceId
            );
        }

        return (
            this.normalizeNumber(existing.medicine_id) === this.normalizeNumber(alertData.medicine_id) &&
            this.normalizeNumber(existing.batch_id) === this.normalizeNumber(alertData.batch_id)
        );
    }

    private hasAlertChanged(existing: Alert, alertData: AlertSyncCandidate): boolean {
        return (
            this.normalizeNumber(existing.medicine_id) !== this.normalizeNumber(alertData.medicine_id) ||
            this.normalizeNumber(existing.batch_id) !== this.normalizeNumber(alertData.batch_id) ||
            this.normalizeText(existing.reference_type) !== this.normalizeText(alertData.reference_type) ||
            this.normalizeNumber(existing.reference_id) !== this.normalizeNumber(alertData.reference_id) ||
            existing.title !== alertData.title ||
            existing.message !== alertData.message ||
            this.normalizeNumber(existing.current_value) !== this.normalizeNumber(alertData.current_value) ||
            this.normalizeNumber(existing.threshold_value) !== this.normalizeNumber(alertData.threshold_value) ||
            existing.severity !== alertData.severity ||
            JSON.stringify(existing.context_data ?? null) !== JSON.stringify(alertData.context_data ?? null)
        );
    }

    async recordAlertEvent(
        alertId: number,
        eventType: AlertEventType,
        options?: {
            previousStatus?: AlertStatus | null;
            newStatus?: AlertStatus | null;
            actorUserId?: number | null;
            note?: string | null;
            payload?: Record<string, any> | null;
        },
    ): Promise<void> {
        const event = this.alertEventRepository.create({
            alert_id: alertId,
            event_type: eventType,
            previous_status: options?.previousStatus ?? null,
            new_status: options?.newStatus ?? null,
            actor_user_id: options?.actorUserId ?? null,
            note: options?.note ?? null,
            payload: options?.payload ?? null,
        });

        await this.alertEventRepository.save(event);
    }

    async markAlertNotified(
        alertId: number,
        payload?: Record<string, any> | null,
        note: string = 'Alert notification dispatched',
    ): Promise<Alert | null> {
        const alert = await this.alertRepository.findOne({ where: { id: alertId } });
        if (!alert) {
            return null;
        }

        alert.last_notified_at = new Date();
        const saved = await this.alertRepository.save(alert);
        await this.recordAlertEvent(saved.id, AlertEventType.NOTIFIED, {
            previousStatus: saved.status,
            newStatus: saved.status,
            note,
            payload: payload ?? null,
        });
        this.emitAlertRealtimeEvent(EventTypes.ALERT_UPDATED, saved);
        return saved;
    }

    private async syncAlerts(
        facilityId: number,
        organizationId: number,
        type: AlertType,
        alerts: AlertSyncCandidate[],
        medicineIdScoping?: number,
    ): Promise<number[]> {
        const newOrUpdatedAlertIds: number[] = [];

        const where: any = {
            facility_id: facilityId,
            organization_id: organizationId,
            alert_type: type,
            status: In([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
        };

        if (medicineIdScoping) {
            where.medicine_id = medicineIdScoping;
        }

        const existingAlerts = await this.alertRepository.find({ where });

        for (const alertData of alerts) {
            const existing = existingAlerts.find((candidate) => this.matchesAlert(candidate, alertData));

            if (!existing) {
                const created = this.alertRepository.create({
                    facility_id: facilityId,
                    organization_id: organizationId,
                    alert_type: type,
                    status: AlertStatus.ACTIVE,
                    medicine_id: this.normalizeNumber(alertData.medicine_id),
                    batch_id: this.normalizeNumber(alertData.batch_id),
                    reference_type: this.normalizeText(alertData.reference_type),
                    reference_id: this.normalizeNumber(alertData.reference_id),
                    title: alertData.title,
                    message: alertData.message,
                    current_value: this.normalizeNumber(alertData.current_value),
                    threshold_value: this.normalizeNumber(alertData.threshold_value),
                    severity: alertData.severity,
                    context_data: this.normalizeContextData(alertData.context_data),
                });

                const saved = await this.alertRepository.save(created);
                await this.recordAlertEvent(saved.id, AlertEventType.CREATED, {
                    previousStatus: null,
                    newStatus: saved.status,
                    note: 'Alert created from automated evaluation',
                    payload: {
                        alert_type: saved.alert_type,
                        reference_type: saved.reference_type,
                        reference_id: saved.reference_id,
                    },
                });
                this.emitAlertRealtimeEvent(EventTypes.ALERT_CREATED, saved);
                newOrUpdatedAlertIds.push(saved.id);
                continue;
            }

            const previousStatus = existing.status;
            const changed = this.hasAlertChanged(existing, alertData);

            if (!changed) {
                if (previousStatus === AlertStatus.ACTIVE && this.shouldNotify(existing)) {
                    newOrUpdatedAlertIds.push(existing.id);
                }
                continue;
            }

            existing.medicine_id = this.normalizeNumber(alertData.medicine_id);
            existing.batch_id = this.normalizeNumber(alertData.batch_id);
            existing.reference_type = this.normalizeText(alertData.reference_type);
            existing.reference_id = this.normalizeNumber(alertData.reference_id);
            existing.title = alertData.title;
            existing.message = alertData.message;
            existing.current_value = this.normalizeNumber(alertData.current_value);
            existing.threshold_value = this.normalizeNumber(alertData.threshold_value);
            existing.severity = alertData.severity;
            existing.context_data = this.normalizeContextData(alertData.context_data);

            const saved = await this.alertRepository.save(existing);
            await this.recordAlertEvent(saved.id, AlertEventType.UPDATED, {
                previousStatus,
                newStatus: saved.status,
                note: 'Alert refreshed from automated evaluation',
                payload: {
                    alert_type: saved.alert_type,
                    reference_type: saved.reference_type,
                    reference_id: saved.reference_id,
                },
            });
            this.emitAlertRealtimeEvent(EventTypes.ALERT_UPDATED, saved);

            if (previousStatus === AlertStatus.ACTIVE && this.shouldNotify(saved)) {
                newOrUpdatedAlertIds.push(saved.id);
            }
        }

        for (const existing of existingAlerts) {
            const stillRelevant = alerts.some((candidate) => this.matchesAlert(existing, candidate));
            if (stillRelevant) {
                continue;
            }

            const previousStatus = existing.status;
            existing.status = AlertStatus.RESOLVED;
            existing.resolved_at = new Date();
            const saved = await this.alertRepository.save(existing);
            await this.recordAlertEvent(saved.id, AlertEventType.RESOLVED, {
                previousStatus,
                newStatus: saved.status,
                note: 'Alert condition cleared automatically',
                payload: {
                    alert_type: saved.alert_type,
                    reference_type: saved.reference_type,
                    reference_id: saved.reference_id,
                },
            });
            this.emitAlertRealtimeEvent(EventTypes.ALERT_RESOLVED, saved);
        }

        return newOrUpdatedAlertIds;
    }

    async syncOperationalAlerts(
        facilityId: number,
        organizationId: number,
        type: AlertType,
        alerts: AlertSyncCandidate[],
    ): Promise<number[]> {
        return this.syncAlerts(facilityId, organizationId, type, alerts);
    }

    private shouldNotify(alert: Alert): boolean {
        if (!alert.last_notified_at) return true;
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return alert.last_notified_at < oneDayAgo;
    }

    private calculateSeverity(current: number, threshold: number): string {
        if (current <= 0) return 'out_of_stock';
        const percent = threshold > 0 ? (current / threshold) * 100 : 100;
        if (percent <= 25) return 'critical';
        if (percent <= 50) return 'warning';
        return 'info';
    }

    async upsertOperationalAlert(input: OperationalAlertInput): Promise<Alert> {
        const existing = await this.alertRepository.findOne({
            where: {
                facility_id: input.facilityId,
                organization_id: input.organizationId,
                alert_type: input.type,
                reference_type: input.referenceType,
                reference_id: input.referenceId,
            },
            order: {
                created_at: 'DESC',
            },
        });

        if (!existing) {
            const created = this.alertRepository.create({
                facility_id: input.facilityId,
                organization_id: input.organizationId,
                alert_type: input.type,
                status: AlertStatus.ACTIVE,
                medicine_id: this.normalizeNumber(input.medicineId),
                batch_id: this.normalizeNumber(input.batchId),
                reference_type: this.normalizeText(input.referenceType),
                reference_id: this.normalizeNumber(input.referenceId),
                title: input.title,
                message: input.message,
                current_value: this.normalizeNumber(input.currentValue),
                threshold_value: this.normalizeNumber(input.thresholdValue),
                severity: input.severity,
                context_data: this.normalizeContextData(input.contextData),
            });

            const saved = await this.alertRepository.save(created);
            await this.recordAlertEvent(saved.id, AlertEventType.CREATED, {
                previousStatus: null,
                newStatus: saved.status,
                note: 'Operational alert created',
                payload: {
                    alert_type: saved.alert_type,
                    reference_type: saved.reference_type,
                    reference_id: saved.reference_id,
                },
            });
            this.emitAlertRealtimeEvent(EventTypes.ALERT_CREATED, saved);
            return saved;
        }

        const previousStatus = existing.status;
        const nextPayload: AlertSyncCandidate = {
            medicine_id: input.medicineId,
            batch_id: input.batchId,
            reference_type: input.referenceType,
            reference_id: input.referenceId,
            title: input.title,
            message: input.message,
            current_value: this.normalizeNumber(input.currentValue) ?? 0,
            threshold_value: this.normalizeNumber(input.thresholdValue) ?? 0,
            severity: input.severity,
            context_data: input.contextData ?? null,
        };

        const changed = this.hasAlertChanged(existing, nextPayload);
        const isReopened = previousStatus === AlertStatus.RESOLVED;

        if (!changed && !isReopened) {
            return existing;
        }

        existing.medicine_id = this.normalizeNumber(input.medicineId);
        existing.batch_id = this.normalizeNumber(input.batchId);
        existing.reference_type = this.normalizeText(input.referenceType);
        existing.reference_id = this.normalizeNumber(input.referenceId);
        existing.title = input.title;
        existing.message = input.message;
        existing.current_value = this.normalizeNumber(input.currentValue);
        existing.threshold_value = this.normalizeNumber(input.thresholdValue);
        existing.severity = input.severity;
        existing.context_data = this.normalizeContextData(input.contextData);

        if (isReopened) {
            existing.status = AlertStatus.ACTIVE;
            existing.acknowledged_at = null;
            existing.acknowledged_by_id = null;
            existing.resolved_at = null;
            existing.resolved_by_id = null;
            existing.action_taken = null;
            existing.action_reason = null;
        }

        const saved = await this.alertRepository.save(existing);
        await this.recordAlertEvent(saved.id, isReopened ? AlertEventType.REOPENED : AlertEventType.UPDATED, {
            previousStatus,
            newStatus: saved.status,
            note: isReopened ? 'Operational alert reopened' : 'Operational alert updated',
            payload: {
                alert_type: saved.alert_type,
                reference_type: saved.reference_type,
                reference_id: saved.reference_id,
            },
        });
        this.emitAlertRealtimeEvent(EventTypes.ALERT_UPDATED, saved);

        return saved;
    }

    async acknowledgeAlertByReference(params: {
        facilityId?: number;
        organizationId: number;
        type: AlertType;
        referenceType: string;
        referenceId: number;
        userId?: number | null;
        note?: string | null;
    }): Promise<Alert | null> {
        const where: any = {
            organization_id: params.organizationId,
            alert_type: params.type,
            reference_type: params.referenceType,
            reference_id: params.referenceId,
            status: In([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
        };

        if (params.facilityId) {
            where.facility_id = params.facilityId;
        }

        const alert = await this.alertRepository.findOne({
            where,
            order: { created_at: 'DESC' },
        });

        if (!alert) {
            return null;
        }

        if (alert.status === AlertStatus.ACKNOWLEDGED) {
            return alert;
        }

        const previousStatus = alert.status;
        alert.status = AlertStatus.ACKNOWLEDGED;
        alert.acknowledged_at = new Date();
        alert.acknowledged_by_id = params.userId ?? null;

        const saved = await this.alertRepository.save(alert);
        await this.recordAlertEvent(saved.id, AlertEventType.ACKNOWLEDGED, {
            previousStatus,
            newStatus: saved.status,
            actorUserId: params.userId ?? null,
            note: params.note ?? 'Operational alert acknowledged',
            payload: {
                alert_type: saved.alert_type,
                reference_type: saved.reference_type,
                reference_id: saved.reference_id,
            },
        });
        this.emitAlertRealtimeEvent(EventTypes.ALERT_UPDATED, saved);
        return saved;
    }

    async resolveAlertByReference(params: {
        facilityId?: number;
        organizationId: number;
        type: AlertType;
        referenceType: string;
        referenceId: number;
        resolvedById?: number | null;
        actionTaken?: string | null;
        actionReason?: string | null;
        note?: string | null;
    }): Promise<Alert | null> {
        const where: any = {
            organization_id: params.organizationId,
            alert_type: params.type,
            reference_type: params.referenceType,
            reference_id: params.referenceId,
            status: In([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
        };

        if (params.facilityId) {
            where.facility_id = params.facilityId;
        }

        const alert = await this.alertRepository.findOne({
            where,
            order: { created_at: 'DESC' },
        });

        if (!alert) {
            return null;
        }

        const previousStatus = alert.status;
        alert.status = AlertStatus.RESOLVED;
        alert.resolved_at = new Date();
        alert.resolved_by_id = params.resolvedById ?? null;
        if (params.actionTaken) {
            alert.action_taken = params.actionTaken;
        }
        if (params.actionReason) {
            alert.action_reason = params.actionReason;
        }

        const saved = await this.alertRepository.save(alert);
        await this.recordAlertEvent(saved.id, AlertEventType.RESOLVED, {
            previousStatus,
            newStatus: saved.status,
            actorUserId: params.resolvedById ?? null,
            note: params.note ?? 'Operational alert resolved',
            payload: {
                alert_type: saved.alert_type,
                reference_type: saved.reference_type,
                reference_id: saved.reference_id,
            },
        });
        this.emitAlertRealtimeEvent(EventTypes.ALERT_RESOLVED, saved);
        return saved;
    }

    async checkLowStock(facilityId: number, organizationId: number, medicineId?: number) {
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
        const alertsToSync: AlertSyncCandidate[] = [];

        for (const stock of stockLevels) {
            const medicineRef = parseInt(stock.medicine_id, 10);
            const totalQuantity = parseFloat(stock.total_quantity);

            const setting = await this.medicineFacilitySettingRepository.findOne({
                where: { facility_id: facilityId, medicine_id: medicineRef },
            });
            const medicine = await this.medicineRepository.findOne({
                where: { id: medicineRef, organization_id: organizationId },
            });

            if (!medicine) continue;

            const threshold = setting?.min_stock_level ?? medicine.min_stock_level ?? 0;

            if (threshold > 0 && totalQuantity < threshold) {
                const severity = this.calculateSeverity(totalQuantity, threshold);
                alertsToSync.push({
                    medicine_id: medicineRef,
                    title: totalQuantity === 0 ? 'OUT OF STOCK' : 'Low Stock Alert',
                    message: `Medicine ${medicine.name} is ${totalQuantity === 0 ? 'out of stock' : 'running low'}. Current: ${totalQuantity}, Min: ${threshold}.`,
                    current_value: totalQuantity,
                    threshold_value: threshold,
                    severity,
                    context_data: {
                        trigger: 'stock_level_scan',
                        medicine_name: medicine.name,
                    },
                });
            }
        }

        const isTargetInResults = stockLevels.some((stock: any) => parseInt(stock.medicine_id, 10) === medicineId);
        if (medicineId && !isTargetInResults) {
            const medicine = await this.medicineRepository.findOne({
                where: { id: medicineId, organization_id: organizationId },
            });
            if (medicine) {
                const setting = await this.medicineFacilitySettingRepository.findOne({
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
                        context_data: {
                            trigger: 'stock_level_scan',
                            medicine_name: medicine.name,
                        },
                    });
                }
            }
        }

        const alertedIds = await this.syncAlerts(
            facilityId,
            organizationId,
            AlertType.LOW_STOCK,
            alertsToSync,
            medicineId,
        );

        for (const alertId of alertedIds) {
            const alert = await this.alertRepository.findOne({
                where: { id: alertId, organization_id: organizationId },
                relations: ['medicine'],
            });
            if (!alert?.medicine) {
                continue;
            }

            try {
                await this.inventoryNotificationService.notifyLowStock(
                    facilityId,
                    alert.medicine.name,
                    alert.current_value ?? 0,
                    alert.threshold_value ?? 0,
                    alert.id,
                );
                await this.markAlertNotified(alert.id, {
                    channel: 'inventory_notification',
                    category: 'low_stock',
                });
            } catch (err) {
                console.error('Failed to send low stock notification:', err);
            }
        }
    }

    async checkExpiries(facilityId: number, organizationId: number) {
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
            }

            return {
                medicine_id: stock.medicine.id,
                batch_id: stock.batch.id,
                title,
                message: `Batch ${stock.batch.batch_number} of ${stock.medicine.name} ${isExpired ? 'expired' : 'expires'} on ${expiryDate.toLocaleDateString()}${!isExpired ? ` (${daysUntilExpiry} days)` : ''}.`,
                current_value: stock.quantity,
                threshold_value: daysUntilExpiry,
                typeOverride: type,
                severity,
                context_data: {
                    batch_number: stock.batch.batch_number,
                    expiry_date: stock.batch.expiry_date,
                    days_until_expiry: daysUntilExpiry,
                },
            };
        });

        const expiring = alertsToSync.filter((entry) => entry.typeOverride === AlertType.EXPIRY_SOON);
        const expired = alertsToSync.filter((entry) => entry.typeOverride === AlertType.EXPIRED);

        const alertedExpiringIds = await this.syncAlerts(facilityId, organizationId, AlertType.EXPIRY_SOON, expiring);
        const alertedExpiredIds = await this.syncAlerts(facilityId, organizationId, AlertType.EXPIRED, expired);

        for (const alertId of [...alertedExpiringIds, ...alertedExpiredIds]) {
            const alert = await this.alertRepository.findOne({
                where: { id: alertId, organization_id: organizationId },
                relations: ['medicine', 'batch'],
            });
            if (!alert?.medicine || !alert.batch) {
                continue;
            }

            try {
                await this.inventoryNotificationService.notifyExpiry(
                    facilityId,
                    alert.medicine.name,
                    alert.batch.batch_number,
                    new Date(alert.batch.expiry_date),
                    alert.severity as 'critical' | 'warning' | 'info',
                    alert.id,
                );
                await this.markAlertNotified(alert.id, {
                    channel: 'inventory_notification',
                    category: alert.alert_type,
                });
            } catch (err) {
                console.error('Failed to send expiry notification:', err);
            }
        }
    }

    async runAllChecks(facilityId: number, organizationId: number) {
        await this.checkLowStock(facilityId, organizationId);
        await this.checkExpiries(facilityId, organizationId);
    }

    private async buildAlertStats(organizationId: number, facilityId?: number): Promise<AlertStatsResult> {
        const query = this.alertRepository
            .createQueryBuilder('alert')
            .select('alert.alert_type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('alert.organization_id = :organizationId', { organizationId })
            .andWhere('alert.status = :status', { status: AlertStatus.ACTIVE })
            .groupBy('alert.alert_type');

        if (facilityId) {
            query.andWhere('alert.facility_id = :facilityId', { facilityId });
        }

        const stats = await query.getRawMany();

        const result: AlertStatsResult = {
            low_stock: 0,
            expiry_soon: 0,
            expired: 0,
            controlled_drug_threshold: 0,
            reorder_suggestion: 0,
            batch_recall: 0,
            stock_variance: 0,
            cold_chain_excursion: 0,
            total: 0,
        };

        stats.forEach((entry: any) => {
            const count = parseInt(entry.count, 10) || 0;
            result.total += count;

            if (entry.type === AlertType.LOW_STOCK) result.low_stock = count;
            if (entry.type === AlertType.EXPIRY_SOON) result.expiry_soon = count;
            if (entry.type === AlertType.EXPIRED) result.expired = count;
            if (entry.type === AlertType.CONTROLLED_DRUG_THRESHOLD) result.controlled_drug_threshold = count;
            if (entry.type === AlertType.REORDER_SUGGESTION) result.reorder_suggestion = count;
            if (entry.type === AlertType.BATCH_RECALL) result.batch_recall = count;
            if (entry.type === AlertType.STOCK_VARIANCE) result.stock_variance = count;
            if (entry.type === AlertType.COLD_CHAIN_EXCURSION) result.cold_chain_excursion = count;
        });

        return result;
    }

    async getAlertStats(facilityId: number, organizationId: number): Promise<AlertStatsResult> {
        return this.buildAlertStats(organizationId, facilityId);
    }

    async findAll(
        facilityId: number,
        organizationId: number,
        status?: string,
        type?: string,
        page: number = 1,
        limit: number = 50,
    ): Promise<{ data: Alert[]; total: number; page: number; limit: number }> {
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

    async getAlerts(params: {
        facilityId?: number;
        organizationId: number;
        status?: string;
        type?: string;
        page?: number;
        limit?: number;
    }): Promise<{ data: Alert[]; total: number; page: number; limit: number; totalPages: number }> {
        const { facilityId, organizationId, status, type, page = 1, limit = 50 } = params;
        const where: any = {
            organization_id: organizationId,
        };

        if (facilityId) {
            where.facility_id = facilityId;
        }

        if (status) {
            where.status = status;
        }

        if (type && type !== 'all') {
            where.alert_type = type === 'expiry' ? In([AlertType.EXPIRY_SOON, AlertType.EXPIRED]) : type;
        }

        const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
        const currentPage = typeof page === 'number' && Number.isFinite(page) ? Math.max(1, page) : 1;
        const skip = (currentPage - 1) * safeLimit;

        const [data, total] = await this.alertRepository.findAndCount({
            where,
            order: {
                created_at: 'DESC',
            },
            relations: ['medicine', 'batch'],
            skip,
            take: safeLimit,
        });

        return {
            data,
            total,
            page: currentPage,
            limit: safeLimit,
            totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        };
    }

    async getAlertStatsAggregated(organizationId: number): Promise<AlertStatsResult> {
        return this.buildAlertStats(organizationId);
    }
}
