import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum PaymentAttemptStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
}

@Entity('payment_attempts')
export class PaymentAttempt {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    @Index()
    subscription_id: number;

    @Column({ type: 'int' })
    amount_rwf: number;

    @Column({ type: 'varchar', length: 20 })
    phone_number: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    provider: string | null;

    @Column({ type: 'varchar', length: 32 })
    @Index()
    idempotency_key: string;

    @Column({ type: 'enum', enum: PaymentAttemptStatus, default: PaymentAttemptStatus.PENDING })
    status: PaymentAttemptStatus;

    @Column({ type: 'varchar', length: 255, nullable: true })
    failure_reason: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    transaction_ref: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    attempted_at: Date;
}

