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
} from 'typeorm';
import { Department } from './Department.entity';
import { Stock } from './Stock.entity';
import { PurchaseOrder } from './PurchaseOrder.entity';
import { DispenseTransaction } from './DispenseTransaction.entity';
import { AuditLog } from './AuditLog.entity';
import { User } from './User.entity';
import { Organization } from './Organization.entity';
import { StorageLocation } from './StorageLocation.entity';

export enum FacilityType {
    HOSPITAL = 'hospital',
    CLINIC = 'clinic',
    PHARMACY_SHOP = 'pharmacy_shop',
}

@Entity('facilities')
export class Facility {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    address: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string;

    @Column({
        type: 'enum',
        enum: FacilityType,
    })
    type: FacilityType;

    @Column({ type: 'boolean', default: true })
    departments_enabled: boolean;

    @Column({ type: 'boolean', default: true })
    controlled_drug_rules_enabled: boolean;

    @Column({ type: 'int', default: 10 })
    min_stock_threshold_percentage: number;

    @Column({ type: 'int', default: 30 })
    expiry_alert_days: number;

    @Column({ type: 'int', default: 30 })
    expiry_critical_days: number;

    @Column({ type: 'int', default: 60 })
    expiry_warning_days: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    default_markup_percent: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    facility_admin_id: number;

    @Column({ type: 'jsonb', nullable: true })
    configuration: Record<string, any>;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    ebm_enabled: boolean;

    @Column({ type: 'boolean', default: true })
    wac_enabled: boolean;

    @Column({ type: 'varchar', length: 100, nullable: true })
    tax_registration_number: string;

    @Column({ type: 'varchar', length: 30, nullable: true })
    tin_number: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    ebm_device_serial: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    ebm_sdcid: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Organization, (org) => org.facilities, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'facility_admin_id' })
    facility_admin: User;

    @OneToMany(() => Department, (department) => department.facility)
    departments: Department[];

    @OneToMany(() => Stock, (stock) => stock.facility)
    stocks: Stock[];

    @OneToMany(() => PurchaseOrder, (po) => po.facility)
    purchase_orders: PurchaseOrder[];

    @OneToMany(() => DispenseTransaction, (dispense) => dispense.facility)
    dispense_transactions: DispenseTransaction[];

    @OneToMany(() => AuditLog, (audit) => audit.facility)
    audit_logs: AuditLog[];

    @OneToMany(() => StorageLocation, (location) => location.facility)
    storage_locations: StorageLocation[];
}
