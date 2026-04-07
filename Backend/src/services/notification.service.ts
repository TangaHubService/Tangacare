import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Notification, NotificationType } from '../entities/Notification.entity';
import { eventBus, EventTypes } from '../utils/eventBus';

export class NotificationService {
    private notificationRepository: Repository<Notification>;

    constructor() {
        this.notificationRepository = AppDataSource.getRepository(Notification);
    }

    async createNotification(
        userId: number,
        type: NotificationType,
        title: string,
        message: string,
        data?: Record<string, any>,
        manager?: EntityManager,
    ): Promise<Notification> {
        const repo = manager ? manager.getRepository(Notification) : this.notificationRepository;

        const notification = repo.create({
            user_id: userId,
            type,
            title,
            message,
            data,
        });

        const savedNotification = await repo.save(notification);

        eventBus.emit(EventTypes.NOTIFICATION_CREATED, savedNotification);

        return savedNotification;
    }

    async getUserNotifications(
        userId: number,
        page: number = 1,
        limit: number = 20,
    ): Promise<{ notifications: Notification[]; total: number; page: number; totalPages: number }> {
        const [notifications, total] = await this.notificationRepository.findAndCount({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            notifications,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markNotificationAsRead(notificationId: number, userId: number): Promise<void> {
        const notification = await this.notificationRepository.findOne({
            where: { id: notificationId, user_id: userId },
        });

        if (!notification) {
            throw new Error('Notification not found');
        }

        if (notification.is_read) {
            return;
        }

        await this.notificationRepository.update(notificationId, {
            is_read: true,
            read_at: new Date(),
        });
    }

    async markAllAsRead(userId: number): Promise<void> {
        await this.notificationRepository
            .createQueryBuilder()
            .update(Notification)
            .set({ is_read: true, read_at: new Date() })
            .where('user_id = :userId', { userId })
            .andWhere('is_read = :isRead', { isRead: false })
            .execute();
    }

    async getUnreadCount(userId: number): Promise<number> {
        return await this.notificationRepository.count({
            where: { user_id: userId, is_read: false },
        });
    }

    async deleteNotification(notificationId: number, userId: number): Promise<void> {
        const notification = await this.notificationRepository.findOne({
            where: { id: notificationId, user_id: userId },
        });

        if (!notification) {
            throw new Error('Notification not found');
        }

        await this.notificationRepository.remove(notification);
    }

    async deleteReadNotifications(userId: number): Promise<void> {
        await this.notificationRepository
            .createQueryBuilder()
            .delete()
            .from(Notification)
            .where('user_id = :userId', { userId })
            .andWhere('is_read = :isRead', { isRead: true })
            .execute();
    }
}
