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
import { Sale } from './Sale.entity';
import { InsuranceProvider } from './InsuranceProvider.entity';
import { Organization } from './Organization.entity';

export enum InsuranceClaimStatus {
    PENDING = 'pending',
    SUBMITTED = 'submitted',
    APPROVED = 'approved',
    PARTIALLY_APPROVED = 'partially_approved',
    REJECTED = 'rejected',
    PAID = 'paid',
}

@Entity('insurance_claims')
@Index(['sale_id'])
@Index(['provider_id'])
@Index(['status'])
@Index(['organization_id'])
export class InsuranceClaim {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', unique: true })
    sale_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    claim_number: string;

    @Column({ type: 'int' })
    provider_id: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    patient_insurance_number: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    total_amount: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    applied_coverage_percentage: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    expected_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    copay_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    actual_received_amount: number;

    /** Amount approved by insurer (may differ from expected before payment is received). */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    approved_amount: number;

    @Column({
        type: 'enum',
        enum: InsuranceClaimStatus,
        default: InsuranceClaimStatus.PENDING,
    })
    status: InsuranceClaimStatus;

    @Column({ type: 'text', nullable: true })
    rejection_reason: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    submitted_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    processed_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sale_id' })
    sale: Sale;

    @ManyToOne(() => InsuranceProvider, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'provider_id' })
    provider: InsuranceProvider;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
