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
import { InsuranceProvider } from './InsuranceProvider.entity';

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

export enum FiscalInvoiceType {
    NORMAL = 'normal',
    CREDIT = 'credit',
    DEBIT = 'debit',
}

export enum FiscalReceiptType {
    NORMAL = 'N',
    COPY = 'C',
    TRAINING = 'T',
    PROFORMA = 'P',
}

export enum FiscalReceiptLabel {
    NS = 'NS',
    NR = 'NR',
    CS = 'CS',
    CR = 'CR',
    TS = 'TS',
    TR = 'TR',
    PS = 'PS',
}

/** Insurer remittance state for the insurance portion of a sale (cash co-pay is separate). */
export enum InsurancePaymentStatus {
    NONE = 'none',
    PENDING_RECEIPT = 'pending_receipt',
    PARTIALLY_RECEIVED = 'partially_received',
    RECEIVED = 'received',
    /** Insurer rejected or declined; AR may need write-off or patient collection. */
    INSURANCE_DECLINED = 'insurance_declined',
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

    /** Sum of non-insurance tenders (cash, card, mobile_money, bank) — cash collected at POS. */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    patient_paid_amount: number;

    /** Expected insurer portion (sale_payments where method = insurance). */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    insurance_expected_amount: number;

    @Column({ type: 'int', nullable: true })
    insurance_provider_id: number | null;

    @Column({ type: 'varchar', length: 32, default: InsurancePaymentStatus.NONE })
    insurance_payment_status: InsurancePaymentStatus;

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

    @Column({ type: 'varchar', length: 30, nullable: true })
    customer_tin: string | null;

    @Column({ type: 'varchar', length: 20, default: FiscalInvoiceType.NORMAL })
    invoice_type: FiscalInvoiceType;

    @Column({ type: 'varchar', length: 2, default: FiscalReceiptType.NORMAL })
    receipt_type: FiscalReceiptType;

    @Column({ type: 'varchar', length: 2, default: FiscalReceiptLabel.NS })
    receipt_label: FiscalReceiptLabel;

    @Column({ type: 'varchar', length: 100, nullable: true })
    ebm_receipt_number: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    vsdc_internal_data: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    vsdc_receipt_signature: string | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    vsdc_receipt_published_at: Date | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    vsdc_sdc_id: string | null;

    @Column({ type: 'bigint', nullable: true })
    receipt_type_counter: number | null;

    @Column({ type: 'bigint', nullable: true })
    receipt_global_counter: number | null;

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

    @ManyToOne(() => InsuranceProvider, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'insurance_provider_id' })
    insurance_provider: InsuranceProvider;

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

    @Column({ type: 'varchar', length: 2, default: 'B' })
    tax_category: string;

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
