import { AppDataSource } from '../../config/database';
import { AlertDeliveryChannel, AlertDeliveryLog, AlertDeliveryStatus } from '../../entities/AlertDeliveryLog.entity';
import { BatchRecall } from '../../entities/BatchRecall.entity';
import { Facility } from '../../entities/Facility.entity';
import { NotificationType } from '../../entities/Notification.entity';
import { StockVariance } from '../../entities/StockVariance.entity';
import { User, UserRole } from '../../entities/User.entity';
import { EmailUtil } from '../../utils/email.util';
import { NotificationService } from '../notification.service';
import { PredictiveReorderSuggestion } from './predictive-reorder.service';

export class InventoryNotificationService {
    private notificationService: NotificationService;
    private userRepository = AppDataSource.getRepository(User);
    private facilityRepository = AppDataSource.getRepository(Facility);
    private alertDeliveryLogRepository = AppDataSource.getRepository(AlertDeliveryLog);

    constructor() {
        this.notificationService = new NotificationService();
    }

    private async getRecipients(facilityId: number, roles: UserRole[]): Promise<User[]> {
        return this.userRepository.find({
            where: roles.map((role) => ({ role, facility_id: facilityId, is_active: true })),
        });
    }

    private async logDelivery(params: {
        alertId?: number | null;
        notificationId?: number | null;
        userId?: number | null;
        channel: AlertDeliveryChannel;
        status: AlertDeliveryStatus;
        destination?: string | null;
        errorMessage?: string | null;
        payload?: Record<string, any> | null;
    }): Promise<void> {
        if (!params.alertId) {
            return;
        }

        const log = this.alertDeliveryLogRepository.create({
            alert_id: params.alertId,
            notification_id: params.notificationId ?? null,
            user_id: params.userId ?? null,
            channel: params.channel,
            status: params.status,
            destination: params.destination ?? null,
            error_message: params.errorMessage ?? null,
            payload: params.payload ?? null,
            sent_at: params.status === AlertDeliveryStatus.SENT ? new Date() : null,
        });

        await this.alertDeliveryLogRepository.save(log);
    }

    private async createInAppNotification(params: {
        user: User;
        alertId?: number | null;
        type: NotificationType;
        title: string;
        message: string;
        data?: Record<string, any>;
    }) {
        const notification = await this.notificationService.createNotification(
            params.user.id,
            params.type,
            params.title,
            params.message,
            params.data,
            undefined,
            { alertId: params.alertId ?? null },
        );

        await this.logDelivery({
            alertId: params.alertId ?? null,
            notificationId: notification.id,
            userId: params.user.id,
            channel: AlertDeliveryChannel.IN_APP,
            status: AlertDeliveryStatus.SENT,
            payload: {
                type: params.type,
                title: params.title,
            },
        });

        return notification;
    }

    private async sendEmailWithAudit(params: {
        alertId?: number | null;
        user: User;
        subject: string;
        html: string;
        skip?: boolean;
        skipReason?: string;
        payload?: Record<string, any> | null;
    }): Promise<void> {
        if (params.skip || !params.user.email) {
            await this.logDelivery({
                alertId: params.alertId ?? null,
                userId: params.user.id,
                channel: AlertDeliveryChannel.EMAIL,
                status: AlertDeliveryStatus.SKIPPED,
                destination: params.user.email ?? null,
                errorMessage: params.skipReason ?? (!params.user.email ? 'Recipient has no email address' : null),
                payload: params.payload ?? null,
            });
            return;
        }

        try {
            await EmailUtil.sendEmail(params.user.email, params.subject, params.html);
            await this.logDelivery({
                alertId: params.alertId ?? null,
                userId: params.user.id,
                channel: AlertDeliveryChannel.EMAIL,
                status: AlertDeliveryStatus.SENT,
                destination: params.user.email,
                payload: params.payload ?? null,
            });
        } catch (error) {
            await this.logDelivery({
                alertId: params.alertId ?? null,
                userId: params.user.id,
                channel: AlertDeliveryChannel.EMAIL,
                status: AlertDeliveryStatus.FAILED,
                destination: params.user.email,
                errorMessage: error instanceof Error ? error.message : 'Email delivery failed',
                payload: params.payload ?? null,
            });
            throw error;
        }
    }

    async notifyVariance(variance: StockVariance, alertId?: number) {
        const recipients = await this.getRecipients(variance.facility_id, [
            UserRole.STORE_MANAGER,
            UserRole.FACILITY_ADMIN,
            UserRole.OWNER,
        ]);

        const title = `New Stock Variance Recorded: #${variance.id}`;
        const message = `${variance.variance_quantity > 0 ? 'Surplus' : 'Shortage'} of ${Math.abs(variance.variance_quantity)} units for ${variance.medicine?.name || 'Medicine ID ' + variance.medicine_id}. Value Impact: ${variance.variance_value} RWF.`;
        const isHighValue = Math.abs(Number(variance.variance_value || 0)) > 50000;

        for (const user of recipients) {
            await this.createInAppNotification({
                user,
                alertId,
                type: NotificationType.LOW_STOCK,
                title,
                message,
                data: {
                    varianceId: variance.id,
                    type: 'variance',
                    varianceQuantity: variance.variance_quantity,
                    varianceValue: variance.variance_value,
                },
            });

            await this.sendEmailWithAudit({
                alertId,
                user,
                subject: `URGENT: High Value Stock Variance - ${variance.facility?.name || 'Facility'}`,
                html: `
                    <h3>High Value Variance Detected</h3>
                    <p><strong>Medicine:</strong> ${variance.medicine?.name || 'N/A'}</p>
                    <p><strong>Variance:</strong> ${variance.variance_quantity} units</p>
                    <p><strong>Impact:</strong> ${variance.variance_value} RWF</p>
                    <p><strong>Reason:</strong> ${variance.reason || 'Not specified'}</p>
                    <p>Please review this variance in the dashboard.</p>
                `,
                skip: !isHighValue,
                skipReason: isHighValue ? undefined : 'Variance value below high-value escalation threshold',
                payload: {
                    varianceId: variance.id,
                    escalation: 'high_value',
                },
            }).catch((error) => {
                console.error('Failed to send variance email:', error);
            });
        }
    }

    async notifyRecall(recall: BatchRecall, affectedSalesCount: number, alertId?: number) {
        const recipients = await this.getRecipients(recall.facility_id, [
            UserRole.PHARMACIST,
            UserRole.STORE_MANAGER,
            UserRole.FACILITY_ADMIN,
        ]);

        const title = `URGENT: Batch Recall Initiated - ${recall.recall_number}`;
        const message = `Recall for ${recall.medicine?.name}, Batch ${recall.batch?.batch_number}. Reason: ${recall.reason}. ${affectedSalesCount} sales affected.`;

        for (const user of recipients) {
            await this.createInAppNotification({
                user,
                alertId,
                type: NotificationType.ITEM_EXPIRY,
                title,
                message,
                data: {
                    recallId: recall.id,
                    type: 'recall',
                    affectedSalesCount,
                    recallNumber: recall.recall_number,
                },
            });

            await this.sendEmailWithAudit({
                alertId,
                user,
                subject: `BATCH RECALL NOTICE: ${recall.medicine?.name}`,
                html: `
                    <h2 style="color: #e11d48;">URGENT BATCH RECALL</h2>
                    <p>A recall has been initiated for the following medicine:</p>
                    <ul>
                        <li><strong>Medicine:</strong> ${recall.medicine?.name}</li>
                        <li><strong>Batch:</strong> ${recall.batch?.batch_number}</li>
                        <li><strong>Reason:</strong> ${recall.reason}</li>
                        <li><strong>Affected Sales:</strong> ${affectedSalesCount}</li>
                    </ul>
                    <p><strong>Description:</strong> ${recall.description}</p>
                    <p>Please stop dispensing this batch immediately and follow recovery procedures.</p>
                `,
                payload: {
                    recallId: recall.id,
                    recallNumber: recall.recall_number,
                },
            }).catch((error) => {
                console.error('Failed to send recall email:', error);
            });
        }
    }

    async notifyCriticalReorder(
        facilityId: number,
        suggestions: Array<PredictiveReorderSuggestion & { alert_id?: number }>,
    ) {
        const criticalItems = suggestions.filter((item) => item.priority === 'critical');
        if (criticalItems.length === 0) return;

        const recipients = await this.getRecipients(facilityId, [UserRole.STORE_MANAGER, UserRole.PHARMACIST]);

        for (const item of criticalItems) {
            const title = `Critical Reorder Alert: ${item.medicine_name}`;
            const message = `${item.medicine_name} is projected to stock out in ${Math.max(0, item.days_until_stockout)} day(s). Current stock: ${item.current_stock}, suggested order: ${item.suggested_order_quantity}.`;

            for (const user of recipients) {
                await this.createInAppNotification({
                    user,
                    alertId: item.alert_id ?? null,
                    type: NotificationType.LOW_STOCK,
                    title,
                    message,
                    data: {
                        medicineId: item.medicine_id,
                        type: 'predictive_reorder',
                        priority: item.priority,
                        daysUntilStockout: item.days_until_stockout,
                        suggestedOrderQuantity: item.suggested_order_quantity,
                    },
                });
            }
        }
    }

    async notifyLowStock(
        facilityId: number,
        medicineName: string,
        currentStock: number,
        minLevel: number,
        alertId?: number,
    ) {
        const recipients = await this.getRecipients(facilityId, [UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN]);
        const facility = await this.facilityRepository.findOne({ where: { id: facilityId } });
        const facilityName = facility?.name || `Facility #${facilityId}`;

        const title = 'Low Stock Alert';
        const message = `Medicine ${medicineName} is running low. Current: ${currentStock}, Min: ${minLevel}.`;
        const severity: 'out_of_stock' | 'critical' | 'warning' | 'info' =
            currentStock <= 0
                ? 'out_of_stock'
                : currentStock <= Math.max(1, minLevel * 0.25)
                  ? 'critical'
                  : currentStock <= Math.max(1, minLevel * 0.5)
                    ? 'warning'
                    : 'info';

        for (const user of recipients) {
            await this.createInAppNotification({
                user,
                alertId,
                type: NotificationType.LOW_STOCK,
                title,
                message,
                data: {
                    medicineName,
                    currentStock,
                    minLevel,
                    severity,
                },
            });

            if (!user.email) {
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.SKIPPED,
                    errorMessage: 'Recipient has no email address',
                    payload: {
                        medicineName,
                        severity,
                    },
                });
                continue;
            }

            try {
                await EmailUtil.sendLowStockAlertEmail(user.email, {
                    facilityName,
                    medicineName,
                    currentStock,
                    minLevel,
                    severity,
                });
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.SENT,
                    destination: user.email,
                    payload: {
                        medicineName,
                        severity,
                    },
                });
            } catch (error) {
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.FAILED,
                    destination: user.email,
                    errorMessage: error instanceof Error ? error.message : 'Low stock email delivery failed',
                    payload: {
                        medicineName,
                        severity,
                    },
                });
                console.error('Failed to send low stock email:', error);
            }
        }
    }

    async notifyExpiry(
        facilityId: number,
        medicineName: string,
        batchNumber: string,
        expiryDate: Date,
        severity: 'critical' | 'warning' | 'info',
        alertId?: number,
    ) {
        const recipients = await this.getRecipients(facilityId, [UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN]);
        const facility = await this.facilityRepository.findOne({ where: { id: facilityId } });
        const facilityName = facility?.name || `Facility #${facilityId}`;

        let title = 'Item Expiring Soon';
        if (severity === 'critical') title = 'CRITICAL: Item Expiry Warning';
        else if (severity === 'warning') title = 'URGENT: Item Expiry Warning';

        const message = `Batch ${batchNumber} of ${medicineName} expires on ${expiryDate.toLocaleDateString()}.`;

        for (const user of recipients) {
            await this.createInAppNotification({
                user,
                alertId,
                type: NotificationType.ITEM_EXPIRY,
                title,
                message,
                data: {
                    medicineName,
                    batchNumber,
                    expiryDate,
                    severity,
                },
            });

            if (severity === 'info') {
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.SKIPPED,
                    destination: user.email ?? null,
                    errorMessage: 'Informational expiry alert does not send email',
                    payload: {
                        medicineName,
                        batchNumber,
                        severity,
                    },
                });
                continue;
            }

            if (!user.email) {
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.SKIPPED,
                    errorMessage: 'Recipient has no email address',
                    payload: {
                        medicineName,
                        batchNumber,
                        severity,
                    },
                });
                continue;
            }

            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            try {
                await EmailUtil.sendExpiryAlertEmail(user.email, {
                    facilityName,
                    medicineName,
                    batchNumber,
                    expiryDate,
                    daysUntilExpiry,
                    severity,
                });
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.SENT,
                    destination: user.email,
                    payload: {
                        medicineName,
                        batchNumber,
                        severity,
                    },
                });
            } catch (error) {
                await this.logDelivery({
                    alertId,
                    userId: user.id,
                    channel: AlertDeliveryChannel.EMAIL,
                    status: AlertDeliveryStatus.FAILED,
                    destination: user.email,
                    errorMessage: error instanceof Error ? error.message : 'Expiry email delivery failed',
                    payload: {
                        medicineName,
                        batchNumber,
                        severity,
                    },
                });
                console.error('Failed to send expiry email:', error);
            }
        }
    }

    async notifyColdChainExcursion(
        facilityId: number,
        locationName: string,
        currentTemperature: number,
        expectedMin: number,
        expectedMax: number,
        alertId?: number,
    ) {
        const recipients = await this.getRecipients(facilityId, [
            UserRole.PHARMACIST,
            UserRole.STORE_MANAGER,
            UserRole.FACILITY_ADMIN,
        ]);
        const facility = await this.facilityRepository.findOne({ where: { id: facilityId } });
        const facilityName = facility?.name || `Facility #${facilityId}`;

        const title = `URGENT: Cold Chain Excursion - ${locationName}`;
        const message = `${locationName} is outside the allowed range (${expectedMin}C to ${expectedMax}C). Latest reading: ${currentTemperature}C.`;

        for (const user of recipients) {
            await this.createInAppNotification({
                user,
                alertId,
                type: NotificationType.ITEM_EXPIRY,
                title,
                message,
                data: {
                    type: 'cold_chain_excursion',
                    locationName,
                    currentTemperature,
                    expectedMin,
                    expectedMax,
                },
            });

            await this.sendEmailWithAudit({
                alertId,
                user,
                subject: `Cold Chain Excursion: ${locationName} - ${facilityName}`,
                html: `
                    <h2 style="color: #dc2626;">Cold Chain Excursion Detected</h2>
                    <p><strong>Facility:</strong> ${facilityName}</p>
                    <p><strong>Location:</strong> ${locationName}</p>
                    <p><strong>Observed Temperature:</strong> ${currentTemperature}C</p>
                    <p><strong>Expected Range:</strong> ${expectedMin}C to ${expectedMax}C</p>
                    <p>Please quarantine exposed stock and investigate immediately.</p>
                `,
                payload: {
                    type: 'cold_chain_excursion',
                    locationName,
                },
            }).catch((error) => {
                console.error('Failed to send cold-chain email:', error);
            });
        }
    }
}
