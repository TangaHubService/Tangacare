import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from './Organization.entity';
import { Appointment } from './Appointment.entity';
import { Doctor } from './Doctor.entity';
import { User } from './User.entity';

@Entity('prescriptions')
@Index(['organization_id'])
export class Prescription {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', nullable: true })
    appointment_id: number | null;

    @Column({ type: 'int', nullable: true })
    doctor_id: number | null;

    @Column({ type: 'int', nullable: true })
    patient_id: number | null;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    facility_id: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    external_prescriber_name: string | null;

    @Column({ type: 'varchar', length: 120, nullable: true })
    external_prescriber_license: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    walk_in_patient_name: string | null;

    @Column({ type: 'varchar', length: 120, nullable: true })
    walk_in_patient_identifier: string | null;

    @Column({ type: 'text' })
    prescription_text: string;

    @Column({ type: 'text', nullable: true })
    diagnosis: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    issued_at: Date;

    @Column({ type: 'boolean', default: true })
    is_digital: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    pdf_url: string;

    /** Number of days the prescription is valid from issued_at. Null = use tenant setting default. */
    @Column({ type: 'int', nullable: true })
    validity_days: number;

    /** When the prescription was used/consumed (e.g. linked to a sale). Null = not yet used. */
    @Column({ type: 'timestamp with time zone', nullable: true })
    used_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone', nullable: true })
    updated_at: Date;

    @ManyToOne(() => Appointment, (appointment) => appointment.prescriptions, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    @JoinColumn({ name: 'appointment_id' })
    appointment: Appointment | null;

    @ManyToOne(() => Doctor, (doctor) => doctor.prescriptions, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    @JoinColumn({ name: 'doctor_id' })
    doctor: Doctor | null;

    @ManyToOne(() => User, (user) => user.prescriptions, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'patient_id' })
    patient: User | null;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
