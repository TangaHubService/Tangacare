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

export enum SubscriptionPaymentStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
}

export enum SubscriptionPaymentGateway {
    PAYPACK = 'paypack',
}

export enum SubscriptionPaymentKind {
    CASHIN = 'CASHIN',
}

@Entity('subscription_payments')
export class SubscriptionPayment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    @Index()
    subscription_id: number;

    @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'subscription_id' })
    subscription: Subscription;

    @Column({ type: 'int' })
    amount_rwf: number;

    @Column({ type: 'varchar', length: 3, default: 'RWF' })
    currency: string;

    @Column({ type: 'enum', enum: SubscriptionPaymentGateway })
    gateway: SubscriptionPaymentGateway;

    @Column({ type: 'varchar', length: 100, unique: true })
    @Index({ unique: true })
    gateway_ref: string;

    @Column({ type: 'enum', enum: SubscriptionPaymentStatus, default: SubscriptionPaymentStatus.PENDING })
    status: SubscriptionPaymentStatus;

    @Column({ type: 'enum', enum: SubscriptionPaymentKind, default: SubscriptionPaymentKind.CASHIN })
    kind: SubscriptionPaymentKind;

    @Column({ type: 'varchar', length: 50, nullable: true })
    provider: string | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    paid_at: Date | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}

