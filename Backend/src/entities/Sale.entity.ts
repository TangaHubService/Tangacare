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
import { User } from './User.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { Prescription } from './Prescription.entity';
import { InsuranceClaim } from './InsuranceClaim.entity';
import { Organization } from './Organization.entity';

export enum SaleStatus {
    PAID = 'paid',
    PARTIALLY_PAID = 'partially_paid',
    UNPAID = 'unpaid',
    VOIDED = 'voided',
}

export enum SalePaymentMethod {
    CASH = 'cash',
    MOBILE_MONEY = 'mobile_money',
    BANK = 'bank',
    CARD = 'card',
    INSURANCE = 'insurance',
}

export enum FiscalStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

@Entity('sales')
@Index(['facility_id', 'created_at'])
@Index(['organization_id'])
export class Sale {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    sale_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    patient_id: number;

    @Column({ type: 'int' })
    cashier_id: number;

    @Column({ type: 'int', nullable: true })
    prescription_id: number;

    @Column({ type: 'varchar', length: 50, nullable: true })
    patient_id_type: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    patient_id_number: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    subtotal: number;

    @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.18 })
    vat_rate: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    vat_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    total_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    paid_amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    balance_amount: number;

    @Column({
        type: 'enum',
        enum: SaleStatus,
        default: SaleStatus.UNPAID,
    })
    status: SaleStatus;

    @Column({ type: 'varchar', length: 20, nullable: true, default: 'pending' })
    fiscal_status: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    ebm_submitted_at: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ebm_reference: string;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'patient_id' })
    patient: User;

    @ManyToOne(() => Prescription, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'prescription_id' })
    prescription: Prescription;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cashier_id' })
    cashier: User;

    @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
    items: SaleItem[];

    @OneToMany(() => SalePayment, (p) => p.sale, { cascade: true })
    payments: SalePayment[];

    @OneToMany(() => InsuranceClaim, (claim) => claim.sale)
    insurance_claims: InsuranceClaim[];

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

@Entity('sale_items')
@Index(['sale_id'])
@Index(['organization_id'])
export class SaleItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sale_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    total_price: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sale_id' })
    sale: Sale;

    @ManyToOne(() => Medicine, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

@Entity('sale_payments')
@Index(['sale_id'])
@Index(['organization_id'])
export class SalePayment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sale_id: number;

    @Column({
        type: 'enum',
        enum: SalePaymentMethod,
    })
    method: SalePaymentMethod;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    reference: string;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Sale, (sale) => sale.payments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sale_id' })
    sale: Sale;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
