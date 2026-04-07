import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 50 })
    gateway: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    @Index({ unique: true })
    event_id: string;

    @Column({ type: 'varchar', length: 100 })
    event_type: string;

    @Column({ type: 'boolean', default: false })
    signature_valid: boolean;

    @Column({ type: 'jsonb', nullable: true })
    payload: any | null;

    @Column({ type: 'boolean', default: false })
    processed: boolean;

    @Column({ type: 'timestamp with time zone', nullable: true })
    processed_at: Date | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;
}

