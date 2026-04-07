import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { Facility } from './Facility.entity';
import { User } from './User.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { Organization } from './Organization.entity';

export enum DisposalStatus {
    DRAFT = 'draft',
    SUBMITTED = 'submitted',
    APPROVED = 'approved',
    POSTED = 'posted',
    VOIDED = 'voided',
}

export enum DisposalType {
    REGULAR = 'regular',
    CONTROLLED = 'controlled',
}

export enum DisposalReason {
    EXPIRED = 'expired',
    DAMAGED = 'damaged',
    RECALLED = 'recalled',
    QUALITY_ISSUE = 'quality_issue',
    OTHER = 'other',
}

@Entity('disposal_requests')
@Index(['facility_id', 'status'])
@Index(['request_number'], { unique: true })
@Index(['created_at'])
export class DisposalRequest {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    request_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    created_by_id: number;

    @Column({ type: 'int', nullable: true })
    approved_by_id: number;

    @Column({ type: 'int', nullable: true })
    witness_by_id: number;

    @Column({
        type: 'enum',
        enum: DisposalStatus,
        default: DisposalStatus.DRAFT,
    })
    status: DisposalStatus;

    @Column({
        type: 'enum',
        enum: DisposalType,
        default: DisposalType.REGULAR,
    })
    type: DisposalType;

    @Column({
        type: 'enum',
        enum: DisposalReason,
        default: DisposalReason.OTHER,
    })
    reason: DisposalReason;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    total_value: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    approved_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    posted_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    // Relations
    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by_id' })
    created_by: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approved_by_id' })
    approved_by: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'witness_by_id' })
    witness_by: User;

    @OneToMany(() => DisposalItem, (item) => item.disposal_request, { cascade: true })
    items: DisposalItem[];
}

@Entity('disposal_items')
@Index(['disposal_request_id'])
@Index(['medicine_id'])
@Index(['batch_id'])
export class DisposalItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    disposal_request_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    unit_cost: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    line_value: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    // Relations
    @ManyToOne(() => DisposalRequest, (dr) => dr.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'disposal_request_id' })
    disposal_request: DisposalRequest;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch)
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
