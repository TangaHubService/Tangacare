import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payment_gateways')
export class PaymentGateway {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    @Index({ unique: true })
    code: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'jsonb', nullable: true })
    config_json: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}

