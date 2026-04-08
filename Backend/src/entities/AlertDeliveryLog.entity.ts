import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Alert } from './Alert.entity';
import { Notification } from './Notification.entity';
import { User } from './User.entity';

export enum AlertDeliveryChannel {
    IN_APP = 'in_app',
    EMAIL = 'email',
}

export enum AlertDeliveryStatus {
    SENT = 'sent',
    FAILED = 'failed',
    SKIPPED = 'skipped',
}

@Entity('alert_delivery_logs')
@Index(['alert_id', 'created_at'])
@Index(['user_id', 'created_at'])
export class AlertDeliveryLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    alert_id: number;

    @Column({ type: 'int', nullable: true })
    notification_id: number | null;

    @Column({ type: 'int', nullable: true })
    user_id: number | null;

    @Column({
        type: 'enum',
        enum: AlertDeliveryChannel,
    })
    channel: AlertDeliveryChannel;

    @Column({
        type: 'enum',
        enum: AlertDeliveryStatus,
    })
    status: AlertDeliveryStatus;

    @Column({ type: 'varchar', length: 255, nullable: true })
    destination: string | null;

    @Column({ type: 'text', nullable: true })
    error_message: string | null;

    @Column({ type: 'jsonb', nullable: true })
    payload: Record<string, any> | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    sent_at: Date | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Alert, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'alert_id' })
    alert: Alert;

    @ManyToOne(() => Notification, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'notification_id' })
    notification: Notification | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user: User | null;
}
