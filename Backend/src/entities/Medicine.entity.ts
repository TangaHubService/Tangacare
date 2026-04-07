import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Batch } from './Batch.entity';
import { DispenseTransaction } from './DispenseTransaction.entity';
import { PurchaseOrderItem } from './PurchaseOrder.entity';
import { MedicineCategory } from './MedicineCategory.entity';
import { Stock } from './Stock.entity';
import { Organization } from './Organization.entity';

export enum DosageForm {
    TABLET = 'tablet',
    CAPSULE = 'capsule',
    SYRUP = 'syrup',
    INJECTION = 'injection',
    OINTMENT = 'ointment',
    DROPS = 'drops',
    INHALER = 'inhaler',
    PATCH = 'patch',
    OTHER = 'other',
}

export enum DrugSchedule {
    UNCLASSIFIED = 'unclassified',
    PRESCRIPTION_ONLY = 'prescription_only',
    CONTROLLED_SUBSTANCE_SCH_II = 'controlled_substance_sch_ii',
    CONTROLLED_SUBSTANCE_SCH_III = 'controlled_substance_sch_iii',
    CONTROLLED_SUBSTANCE_SCH_IV = 'controlled_substance_sch_iv',
    PHARMACIST_ONLY = 'pharmacist_only',
}

@Entity('medicines')
@Index(['code', 'organization_id'], { unique: true })
@Index(['barcode', 'organization_id'], { unique: true, where: 'barcode IS NOT NULL' })
@Index(['normalized_name', 'organization_id'], {
    unique: true,
    where: '"organization_id" IS NOT NULL AND "normalized_name" IS NOT NULL',
})
@Index(['name', 'organization_id'])
@Index(['organization_id'])
export class Medicine {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    code: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    barcode: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    normalized_name: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    brand_name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    strength: string;

    @Column({
        type: 'enum',
        enum: DosageForm,
    })
    dosage_form: DosageForm;

    @Column({ type: 'varchar', length: 50, nullable: true })
    unit: string;

    @Column({ type: 'text', nullable: true })
    storage_conditions: string;

    @Column({ type: 'boolean', default: false })
    is_controlled_drug: boolean;

    @Column({
        type: 'enum',
        enum: DrugSchedule,
        default: DrugSchedule.UNCLASSIFIED,
    })
    drug_schedule: DrugSchedule;

    @Column({ type: 'text', nullable: true })
    description: string;

    // Cost price removed - tracked at Batch/Stock level

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    selling_price: number; // Base selling price (referential)

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    markup_percent: number;

    // Inventory settings (Global defaults - can be overridden per facility in future)
    @Column({ type: 'int', default: 0 })
    min_stock_level: number;

    @Column({ type: 'int', default: 0 })
    target_stock_level: number;

    @Column({ type: 'int', default: 7 })
    lead_time_days: number;

    @Column({ type: 'int', default: 0 })
    safety_stock_quantity: number;

    @Column({ type: 'int', nullable: true })
    reorder_point: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    avg_daily_consumption: number;

    @Column({ type: 'boolean', default: false })
    is_critical_medicine: boolean;

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_consumption_calculated_at: Date;

    @Column({ type: 'int', nullable: true, default: 1 })
    units_per_package: number; // How many base units in one package (e.g., 10 tablets per blister)

    @Column({ type: 'varchar', length: 50, nullable: true })
    base_unit: string; // Smallest sellable unit (e.g., "tablet", "ml", "capsule")

    @Column({ type: 'boolean', default: false })
    allow_partial_sales: boolean; // Can sell individual units from a package?

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @OneToMany(() => Batch, (batch) => batch.medicine)
    batches: Batch[];

    @OneToMany(() => DispenseTransaction, (dispense) => dispense.medicine)
    dispense_transactions: DispenseTransaction[];

    @OneToMany(() => PurchaseOrderItem, (item) => item.medicine)
    purchase_order_items: PurchaseOrderItem[];

    @Column({ type: 'int', nullable: true })
    category_id: number | null;

    @Column({ type: 'int', nullable: true })
    organization_id: number | null;

    @ManyToOne(() => MedicineCategory, (cat) => cat.medicines, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'category_id' })
    category: MedicineCategory | null;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;

    @OneToMany(() => Stock, (stock) => stock.medicine)
    stocks: Stock[];
}
