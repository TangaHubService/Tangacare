import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { Alert } from './Alert.entity';

export enum NotificationType {
    NEW_MESSAGE = 'new_message',
    APPOINTMENT_REMINDER = 'appointment_reminder',
    APPOINTMENT_CONFIRMED = 'appointment_confirmed',
    APPOINTMENT_CANCELLED = 'appointment_cancelled',
    PRESCRIPTION_READY = 'prescription_ready',
    PAYMENT_RECEIVED = 'payment_received',
    HEALTH_TIP = 'health_tip',

    PO_SUBMITTED = 'po_submitted',
    PO_APPROVED = 'po_approved',
    PO_RECEIVED = 'po_received',
    PO_CANCELLED = 'po_cancelled',
    PO_SENT = 'po_sent',

    LOW_STOCK = 'low_stock',
    ITEM_EXPIRY = 'item_expiry',
}

@Entity('notifications')
@Index(['user_id', 'is_read'])
@Index(['user_id', 'created_at'])
@Index(['alert_id', 'created_at'])
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    user_id: number;

    @Column({ type: 'int', nullable: true })
    alert_id: number | null;

    @Column({
        type: 'enum',
        enum: NotificationType,
    })
    type: NotificationType;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'jsonb', nullable: true })
    data: Record<string, any>;

    @Column({ type: 'boolean', default: false })
    is_read: boolean;

    @Column({ type: 'timestamp with time zone', nullable: true })
    read_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Alert, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'alert_id' })
    alert: Alert | null;
}
