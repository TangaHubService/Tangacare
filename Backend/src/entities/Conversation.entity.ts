import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './User.entity';
import { Doctor } from './Doctor.entity';
import { Message } from './Message.entity';

@Entity('conversations')
@Index(['patient_id', 'doctor_id'], { unique: true })
export class Conversation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    patient_id: number;

    @Column({ type: 'int' })
    doctor_id: number;

    @Column({ type: 'text', nullable: true })
    last_message: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_message_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'patient_id' })
    patient: User;

    @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'doctor_id' })
    doctor: Doctor;

    @OneToMany(() => Message, (message) => message.conversation)
    messages: Message[];
}
