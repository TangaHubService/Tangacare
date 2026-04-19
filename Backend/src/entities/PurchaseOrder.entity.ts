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
import { Supplier } from './Supplier.entity';
import { User } from './User.entity';
import { Medicine } from './Medicine.entity';
import { Organization } from './Organization.entity';
import { PurchaseOrderActivity } from './PurchaseOrderActivity.entity';

/**
 * PO lifecycle (simplified):
 * - Internal: draft → pending (submitted) → approved → received/partially_received/cancelled.
 * - Supplier quote path: submitted → quoted / partially_quoted → accepted / partially_accepted → received…
 * - Legacy aliases: pending/approved/confirmed map to the same gates as pending/approved in services.
 * Use ProcurementService (submitOrder, approveOrder, receive, quote/review) as the single transition API.
 */
export enum PurchaseOrderStatus {
    DRAFT = 'draft',
    PENDING = 'pending', // Legacy support
    SUBMITTED = 'submitted',
    QUOTED = 'quoted',
    PARTIALLY_QUOTED = 'partially_quoted',
    APPROVED = 'approved', // Legacy support
    ACCEPTED = 'accepted',
    PARTIALLY_ACCEPTED = 'partially_accepted',
    REJECTED = 'rejected',
    CONFIRMED = 'confirmed', // Legacy support
    CANCELLED = 'cancelled',
    PARTIALLY_RECEIVED = 'partially_received',
    RECEIVED = 'received',
    BACKORDERED = 'backordered',
}

@Entity('purchase_orders')
@Index(['organization_id'])
export class PurchaseOrder {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    order_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    supplier_id: number;

    @Column({ type: 'int' })
    created_by_id: number;

    @Column({
        type: 'enum',
        enum: PurchaseOrderStatus,
        default: PurchaseOrderStatus.DRAFT,
    })
    status: PurchaseOrderStatus;

    @Column({ type: 'date', nullable: true })
    order_date: Date;

    @Column({ type: 'date', nullable: true })
    expected_delivery_date: Date;

    @Column({ type: 'date', nullable: true })
    received_date: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    submitted_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    quoted_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    accepted_at: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    subtotal_amount: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    discount_percent: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    discount_amount: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    vat_rate: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    vat_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    total_amount: number;

    // ── Landed Costs ──────────────────────────────────────────────────────────
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    shipping_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    tariff_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    handling_fee: number;

    /** Sum of shipping_cost + tariff_amount + handling_fee, stored for quick reference. */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    landed_cost_total: number;
    // ─────────────────────────────────────────────────────────────────────────

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, (facility) => facility.purchase_orders, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Supplier, (supplier) => supplier.purchase_orders)
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by_id' })
    created_by: User;

    @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    @Column({ type: 'varchar', length: 100, nullable: true })
    token: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    token_expires_at: Date;

    /** Latest posted goods receipt for this PO (receiving traceability). */
    @Column({ type: 'int', nullable: true })
    last_goods_receipt_id: number | null;

    @Column({ type: 'boolean', default: false })
    is_viewed_by_supplier: boolean;

    @OneToMany(() => PurchaseOrderActivity, (activity) => activity.purchase_order)
    activities: PurchaseOrderActivity[];

    @OneToMany(() => PurchaseOrderItem, (item) => item.purchase_order, { cascade: true })
    items: PurchaseOrderItem[];
}

export enum PurchaseOrderItemStatus {
    PENDING = 'pending',
    QUOTED = 'quoted',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
}

@Entity('purchase_order_items')
@Index(['purchase_order_id'])
@Index(['organization_id'])
export class PurchaseOrderItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    purchase_order_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    quantity_ordered: number;

    @Column({ type: 'int', default: 0 })
    quantity_received: number;

    @Column({ type: 'int', default: 0 })
    backorder_qty: number;

    @Column({ type: 'int', default: 0 })
    remaining_qty: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    quoted_unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    accepted_unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    selling_price: number;

    @Column({
        type: 'enum',
        enum: PurchaseOrderItemStatus,
        default: PurchaseOrderItemStatus.PENDING,
    })
    status: PurchaseOrderItemStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    total_price: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    /** Snapshot from the most recent physical receipt line (QC / variance). */
    @Column({ type: 'boolean', nullable: true })
    last_receipt_qc_pass: boolean | null;

    @Column({ type: 'int', nullable: true })
    last_receipt_variance_qty: number | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'purchase_order_id' })
    purchase_order: PurchaseOrder;

    @ManyToOne(() => Medicine, (medicine) => medicine.purchase_order_items)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
