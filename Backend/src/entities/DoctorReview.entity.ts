import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';
import { Doctor } from './Doctor.entity';
import { Appointment } from './Appointment.entity';

@Entity('doctor_reviews')
export class DoctorReview {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    doctor_id: number;

    @Column({ type: 'int' })
    patient_id: number;

    @Column({ type: 'int' })
    appointment_id: number;

    @Column({ type: 'int' })
    rating: number;

    @Column({ type: 'text', nullable: true })
    review_text: string;

    @Column({ type: 'boolean', default: false })
    is_featured: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Doctor, (doctor) => doctor.reviews, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'doctor_id' })
    doctor: Doctor;

    @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'patient_id' })
    patient: User;

    @OneToOne(() => Appointment, (appointment) => appointment.review)
    @JoinColumn({ name: 'appointment_id' })
    appointment: Appointment;
}
