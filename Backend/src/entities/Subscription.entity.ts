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
import { Organization } from './Organization.entity';
import { SubscriptionPlan } from './SubscriptionPlan.entity';

export enum SubscriptionStatus {
    TRIALING = 'trialing',
    ACTIVE = 'active',
    PAST_DUE = 'past_due',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    @Index()
    organization_id: number;

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    @Column({ type: 'int' })
    @Index()
    subscription_plan_id: number;

    @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'subscription_plan_id' })
    subscription_plan: SubscriptionPlan;

    @Column({ type: 'enum', enum: SubscriptionStatus })
    status: SubscriptionStatus;

    // Billing period length in months.
    // Example: 1 => monthly, 12 => yearly (prepaid).
    @Column({ type: 'int', default: 1 })
    billing_period_months: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    trial_end_at: Date | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    current_period_end_at: Date | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    next_billing_at: Date | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    cancelled_at: Date | null;

    // phone used for Paypack cash-in; stored for renewals
    @Column({ type: 'varchar', length: 20 })
    paypack_phone_number: string;

    // UI preference label (MTN MoMo vs Mobile Money)
    @Column({ type: 'varchar', length: 50, nullable: true })
    payment_method_preference: string | null;

    @Column({ type: 'int', default: 0 })
    billing_attempts: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}

