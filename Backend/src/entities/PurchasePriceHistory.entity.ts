import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Medicine } from './Medicine.entity';
import { Supplier } from './Supplier.entity';
import { Organization } from './Organization.entity';
import { PurchaseOrder } from './PurchaseOrder.entity';

@Entity('purchase_price_history')
@Index(['organization_id'])
@Index(['supplier_id', 'medicine_id'])
export class PurchasePriceHistory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    organization_id: number;

    @Column({ type: 'int' })
    supplier_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    purchase_order_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    quoted_unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    accepted_unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    selling_price: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Organization)
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    @ManyToOne(() => Supplier)
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

    @ManyToOne(() => Medicine)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => PurchaseOrder)
    @JoinColumn({ name: 'purchase_order_id' })
    purchase_order: PurchaseOrder;
}
