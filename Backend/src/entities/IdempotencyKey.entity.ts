import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum IdempotencyStatus {
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
}

@Entity('idempotency_keys')
@Index(['idempotency_key'], { unique: true })
@Index(['expires_at'])
export class IdempotencyKey {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255, unique: true })
    idempotency_key: string;

    @Column({ type: 'varchar', length: 100 })
    namespace: string;

    @Column({ type: 'int', nullable: true })
    facility_id: number | null;

    @Column({ type: 'int', nullable: true })
    user_id: number | null;

    @Column({
        type: 'enum',
        enum: IdempotencyStatus,
        default: IdempotencyStatus.IN_PROGRESS,
    })
    status: IdempotencyStatus;

    @Column({ type: 'int', nullable: true })
    status_code: number | null;

    @Column({ type: 'jsonb', nullable: true })
    response_body: any | null;

    @Column({ type: 'timestamp with time zone' })
    expires_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
