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
import { PurchaseOrder } from './PurchaseOrder.entity';
import { Supplier } from './Supplier.entity';
import { Facility } from './Facility.entity';
import { User } from './User.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { Organization } from './Organization.entity';

export enum VendorReturnStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    COMPLETED = 'completed',
}

export enum VendorReturnReason {
    EXPIRED = 'expired',
    DAMAGED_ARRIVAL = 'damaged_arrival',
    WRONG_ITEM = 'wrong_item',
    OVERSTOCKED = 'overstocked',
    QUALITY_ISSUE = 'quality_issue',
    OTHER = 'other',
}

@Entity('vendor_returns')
@Index(['facility_id', 'status'])
@Index(['purchase_order_id'])
@Index(['supplier_id'])
@Index(['created_at'])
export class VendorReturn {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    return_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    purchase_order_id: number;

    @Column({ type: 'int' })
    supplier_id: number;

    @Column({ type: 'int' })
    created_by_id: number;

    @Column({ type: 'int', nullable: true })
    approved_by_id: number;

    @Column({
        type: 'enum',
        enum: VendorReturnStatus,
        default: VendorReturnStatus.PENDING,
    })
    status: VendorReturnStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    total_credit_amount: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    credit_note_number: string;

    @Column({ type: 'text', nullable: true })
    reason: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    approved_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    // Relations
    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Supplier)
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

    @ManyToOne(() => PurchaseOrder, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'purchase_order_id' })
    purchase_order: PurchaseOrder;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by_id' })
    created_by: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approved_by_id' })
    approved_by: User;

    @OneToMany(() => VendorReturnItem, (item) => item.vendor_return, { cascade: true })
    items: VendorReturnItem[];

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

@Entity('vendor_return_items')
@Index(['vendor_return_id'])
@Index(['medicine_id'])
@Index(['batch_id'])
export class VendorReturnItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    vendor_return_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int' })
    quantity_returned: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    unit_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    line_credit_amount: number;

    @Column({
        type: 'enum',
        enum: VendorReturnReason,
        default: VendorReturnReason.OTHER,
    })
    reason: VendorReturnReason;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    // Relations
    @ManyToOne(() => VendorReturn, (vr) => vr.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'vendor_return_id' })
    vendor_return: VendorReturn;

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
