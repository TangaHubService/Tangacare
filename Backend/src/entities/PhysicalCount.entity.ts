import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { Facility } from './Facility.entity';
import { User } from './User.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { StorageLocation } from './StorageLocation.entity';
import { Organization } from './Organization.entity';

export enum PhysicalCountStatus {
    IN_PROGRESS = 'in_progress',
    FROZEN = 'frozen',
    COMPLETED = 'completed',
    APPROVED = 'approved',
    CANCELLED = 'cancelled',
}

@Entity('physical_counts')
@Index(['organization_id'])
export class PhysicalCount {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'date' })
    count_date: Date;

    @Column({
        type: 'enum',
        enum: PhysicalCountStatus,
        default: PhysicalCountStatus.IN_PROGRESS,
    })
    status: PhysicalCountStatus;

    @Column({ type: 'int' })
    counted_by_id: number;

    @Column({ type: 'int', nullable: true })
    approved_by_id: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    approved_at: Date;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'counted_by_id' })
    counted_by: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approved_by_id' })
    approved_by: User;

    @OneToMany(() => PhysicalCountItem, (item) => item.physical_count, { cascade: true })
    items: PhysicalCountItem[];

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

@Entity('physical_count_items')
@Index(['physical_count_id'])
@Index(['organization_id'])
export class PhysicalCountItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    physical_count_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int', nullable: true })
    location_id: number | null;

    @Column({ type: 'int' })
    system_quantity: number;

    @Column({ type: 'int' })
    counted_quantity: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    variance: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => PhysicalCount, (count) => count.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'physical_count_id' })
    physical_count: PhysicalCount;

    @ManyToOne(() => Medicine, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => StorageLocation, { nullable: true })
    @JoinColumn({ name: 'location_id' })
    location: StorageLocation;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
