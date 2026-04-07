import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Appointment } from './Appointment.entity';
import { User } from './User.entity';

export enum PaymentMethod {
    MOBILE_MONEY = 'mobile_money',
    CREDIT_CARD = 'credit_card',
    INSURANCE = 'insurance',
    SUBSCRIPTION = 'subscription',
}

export enum PaymentStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
}

export enum PaymentGateway {
    FLUTTERWAVE = 'flutterwave',
    PAYPACK = 'paypack',
    OTHER = 'other',
}

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', nullable: true })
    appointment_id: number;

    @Column({ type: 'int' })
    patient_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({
        type: 'enum',
        enum: PaymentMethod,
    })
    payment_method: PaymentMethod;

    @Column({ type: 'varchar', length: 100, unique: true })
    transaction_id: string;

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    status: PaymentStatus;

    @Column({
        type: 'enum',
        enum: PaymentGateway,
    })
    payment_gateway: PaymentGateway;

    @Column({ type: 'timestamp with time zone', nullable: true })
    payment_date: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'appointment_id' })
    appointment: Appointment;

    @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'patient_id' })
    patient: User;
}
