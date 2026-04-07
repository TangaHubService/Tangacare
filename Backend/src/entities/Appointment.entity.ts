import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './User.entity';
import { Doctor } from './Doctor.entity';
import { Prescription } from './Prescription.entity';
import { DoctorReview } from './DoctorReview.entity';
import { Organization } from './Organization.entity';

export enum AppointmentStatus {
    SCHEDULED = 'scheduled',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    NO_SHOW = 'no_show',
}

export enum ConsultationType {
    VIDEO = 'video',
    AUDIO = 'audio',
    TEXT = 'text',
}

@Entity('appointments')
@Index(['organization_id'])
export class Appointment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    patient_id: number;

    @Column({ type: 'int' })
    doctor_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'timestamp with time zone' })
    appointment_date: Date;

    @Column({ type: 'int', default: 15 })
    duration_minutes: number;

    @Column({
        type: 'enum',
        enum: AppointmentStatus,
        default: AppointmentStatus.SCHEDULED,
    })
    status: AppointmentStatus;

    @Column({
        type: 'enum',
        enum: ConsultationType,
    })
    consultation_type: ConsultationType;

    @Column({ type: 'varchar', length: 255, nullable: true })
    meeting_link: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => User, (user) => user.appointments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'patient_id' })
    patient: User;

    @ManyToOne(() => Doctor, (doctor) => doctor.appointments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'doctor_id' })
    doctor: Doctor;

    @OneToMany(() => Prescription, (prescription) => prescription.appointment)
    prescriptions: Prescription[];

    @OneToOne(() => DoctorReview, (review) => review.appointment)
    review: DoctorReview;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
