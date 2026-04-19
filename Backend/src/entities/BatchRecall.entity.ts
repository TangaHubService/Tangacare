import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Facility } from './Facility.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { User } from './User.entity';
import { Organization } from './Organization.entity';

export enum RecallStatus {
    INITIATED = 'initiated',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export enum RecallReason {
    QUALITY_ISSUE = 'quality_issue',
    CONTAMINATION = 'contamination',
    REGULATORY = 'regulatory',
    EXPIRY = 'expiry',
    COUNTERFEIT = 'counterfeit',
    OTHER = 'other',
}

/** Rwanda-style recall classes (regulatory response timelines). */
export enum RecallClass {
    CLASS_I = 'class_i',
    CLASS_II = 'class_ii',
    CLASS_III = 'class_iii',
}

@Entity('batch_recalls')
@Index(['organization_id'])
export class BatchRecall {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    facility_id!: number;

    @Column({ nullable: true })
    organization_id?: number;

    @ManyToOne(() => Facility)
    @JoinColumn({ name: 'facility_id' })
    facility!: Facility;

    @Column()
    batch_id!: number;

    @ManyToOne(() => Batch)
    @JoinColumn({ name: 'batch_id' })
    batch!: Batch;

    @Column()
    medicine_id!: number;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine!: Medicine;

    @Column({ type: 'varchar', length: 100, unique: true })
    recall_number!: string;

    @Column({ type: 'enum', enum: RecallReason })
    reason!: RecallReason;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'enum', enum: RecallClass, nullable: true })
    recall_class?: RecallClass | null;

    @Column({ type: 'timestamptz', nullable: true })
    regulatory_due_at?: Date | null;

    @Column({ type: 'text', nullable: true })
    closure_reconciliation_note?: string | null;

    @Column({ type: 'enum', enum: RecallStatus, default: RecallStatus.INITIATED })
    status!: RecallStatus;

    @Column({ type: 'int', default: 0 })
    affected_sales_count!: number;

    @Column({ type: 'int', default: 0 })
    affected_quantity!: number;

    @Column({ type: 'int', default: 0 })
    recovered_quantity!: number;

    @Column({ type: 'int', default: 0 })
    remaining_stock!: number;

    @Column({ type: 'text', nullable: true })
    action_taken?: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ nullable: true })
    initiated_by_id?: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'initiated_by_id' })
    initiated_by?: User;

    @Column({ nullable: true })
    completed_by_id?: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'completed_by_id' })
    completed_by?: User;

    @Column({ type: 'timestamp' })
    initiated_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    completed_at?: Date;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization?: Organization;
}
