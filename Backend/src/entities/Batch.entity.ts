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
import { Medicine } from './Medicine.entity';
import { Stock } from './Stock.entity';
import { DispenseTransaction } from './DispenseTransaction.entity';
import { Facility } from './Facility.entity';
import { Organization } from './Organization.entity';
import { Supplier } from './Supplier.entity';

@Entity('batches')
@Index('IDX_batch_facility_medicine_number_unique', ['facility_id', 'medicine_id', 'batch_number'], {
    unique: true,
    where: '"facility_id" IS NOT NULL',
})
@Index('IDX_batches_medicine_batch_number', ['medicine_id', 'batch_number'])
@Index('IDX_batches_facility_id', ['facility_id'])
@Index('IDX_batches_organization_id', ['organization_id'])
@Index('IDX_batches_supplier_id', ['supplier_id'])
export class Batch {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int', nullable: true })
    facility_id: number | null;

    @Column({ type: 'int', nullable: true })
    organization_id: number | null;

    @Column({ type: 'int', nullable: true })
    supplier_id: number | null;

    @Column({ type: 'varchar', length: 100 })
    batch_number: string;

    @Column({ type: 'date' })
    expiry_date: Date;

    @Column({ type: 'date' })
    manufacturing_date: Date;

    @Column({ type: 'int', default: 0 })
    initial_quantity: number;

    @Column({ type: 'int', default: 0 })
    current_quantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_price: number;

    @Column({ type: 'int', nullable: true })
    purchase_order_item_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    supplier: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Medicine, (medicine) => medicine.batches, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Facility, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility | null;

    @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;

    @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'supplier_id' })
    supplier_entity: Supplier | null;

    @OneToMany(() => Stock, (stock) => stock.batch)
    stocks: Stock[];

    @OneToMany(() => DispenseTransaction, (dispense) => dispense.batch)
    dispense_transactions: DispenseTransaction[];
}
