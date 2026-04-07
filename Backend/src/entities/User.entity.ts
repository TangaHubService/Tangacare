import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    OneToOne,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Doctor } from './Doctor.entity';
import { Appointment } from './Appointment.entity';
import { Prescription } from './Prescription.entity';
import { Payment } from './Payment.entity';
import { HealthRecord } from './HealthRecord.entity';
import { HealthTip } from './HealthTip.entity';
import { DoctorReview } from './DoctorReview.entity';
import { Facility } from './Facility.entity';
import { Organization } from './Organization.entity';

export enum UserRole {
    USER = 'user',
    PATIENT = 'patient',
    DOCTOR = 'doctor',
    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin',
    FACILITY_ADMIN = 'facility_admin',
    OWNER = 'owner',
    CASHIER = 'cashier',
    PHARMACIST = 'pharmacist',
    TECHNICIAN = 'technician',
    STORE_MANAGER = 'store_manager',
    STORE_KEEPER = 'store_keeper',
    AUDITOR = 'auditor',
}


@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
    phone_number: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    password_hash: string;

    @Column({ type: 'varchar', length: 100 })
    first_name: string;

    @Column({ type: 'varchar', length: 100 })
    last_name: string;

    @Column({ type: 'date', nullable: true })
    date_of_birth: Date;

    @Column({ type: 'varchar', length: 10, nullable: true })
    gender: string;

    @Column({ type: 'text', nullable: true })
    address: string;

    @Column({ type: 'varchar', length: 10, default: 'en' })
    preferred_language: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    profile_picture_url: string;

    @Column({ type: 'boolean', default: false })
    is_verified: boolean;

    @Column({ type: 'varchar', length: 100, nullable: true })
    professional_title: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    license_number: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role: UserRole;


    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_online: boolean;

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_seen: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    deleted_at: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    otp_code: string;


    @Column({ type: 'timestamp with time zone', nullable: true })
    otp_expires_at: Date;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    facility_id: number;

    @Column({ type: 'boolean', default: false })
    must_set_password: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @OneToOne(() => Doctor, (doctor) => doctor.user)
    doctor: Doctor;

    @OneToMany(() => Appointment, (appointment) => appointment.patient)
    appointments: Appointment[];

    @OneToMany(() => Prescription, (prescription) => prescription.patient)
    prescriptions: Prescription[];

    @OneToMany(() => Payment, (payment) => payment.patient)
    payments: Payment[];

    @OneToMany(() => HealthRecord, (healthRecord) => healthRecord.patient)
    health_records: HealthRecord[];

    @OneToMany(() => HealthTip, (healthTip) => healthTip.author)
    health_tips: HealthTip[];

    @OneToMany(() => DoctorReview, (review) => review.patient)
    reviews: DoctorReview[];

    @ManyToOne(() => Organization, (org) => org.users, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;

    @ManyToOne(() => Facility, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility | null;
}
