import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { SubscriptionPlan } from './SubscriptionPlan.entity';

@Entity('plan_features')
export class PlanFeature {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    @Index()
    plan_id: number;

    @ManyToOne(() => SubscriptionPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id' })
    plan: SubscriptionPlan;

    @Column({ type: 'varchar', length: 100 })
    @Index()
    key: string;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @Column({ type: 'int', nullable: true })
    limit_value: number | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}

