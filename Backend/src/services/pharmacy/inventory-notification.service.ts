import { NotificationService } from '../notification.service';
import { EmailUtil } from '../../utils/email.util';
import { NotificationType } from '../../entities/Notification.entity';
import { User, UserRole } from '../../entities/User.entity';
import { AppDataSource } from '../../config/database';
import { StockVariance } from '../../entities/StockVariance.entity';
import { BatchRecall } from '../../entities/BatchRecall.entity';
import { PredictiveReorderSuggestion } from './predictive-reorder.service';
import { Facility } from '../../entities/Facility.entity';

export class InventoryNotificationService {
    private notificationService: NotificationService;
    private userRepository = AppDataSource.getRepository(User);
    private facilityRepository = AppDataSource.getRepository(Facility);

    constructor() {
        this.notificationService = new NotificationService();
    }

    private async getRecipients(facilityId: number, roles: UserRole[]): Promise<User[]> {
        return this.userRepository.find({
            where: roles.map((role) => ({ role, facility_id: facilityId, is_active: true })),
        });
    }

    async notifyVariance(variance: StockVariance) {
        const recipients = await this.getRecipients(variance.facility_id, [
            UserRole.STORE_MANAGER,
            UserRole.FACILITY_ADMIN,
            UserRole.OWNER,
        ]);

        const title = `New Stock Variance Recorded: #${variance.id}`;
        const message = `${variance.variance_quantity > 0 ? 'Surplus' : 'Shortage'} of ${Math.abs(variance.variance_quantity)} units for ${variance.medicine?.name || 'Medicine ID ' + variance.medicine_id}. Value Impact: ${variance.variance_value} RWF.`;

        for (const user of recipients) {
            await this.notificationService.createNotification(
                user.id,
                NotificationType.LOW_STOCK, // Using LOW_STOCK as a generic inventory health type or we could add a new one
                title,
                message,
                { varianceId: variance.id, type: 'variance' },
            );

            // Send email for high value variances (e.g. > 50,000 RWF)
            if (Math.abs(Number(variance.variance_value || 0)) > 50000) {
                await EmailUtil.sendEmail(
                    user.email,
                    `URGENT: High Value Stock Variance - ${variance.facility?.name || 'Facility'}`,
                    `
                    <h3>High Value Variance Detected</h3>
                    <p><strong>Medicine:</strong> ${variance.medicine?.name || 'N/A'}</p>
                    <p><strong>Variance:</strong> ${variance.variance_quantity} units</p>
                    <p><strong>Impact:</strong> ${variance.variance_value} RWF</p>
                    <p><strong>Reason:</strong> ${variance.reason || 'Not specified'}</p>
                    <p>Please review this variance in the dashboard.</p>
                    `,
                );
            }
        }
    }

    async notifyRecall(recall: BatchRecall, affectedSalesCount: number) {
        const recipients = await this.getRecipients(recall.facility_id, [
            UserRole.PHARMACIST,
            UserRole.STORE_MANAGER,
            UserRole.FACILITY_ADMIN,
        ]);

        const title = `URGENT: Batch Recall Initiated - ${recall.recall_number}`;
        const message = `Recall for ${recall.medicine?.name}, Batch ${recall.batch?.batch_number}. Reason: ${recall.reason}. ${affectedSalesCount} sales affected.`;

        for (const user of recipients) {
            await this.notificationService.createNotification(
                user.id,
                NotificationType.ITEM_EXPIRY, // Using as a proxy for hazardous items
                title,
                message,
                { recallId: recall.id, type: 'recall' },
            );

            // Recall always gets email
            await EmailUtil.sendEmail(
                user.email,
                `BATCH RECALL NOTICE: ${recall.medicine?.name}`,
                `
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
            );
        }
    }

    async notifyCriticalReorder(facilityId: number, suggestions: PredictiveReorderSuggestion[]) {
        const criticalItems = suggestions.filter((s) => s.priority === 'critical');
        if (criticalItems.length === 0) return;

        const recipients = await this.getRecipients(facilityId, [UserRole.STORE_MANAGER, UserRole.PHARMACIST]);

        const title = `Critical Reorder Alert: ${criticalItems.length} items`;
        const message = `The following items will stock out in less than 3 days: ${criticalItems
            .slice(0, 3)
            .map((i) => i.medicine_name)
            .join(', ')}${criticalItems.length > 3 ? '...' : ''}`;

        for (const user of recipients) {
            await this.notificationService.createNotification(user.id, NotificationType.LOW_STOCK, title, message, {
                items: criticalItems.map((i) => i.medicine_id),
                type: 'predictive_reorder',
            });
        }
    }

    async notifyLowStock(facilityId: number, medicineName: string, currentStock: number, minLevel: number) {
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
            await this.notificationService.createNotification(user.id, NotificationType.LOW_STOCK, title, message, {
                medicineName,
                currentStock,
                minLevel,
                severity,
            });

            if (!user.email) {
                continue;
            }

            await EmailUtil.sendLowStockAlertEmail(user.email, {
                facilityName,
                medicineName,
                currentStock,
                minLevel,
                severity,
            });
        }
    }

    async notifyExpiry(
        facilityId: number,
        medicineName: string,
        batchNumber: string,
        expiryDate: Date,
        severity: 'critical' | 'warning' | 'info',
    ) {
        const recipients = await this.getRecipients(facilityId, [UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN]);
        const facility = await this.facilityRepository.findOne({ where: { id: facilityId } });
        const facilityName = facility?.name || `Facility #${facilityId}`;

        let title = 'Item Expiring Soon';
        if (severity === 'critical') title = 'CRITICAL: Item Expiry Warning';
        else if (severity === 'warning') title = 'URGENT: Item Expiry Warning';

        const message = `Batch ${batchNumber} of ${medicineName} expires on ${expiryDate.toLocaleDateString()}.`;

        for (const user of recipients) {
            await this.notificationService.createNotification(user.id, NotificationType.ITEM_EXPIRY, title, message, {
                medicineName,
                batchNumber,
                expiryDate,
                severity,
            });

            // Skip informational expiry emails to reduce noise.
            if (severity === 'info' || !user.email) {
                continue;
            }

            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            await EmailUtil.sendExpiryAlertEmail(user.email, {
                facilityName,
                medicineName,
                batchNumber,
                expiryDate,
                daysUntilExpiry,
                severity,
            });
        }
    }
}
