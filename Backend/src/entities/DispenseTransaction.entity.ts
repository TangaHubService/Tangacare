import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Facility } from './Facility.entity';
import { Department } from './Department.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { User } from './User.entity';
import { Prescription } from './Prescription.entity';
import { Organization } from './Organization.entity';

export enum DispenseType {
    PRESCRIPTION = 'prescription',
    OTC = 'otc',
    INTERNAL = 'internal',
    TRANSFER = 'transfer',
}

@Entity('dispense_transactions')
@Index(['facility_id', 'created_at'])
@Index(['organization_id'])
export class DispenseTransaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    transaction_number: string;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    department_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({
        type: 'enum',
        enum: DispenseType,
    })
    dispense_type: DispenseType;

    @Column({ type: 'int', nullable: true })
    patient_id: number;

    @Column({ type: 'int', nullable: true })
    prescription_id: number;

    @Column({ type: 'varchar', length: 50, nullable: true })
    patient_id_type: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    patient_id_number: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    dispensing_pharmacist_license: string;

    @Column({ type: 'int' })
    dispensed_by_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_price: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    total_amount: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, (facility) => facility.dispense_transactions)
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Department, { nullable: true })
    @JoinColumn({ name: 'department_id' })
    department: Department;

    @ManyToOne(() => Medicine, (medicine) => medicine.dispense_transactions)
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch, (batch) => batch.dispense_transactions)
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'patient_id' })
    patient: User;

    @ManyToOne(() => Prescription, { nullable: true })
    @JoinColumn({ name: 'prescription_id' })
    prescription: Prescription;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'dispensed_by_id' })
    dispensed_by: User;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
