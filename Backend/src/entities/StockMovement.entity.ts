import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Facility } from './Facility.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { User } from './User.entity';
import { StorageLocation } from './StorageLocation.entity';
import { Organization } from './Organization.entity';

export enum StockMovementType {
    IN = 'in',
    OUT = 'out',
    ADJUSTMENT = 'adjustment',
    TRANSFER_IN = 'transfer_in',
    TRANSFER_OUT = 'transfer_out',
    RETURN = 'return',
}

export enum AdjustmentReason {
    PHYSICAL_COUNT = 'physical_count',
    DAMAGE = 'damage',
    EXPIRY = 'expiry',
    THEFT = 'theft',
    LOSS = 'loss',
    FOUND = 'found',
    CORRECTION = 'correction',
    TRANSFER = 'transfer',
    RETURN_TO_SUPPLIER = 'return_to_supplier',
    CUSTOMER_RETURN = 'customer_return',
    SAMPLE = 'sample',
    DONATION = 'donation',
    OTHER = 'other',
}

@Entity('stock_movements')
@Index(['facility_id', 'created_at'])
@Index(['medicine_id', 'created_at'])
@Index(['batch_id', 'created_at'])
@Index(['location_id', 'created_at'])
@Index(['reference_type', 'reference_id'])
@Index(['organization_id'])
export class StockMovement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    location_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({
        type: 'enum',
        enum: StockMovementType,
    })
    type: StockMovementType;

    @Column({
        type: 'enum',
        enum: AdjustmentReason,
        nullable: true,
    })
    reason: AdjustmentReason;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'int' })
    previous_balance: number;

    @Column({ type: 'int' })
    new_balance: number;

    @Column({ type: 'varchar', length: 50, nullable: true })
    reference_type: string;

    @Column({ type: 'int', nullable: true })
    reference_id: number;

    @Column({ type: 'int', nullable: true })
    user_id: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Facility)
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch)
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => StorageLocation, { nullable: true })
    @JoinColumn({ name: 'location_id' })
    location: StorageLocation;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
