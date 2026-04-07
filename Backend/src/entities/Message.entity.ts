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
import { Conversation } from './Conversation.entity';
import { User } from './User.entity';
import { MessageRead } from './MessageRead.entity';

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    FILE = 'file',
}

export enum SenderType {
    PATIENT = 'patient',
    DOCTOR = 'doctor',
}

@Entity('messages')
@Index(['conversation_id', 'created_at'])
export class Message {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    conversation_id: number;

    @Column({ type: 'int' })
    sender_id: number;

    @Column({
        type: 'enum',
        enum: SenderType,
    })
    sender_type: SenderType;

    @Column({ type: 'text' })
    content: string;

    @Column({
        type: 'enum',
        enum: MessageType,
        default: MessageType.TEXT,
    })
    message_type: MessageType;

    @Column({ type: 'varchar', length: 500, nullable: true })
    file_url: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'conversation_id' })
    conversation: Conversation;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sender_id' })
    sender: User;

    @OneToMany(() => MessageRead, (messageRead) => messageRead.message)
    reads: MessageRead[];
}
