import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Alert, AlertStatus, AlertType } from '../../entities/Alert.entity';
import { AlertDeliveryLog } from '../../entities/AlertDeliveryLog.entity';
import { AlertEventType } from '../../entities/AlertEvent.entity';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { AlertService } from '../../services/pharmacy/alert.service';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import { eventBus, EventTypes } from '../../utils/eventBus';

const ALERT_RESOLUTION_ACTIONS: Record<AlertType, string[]> = {
    [AlertType.LOW_STOCK]: ['Restocked', 'PO Created', 'Transferred', 'Adjusted Count', 'False Alarm'],
    [AlertType.EXPIRY_SOON]: ['Discounted', 'Transferred', 'Returned to Supplier', 'Quarantined', 'False Alarm'],
    [AlertType.EXPIRED]: ['Disposed', 'Returned to Supplier', 'Quarantined', 'False Alarm'],
    [AlertType.CONTROLLED_DRUG_THRESHOLD]: ['Investigated', 'Adjusted Count', 'Escalated', 'False Alarm'],
    [AlertType.REORDER_SUGGESTION]: ['PO Created', 'Transferred', 'Deferred', 'False Alarm'],
    [AlertType.BATCH_RECALL]: ['Quarantined', 'Recovered', 'Disposed', 'Supplier Notified', 'False Alarm'],
    [AlertType.STOCK_VARIANCE]: ['Adjusted Count', 'Investigated', 'Approved Variance', 'Rejected Variance', 'False Alarm'],
    [AlertType.COLD_CHAIN_EXCURSION]: ['Quarantined', 'Temperature Restored', 'Disposed', 'Escalated', 'False Alarm'],
};

export class AlertController {
    private alertService: AlertService;
    private alertRepository = AppDataSource.getRepository(Alert);
    private deliveryLogRepository = AppDataSource.getRepository(AlertDeliveryLog);

    constructor() {
        this.alertService = new AlertService();
    }

    checkLowStock = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            if (!facilityId || !organizationId) {
                throw new AppError('Facility and organization scope are required', 400);
            }

            await this.alertService.checkLowStock(facilityId, organizationId);
            res.status(200).json({
                status: 'success',
                message: 'Low stock check completed',
            });
        } catch (error) {
            next(error);
        }
    };

    checkExpiries = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            if (!facilityId || !organizationId) {
                throw new AppError('Facility and organization scope are required', 400);
            }

            await this.alertService.checkExpiries(facilityId, organizationId);
            res.status(200).json({
                status: 'success',
                message: 'Expiry check completed',
            });
        } catch (error) {
            next(error);
        }
    };

    getAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const user = req.user;
            const role = String(user?.role || '').toLowerCase();
            const isHighLevel = role === 'super_admin' || role === 'owner' || role === 'admin';
            const organizationId = resolveOrganizationId(req);

            if (!organizationId) {
                throw new AppError('Organization scope is required', 400);
            }

            if (!facilityId && !isHighLevel) {
                throw new AppError('Facility scope is required', 400);
            }

            const status = req.query.status as string | undefined;
            const type = req.query.type as string | undefined;
            const page = req.query.page ? Number(req.query.page) : undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const alerts = await this.alertService.getAlerts({
                facilityId,
                organizationId,
                status,
                type,
                page,
                limit,
            });
            res.status(200).json({
                status: 'success',
                message: 'Alerts retrieved successfully',
                data: alerts.data.map((alert: any) => ({
                    ...alert,
                    type: alert.alert_type,
                })),
                meta: {
                    total: alerts.total,
                    page: alerts.page,
                    limit: alerts.limit,
                    totalPages: alerts.totalPages,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    resolveAlert = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const alertId = Number(req.params.id);
            const userId = req.user?.userId;
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const { action_taken, action_reason } = req.body;

            if (!Number.isInteger(alertId) || alertId <= 0) {
                throw new AppError('Alert ID must be a positive integer', 400);
            }
            if (!userId) {
                throw new AppError('User ID required', 400);
            }
            if (!facilityId || !organizationId) {
                throw new AppError('Facility and organization scope are required', 400);
            }

            const alert = await this.alertRepository.findOne({
                where: {
                    id: alertId,
                    facility_id: facilityId,
                    organization_id: organizationId,
                },
            });
            if (!alert) {
                throw new AppError('Alert not found', 404);
            }
            if (alert.status === AlertStatus.RESOLVED) {
                throw new AppError('Alert is already resolved', 400);
            }

            const normalizedAction = this.normalizeAction(action_taken);
            if (!normalizedAction) {
                throw new AppError('Action taken is required', 400);
            }

            const allowedActions = ALERT_RESOLUTION_ACTIONS[alert.alert_type] || [];
            if (!allowedActions.includes(normalizedAction)) {
                throw new AppError(
                    `Invalid action for ${alert.alert_type}. Allowed actions: ${allowedActions.join(', ')}`,
                    400,
                );
            }

            const reason = String(action_reason || '').trim();
            if (reason.length < 10) {
                throw new AppError('Action reason must be at least 10 characters', 400);
            }
            if (normalizedAction === 'False Alarm' && reason.length < 15) {
                throw new AppError('False Alarm resolution requires a detailed reason (15+ characters)', 400);
            }

            const previousStatus = alert.status;
            alert.status = AlertStatus.RESOLVED;
            alert.resolved_at = new Date();
            alert.resolved_by_id = userId;
            alert.action_taken = normalizedAction;
            alert.action_reason = reason;

            await this.alertRepository.save(alert);
            await this.alertService.recordAlertEvent(alert.id, AlertEventType.RESOLVED, {
                previousStatus,
                newStatus: alert.status,
                actorUserId: userId,
                note: 'Alert resolved manually from the alerts workspace',
                payload: {
                    alert_type: alert.alert_type,
                    action_taken: normalizedAction,
                    action_reason: reason,
                },
            });
            eventBus.emit(EventTypes.ALERT_RESOLVED, {
                id: alert.id,
                facility_id: alert.facility_id,
                organization_id: alert.organization_id ?? null,
                type: alert.alert_type,
                status: alert.status,
                severity: alert.severity,
            });

            res.status(200).json({
                status: 'success',
                message: 'Alert resolved successfully',
                data: alert,
            });
        } catch (error) {
            next(error);
        }
    };

    getAlertSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                throw new AppError('Organization context missing', 400);
            }

            const data = facilityId
                ? await this.alertService.getAlertStats(facilityId, organizationId)
                : await this.alertService.getAlertStatsAggregated(organizationId);

            res.status(200).json({
                status: 'success',
                message: 'Alert summary retrieved successfully',
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    acknowledgeAlert = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const alertId = Number(req.params.id);
            const userId = req.user?.userId;
            const organizationId = resolveOrganizationId(req);
            const facilityId = resolveFacilityId(req);

            if (!Number.isInteger(alertId) || alertId <= 0) {
                throw new AppError('Alert ID must be a positive integer', 400);
            }
            if (!userId) {
                throw new AppError('User ID required', 400);
            }
            if (!organizationId) {
                throw new AppError('Organization context missing', 400);
            }

            const where: any = {
                id: alertId,
                organization_id: organizationId,
            };
            if (facilityId) {
                where.facility_id = facilityId;
            }

            const alert = await this.alertRepository.findOne({ where });
            if (!alert) {
                throw new AppError('Alert not found', 404);
            }
            if (alert.status === AlertStatus.RESOLVED) {
                throw new AppError('Resolved alerts cannot be acknowledged', 400);
            }
            if (alert.status === AlertStatus.ACKNOWLEDGED) {
                throw new AppError('Alert is already acknowledged', 400);
            }

            const previousStatus = alert.status;
            alert.status = AlertStatus.ACKNOWLEDGED;
            alert.acknowledged_at = new Date();
            alert.acknowledged_by_id = userId;

            await this.alertRepository.save(alert);
            await this.alertService.recordAlertEvent(alert.id, AlertEventType.ACKNOWLEDGED, {
                previousStatus,
                newStatus: alert.status,
                actorUserId: userId,
                note: 'Alert acknowledged manually from the alerts workspace',
                payload: {
                    alert_type: alert.alert_type,
                },
            });
            eventBus.emit(EventTypes.ALERT_UPDATED, {
                id: alert.id,
                facility_id: alert.facility_id,
                organization_id: alert.organization_id ?? null,
                type: alert.alert_type,
                status: alert.status,
                severity: alert.severity,
            });

            res.status(200).json({
                status: 'success',
                message: 'Alert acknowledged successfully',
                data: alert,
            });
        } catch (error) {
            next(error);
        }
    };

    generateAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId || !organizationId) {
                throw new AppError('Facility and organization scope are required', 400);
            }

            await this.alertService.runAllChecks(facilityId, organizationId);

            res.status(200).json({
                status: 'success',
                message: 'Alerts generated successfully',
            });
        } catch (error) {
            next(error);
        }
    };

    listDeliveryLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId || !organizationId) {
                throw new AppError('Facility and organization scope are required', 400);
            }
            const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
            const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));

            const qb = this.deliveryLogRepository
                .createQueryBuilder('log')
                .leftJoinAndSelect('log.alert', 'alert')
                .where('alert.facility_id = :facilityId', { facilityId })
                .andWhere('alert.organization_id = :organizationId', { organizationId })
                .orderBy('log.created_at', 'DESC')
                .skip((page - 1) * limit)
                .take(limit);

            const [data, total] = await qb.getManyAndCount();

            res.status(200).json({
                status: 'success',
                message: 'Alert delivery logs retrieved',
                data: { data, total, page, limit },
            });
        } catch (error) {
            next(error);
        }
    };

    private normalizeAction(action: unknown): string {
        const value = String(action || '').trim();
        if (!value) return '';

        const normalized = value.toLowerCase();
        if (normalized === 'restocked / ordered' || normalized === 'restocked/ordered') return 'Restocked';
        if (normalized === 'ordered') return 'PO Created';
        if (normalized === 'returned') return 'Returned to Supplier';
        if (normalized === 'ignored') return 'False Alarm';
        if (normalized === 'adjusted') return 'Adjusted Count';
        if (normalized === 'quarantine') return 'Quarantined';
        if (normalized === 'recovered') return 'Recovered';
        if (normalized === 'supplier notified') return 'Supplier Notified';
        if (normalized === 'approved') return 'Approved Variance';
        if (normalized === 'rejected') return 'Rejected Variance';
        if (normalized === 'temperature restored') return 'Temperature Restored';

        return value;
    }
}
