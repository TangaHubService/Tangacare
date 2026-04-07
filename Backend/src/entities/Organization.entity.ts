import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Facility } from './Facility.entity';
import { User } from './User.entity';

export enum OrganizationType {
    PHARMACY_CHAIN = 'pharmacy_chain',
    SINGLE_PHARMACY = 'single_pharmacy',
    CLINIC = 'clinic',
    HOSPITAL = 'hospital',
}

export enum SubscriptionStatus {
    ACTIVE = 'active',
    TRIAL = 'trial',
    SUSPENDED = 'suspended',
    CANCELLED = 'cancelled',
}

@Entity('organizations')
export class Organization {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    code: string;

    @Column({
        type: 'enum',
        enum: OrganizationType,
        default: OrganizationType.SINGLE_PHARMACY,
    })
    type: OrganizationType;

    @Column({
        type: 'enum',
        enum: SubscriptionStatus,
        default: SubscriptionStatus.ACTIVE,
    })
    subscription_status: SubscriptionStatus;

    @Column({ type: 'text', nullable: true })
    address: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    legal_name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    registration_number: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    medical_license: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    city: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    country: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    tax_registration_number: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    business_license_number: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @OneToMany(() => Facility, (facility) => facility.organization)
    facilities: Facility[];

    @OneToMany(() => User, (user) => user.organization)
    users: User[];
}
