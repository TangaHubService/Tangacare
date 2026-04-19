import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    DeleteDateColumn,
    Index,
} from 'typeorm';
import { PurchaseOrder } from './PurchaseOrder.entity';
import { Facility } from './Facility.entity';
import { Organization } from './Organization.entity';

export enum SupplierQualificationStatus {
    QUALIFIED = 'qualified',
    PENDING = 'pending',
    SUSPENDED = 'suspended',
}

@Entity('suppliers')
@Index(['organization_id', 'facility_id'])
export class Supplier {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    contact_person: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string;

    @Column({ type: 'text', nullable: true })
    address: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    tax_id: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    category: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    country: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    payment_terms: string;

    @Column({ type: 'int', nullable: true })
    priority: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({
        type: 'enum',
        enum: SupplierQualificationStatus,
        default: SupplierQualificationStatus.QUALIFIED,
    })
    qualification_status: SupplierQualificationStatus;

    @Column({ type: 'date', nullable: true })
    qualification_expires_at: Date | null;

    @Column({ type: 'varchar', length: 512, nullable: true })
    licence_document_url: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @Column({ type: 'int', nullable: true })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
    deleted_at: Date;

    @OneToMany(() => PurchaseOrder, (po) => po.supplier)
    purchase_orders: PurchaseOrder[];

    @ManyToOne(() => Facility, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
