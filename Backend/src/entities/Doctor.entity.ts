import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';
import { Appointment } from './Appointment.entity';
import { Prescription } from './Prescription.entity';
import { DoctorReview } from './DoctorReview.entity';

@Entity('doctors')
export class Doctor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    user_id: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    license_number: string;

    @Column({ type: 'varchar', length: 100 })
    specialization: string;

    @Column({ type: 'int', nullable: true })
    years_of_experience: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    consultation_fee: number;

    @Column({ type: 'boolean', default: true })
    is_available: boolean;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.0 })
    rating: number;

    @Column({ type: 'int', default: 0 })
    total_consultations: number;

    @Column({ type: 'text', nullable: true })
    bio: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => User, (user) => user.doctor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @OneToMany(() => Appointment, (appointment) => appointment.doctor)
    appointments: Appointment[];

    @OneToMany(() => Prescription, (prescription) => prescription.doctor)
    prescriptions: Prescription[];

    @OneToMany(() => DoctorReview, (review) => review.doctor)
    reviews: DoctorReview[];
}
