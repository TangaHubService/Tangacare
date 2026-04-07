import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Message } from './Message.entity';
import { User } from './User.entity';

@Entity('message_reads')
@Index(['message_id', 'user_id'], { unique: true })
export class MessageRead {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    message_id: number;

    @Column({ type: 'int' })
    user_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    read_at: Date;

    @ManyToOne(() => Message, (message) => message.reads, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'message_id' })
    message: Message;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
