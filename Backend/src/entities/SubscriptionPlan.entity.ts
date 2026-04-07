import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum SubscriptionPlanCode {
    STARTER = 'starter',
    PRO = 'pro',
    BUSINESS = 'business',
    ENTERPRISE = 'enterprise',
    TEST = 'test',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    @Index({ unique: true })
    plan_code: SubscriptionPlanCode;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    // In RWF per month
    @Column({ type: 'int', nullable: true })
    price_rwf_monthly: number | null;

    @Column({ type: 'int', default: 7 })
    trial_days: number;

    // null => unlimited
    @Column({ type: 'int', nullable: true })
    max_users: number | null;

    // null => unlimited
    @Column({ type: 'int', nullable: true })
    max_facilities: number | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}

