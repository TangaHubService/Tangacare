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

export enum VarianceStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export enum VarianceType {
    PHYSICAL_COUNT = 'physical_count',
    CYCLE_COUNT = 'cycle_count',
    ANNUAL_COUNT = 'annual_count',
}

@Entity('stock_variances')
@Index(['facility_id', 'created_at'])
@Index(['organization_id'])
export class StockVariance {
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
    medicine_id!: number;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine!: Medicine;

    @Column({ nullable: true })
    batch_id?: number;

    @ManyToOne(() => Batch, { nullable: true })
    @JoinColumn({ name: 'batch_id' })
    batch?: Batch;

    @Column({ type: 'int' })
    system_quantity!: number;

    @Column({ type: 'int' })
    physical_quantity!: number;

    @Column({ type: 'int' })
    variance_quantity!: number; // physical - system

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_cost?: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    variance_value?: number; // variance_quantity * unit_cost

    @Column({ type: 'enum', enum: VarianceType, default: VarianceType.PHYSICAL_COUNT })
    variance_type!: VarianceType;

    @Column({ type: 'enum', enum: VarianceStatus, default: VarianceStatus.PENDING })
    status!: VarianceStatus;

    @Column({ type: 'text', nullable: true })
    reason?: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ nullable: true })
    counted_by_id?: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'counted_by_id' })
    counted_by?: User;

    @Column({ nullable: true })
    approved_by_id?: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approved_by_id' })
    approved_by?: User;

    @Column({ type: 'timestamp', nullable: true })
    approved_at?: Date;

    @Column({ type: 'timestamp', nullable: true })
    counted_at?: Date;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization?: Organization;
}
