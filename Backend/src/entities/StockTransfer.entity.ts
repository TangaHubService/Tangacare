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
import { Department } from './Department.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { User } from './User.entity';
import { StorageLocation } from './StorageLocation.entity';
import { Organization } from './Organization.entity';

export enum StockTransferStatus {
    PENDING = 'pending',
    IN_TRANSIT = 'in_transit',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

@Entity('stock_transfers')
@Index(['facility_id', 'created_at'])
@Index(['organization_id'])
export class StockTransfer {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    transfer_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    from_department_id: number;

    @Column({ type: 'int', nullable: true })
    to_department_id: number;

    @Column({ type: 'int', nullable: true })
    from_location_id: number;

    @Column({ type: 'int', nullable: true })
    to_location_id: number;

    @Column({
        type: 'enum',
        enum: StockTransferStatus,
        default: StockTransferStatus.PENDING,
    })
    status: StockTransferStatus;

    @Column({ type: 'int' })
    initiated_by_id: number;

    @Column({ type: 'int', nullable: true })
    received_by_id: number;

    @Column({ type: 'date', nullable: true })
    transfer_date: Date;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility)
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Department, (dept) => dept.outgoing_transfers, { nullable: true })
    @JoinColumn({ name: 'from_department_id' })
    from_department: Department;

    @ManyToOne(() => Department, (dept) => dept.incoming_transfers, { nullable: true })
    @JoinColumn({ name: 'to_department_id' })
    to_department: Department;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'initiated_by_id' })
    initiated_by: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'received_by_id' })
    received_by: User;

    @ManyToOne(() => StorageLocation, { nullable: true })
    @JoinColumn({ name: 'from_location_id' })
    from_location: StorageLocation;

    @ManyToOne(() => StorageLocation, { nullable: true })
    @JoinColumn({ name: 'to_location_id' })
    to_location: StorageLocation;

    @OneToMany(() => StockTransferItem, (item) => item.transfer, { cascade: true })
    items: StockTransferItem[];

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

@Entity('stock_transfer_items')
@Index(['transfer_id'])
@Index(['organization_id'])
export class StockTransferItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    transfer_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int', nullable: true })
    location_id: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => StockTransfer, (transfer) => transfer.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'transfer_id' })
    transfer: StockTransfer;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch)
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => StorageLocation, { nullable: true })
    @JoinColumn({ name: 'location_id' })
    location: StorageLocation;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
