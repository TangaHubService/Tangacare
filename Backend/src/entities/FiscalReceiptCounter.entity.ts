import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fiscal_receipt_counters')
@Index(['facility_id', 'receipt_label'], { unique: true })
export class FiscalReceiptCounter {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'varchar', length: 2 })
    receipt_label: string;

    @Column({ type: 'bigint', default: 0 })
    current_value: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_issued_at: Date | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
