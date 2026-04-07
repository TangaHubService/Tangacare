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
import { User } from './User.entity';

export enum TicketStatus {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed',
}

@Entity('support_tickets')
@Index(['user_id', 'created_at'])
export class SupportTicket {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    ticket_number: string;

    @Column({ type: 'int' })
    user_id: number;

    @Column({ type: 'varchar', length: 255 })
    subject: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'varchar', length: 20, default: 'open' })
    status: string;

    @Column({ type: 'text', nullable: true })
    response: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
