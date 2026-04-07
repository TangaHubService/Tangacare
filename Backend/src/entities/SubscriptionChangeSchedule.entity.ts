import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Subscription } from './Subscription.entity';
import { SubscriptionPlan } from './SubscriptionPlan.entity';

export enum SubscriptionChangeScheduleStatus {
    PENDING = 'pending',
    APPLIED = 'applied',
    CANCELLED = 'cancelled',
}

@Entity('subscription_change_schedules')
export class SubscriptionChangeSchedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    @Index()
    subscription_id: number;

    @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'subscription_id' })
    subscription: Subscription;

    @Column({ type: 'int' })
    from_plan_id: number;

    @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'from_plan_id' })
    from_plan: SubscriptionPlan;

    @Column({ type: 'int' })
    to_plan_id: number;

    @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'to_plan_id' })
    to_plan: SubscriptionPlan;

    @Column({ type: 'timestamp with time zone' })
    effective_date: Date;

    @Column({ type: 'enum', enum: SubscriptionChangeScheduleStatus, default: SubscriptionChangeScheduleStatus.PENDING })
    status: SubscriptionChangeScheduleStatus;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}

