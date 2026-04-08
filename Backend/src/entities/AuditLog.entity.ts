import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Facility } from './Facility.entity';
import { User } from './User.entity';
import { Organization } from './Organization.entity';

export enum AuditAction {
    VIEW = 'view',
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    DISPENSE = 'dispense',
    RECEIVE = 'receive',
    TRANSFER = 'transfer',
    ADJUSTMENT = 'adjustment',
    LOGIN = 'login',
    LOGOUT = 'logout',
    IMPERSONATE = 'impersonate',
    ACCESS_DENIED = 'access_denied',
    FEFO_VIOLATION = 'fefo_violation',
}

export enum AuditEntityType {
    ORGANIZATION = 'organization',
    FACILITY = 'facility',
    DEPARTMENT = 'department',
    MEDICINE = 'medicine',
    BATCH = 'batch',
    STOCK = 'stock',
    SUPPLIER = 'supplier',
    PURCHASE_ORDER = 'purchase_order',
    DISPENSE_TRANSACTION = 'dispense_transaction',
    STOCK_TRANSFER = 'stock_transfer',
    ALERT = 'alert',
    USER = 'user',
    SALE = 'sale',
    CUSTOMER_RETURN = 'customer_return',
    VENDOR_RETURN = 'vendor_return',
    DISPOSAL_REQUEST = 'disposal_request',
    GOODS_RECEIPT = 'goods_receipt',
}

@Entity('audit_logs')
@Index(['facility_id', 'created_at'])
@Index(['user_id', 'created_at'])
@Index(['entity_type', 'entity_id'])
@Index(['organization_id'])
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', nullable: true })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    user_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({
        type: 'enum',
        enum: AuditAction,
    })
    action: AuditAction;

    @Column({
        type: 'enum',
        enum: AuditEntityType,
    })
    entity_type: AuditEntityType;

    @Column({ type: 'int', nullable: true })
    entity_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    entity_name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    old_values: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    new_values: Record<string, any>;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    user_agent: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    hash: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    previous_hash: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Facility, (facility) => facility.audit_logs, { nullable: true })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
