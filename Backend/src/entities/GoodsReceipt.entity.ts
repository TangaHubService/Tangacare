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
import { PurchaseOrder, PurchaseOrderItem } from './PurchaseOrder.entity';
import { Facility } from './Facility.entity';
import { User } from './User.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';

@Entity('goods_receipts')
@Index(['facility_id', 'created_at'])
@Index(['purchase_order_id'])
export class GoodsReceipt {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    receipt_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    purchase_order_id: number;

    @Column({ type: 'int' })
    received_by_id: number;

    @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
    received_date: Date;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    // Relations
    @ManyToOne(() => PurchaseOrder)
    @JoinColumn({ name: 'purchase_order_id' })
    purchase_order: PurchaseOrder;

    @ManyToOne(() => Facility)
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'received_by_id' })
    received_by: User;

    @OneToMany(() => GoodsReceiptItem, (item) => item.goods_receipt, { cascade: true })
    items: GoodsReceiptItem[];
}

@Entity('goods_receipt_items')
@Index(['goods_receipt_id'])
@Index(['medicine_id'])
export class GoodsReceiptItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    goods_receipt_id: number;

    @Column({ type: 'int' })
    purchase_order_item_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int' })
    quantity_received: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_cost: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    batch_number: string;

    @Column({ type: 'date', nullable: true })
    expiry_date: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    // Relations
    @ManyToOne(() => GoodsReceipt, (gr) => gr.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'goods_receipt_id' })
    goods_receipt: GoodsReceipt;

    @ManyToOne(() => PurchaseOrderItem)
    @JoinColumn({ name: 'purchase_order_item_id' })
    purchase_order_item: PurchaseOrderItem;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch)
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;
}
