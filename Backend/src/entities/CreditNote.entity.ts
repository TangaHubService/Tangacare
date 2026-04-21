import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Sale } from './Sale.entity';
import { Organization } from './Organization.entity';

@Entity('credit_notes')
@Index(['sale_id'])
@Index(['organization_id'])
export class CreditNote {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    note_number: string;

    @Column({ type: 'int' })
    sale_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'text', nullable: true })
    reason: string | null;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    fiscal_status: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ebm_reference: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    ebm_receipt_number: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    vsdc_internal_data: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    vsdc_receipt_signature: string | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    vsdc_receipt_published_at: Date | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    vsdc_sdc_id: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sale_id' })
    sale: Sale;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
