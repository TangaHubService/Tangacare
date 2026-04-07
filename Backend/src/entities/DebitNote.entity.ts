import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Sale } from './Sale.entity';
import { Organization } from './Organization.entity';

@Entity('debit_notes')
@Index(['sale_id'])
@Index(['organization_id'])
export class DebitNote {
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
    reason: string;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    fiscal_status: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ebm_reference: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sale_id' })
    sale: Sale;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
