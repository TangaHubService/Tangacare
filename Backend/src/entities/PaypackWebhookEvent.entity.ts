import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('paypack_webhook_events')
export class PaypackWebhookEvent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    @Index({ unique: true })
    event_id: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    kind: string | null;

    @Column({ type: 'boolean', default: false })
    signature_valid: boolean;

    @Column({ type: 'jsonb', nullable: true })
    payload: any | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    received_at: Date;
}

