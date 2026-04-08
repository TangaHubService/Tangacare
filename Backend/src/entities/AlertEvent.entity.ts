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
import { Alert, AlertStatus } from './Alert.entity';
import { User } from './User.entity';

export enum AlertEventType {
    CREATED = 'created',
    UPDATED = 'updated',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
    REOPENED = 'reopened',
    NOTIFIED = 'notified',
}

@Entity('alert_events')
@Index(['alert_id', 'created_at'])
@Index(['actor_user_id', 'created_at'])
export class AlertEvent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    alert_id: number;

    @Column({
        type: 'enum',
        enum: AlertEventType,
    })
    event_type: AlertEventType;

    @Column({ type: 'varchar', length: 30, nullable: true })
    previous_status: AlertStatus | null;

    @Column({ type: 'varchar', length: 30, nullable: true })
    new_status: AlertStatus | null;

    @Column({ type: 'int', nullable: true })
    actor_user_id: number | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'jsonb', nullable: true })
    payload: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Alert, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'alert_id' })
    alert: Alert;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'actor_user_id' })
    actor: User | null;
}
