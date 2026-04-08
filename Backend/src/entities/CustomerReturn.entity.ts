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
import { Sale, SaleItem } from './Sale.entity';
import { User } from './User.entity';
import { Facility } from './Facility.entity';
import { Organization } from './Organization.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { CreditNote } from './CreditNote.entity';

export enum ReturnStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    COMPLETED = 'completed',
    REJECTED = 'rejected',
}

export enum RefundMethod {
    CASH = 'cash',
    MOBILE_MONEY = 'mobile_money',
    CREDIT_NOTE = 'credit_note',
}

@Entity('customer_returns')
@Index(['sale_id'])
@Index(['facility_id'])
@Index(['status'])
@Index(['created_at'])
@Index(['organization_id'])
export class CustomerReturn {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    return_number: string;

    @Column({ type: 'int' })
    sale_id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    processed_by_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    total_refund_amount: number;

    @Column({ type: 'enum', enum: RefundMethod })
    refund_method: RefundMethod;

    @Column({ type: 'enum', enum: ReturnStatus, default: ReturnStatus.PENDING })
    status: ReturnStatus;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'int', nullable: true })
    approved_by_id: number | null;

    @Column({ type: 'timestamp', nullable: true })
    approved_at: Date | null;

    @Column({ type: 'int', nullable: true })
    rejected_by_id: number | null;

    @Column({ type: 'timestamp', nullable: true })
    rejected_at: Date | null;

    @Column({ type: 'text', nullable: true })
    rejection_reason: string | null;

    @Column({ type: 'int', nullable: true })
    credit_note_id: number | null;

    @Column({ type: 'int', nullable: true })
    refund_processed_by_id: number | null;

    @Column({ type: 'timestamp', nullable: true })
    refund_processed_at: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @ManyToOne(() => Sale)
    @JoinColumn({ name: 'sale_id' })
    sale: Sale;

    @ManyToOne(() => Facility)
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'processed_by_id' })
    processedBy: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approved_by_id' })
    approvedBy: User | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'rejected_by_id' })
    rejectedBy: User | null;

    @ManyToOne(() => CreditNote, { nullable: true })
    @JoinColumn({ name: 'credit_note_id' })
    creditNote: CreditNote | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'refund_processed_by_id' })
    refundProcessedBy: User | null;

    @OneToMany(() => CustomerReturnItem, (item) => item.return)
    items: CustomerReturnItem[];

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

export enum ReturnReason {
    EXPIRED = 'expired',
    DAMAGED = 'damaged',
    WRONG_ITEM = 'wrong_item',
    CUSTOMER_REQUEST = 'customer_request',
    ADVERSE_REACTION = 'adverse_reaction',
    OTHER = 'other',
}

export enum ItemCondition {
    RESELLABLE = 'resellable',
    DAMAGED = 'damaged',
    EXPIRED = 'expired',
}

@Entity('customer_return_items')
@Index(['return_id'])
@Index(['sale_item_id'])
@Index(['medicine_id'])
@Index(['organization_id'])
export class CustomerReturnItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    return_id: number;

    @Column({ type: 'int' })
    sale_item_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int' })
    quantity_returned: number;

    @Column({ type: 'enum', enum: ReturnReason })
    reason: ReturnReason;

    @Column({ type: 'enum', enum: ItemCondition })
    condition: ItemCondition;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    refund_amount: number;

    @Column({ type: 'boolean', default: false })
    restore_to_stock: boolean;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    created_at: Date;

    // Relations
    @ManyToOne(() => CustomerReturn, (ret) => ret.items)
    @JoinColumn({ name: 'return_id' })
    return: CustomerReturn;

    @ManyToOne(() => SaleItem, { nullable: false })
    @JoinColumn({ name: 'sale_item_id' })
    saleItem: SaleItem;

    @ManyToOne(() => Medicine, { nullable: false })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch, { nullable: false })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
