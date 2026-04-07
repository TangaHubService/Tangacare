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
import { Conversation } from './Conversation.entity';
import { User } from './User.entity';

export enum CallType {
    AUDIO = 'audio',
    VIDEO = 'video',
}

export enum CallStatus {
    INITIATED = 'initiated',
    RINGING = 'ringing',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    ENDED = 'ended',
    MISSED = 'missed',
}

@Entity('calls')
@Index(['conversation_id', 'created_at'])
@Index(['caller_id', 'created_at'])
@Index(['callee_id', 'created_at'])
export class Call {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    conversation_id: number;

    @Column({ type: 'int' })
    caller_id: number;

    @Column({ type: 'int' })
    callee_id: number;

    @Column({
        type: 'enum',
        enum: CallType,
    })
    call_type: CallType;

    @Column({
        type: 'enum',
        enum: CallStatus,
        default: CallStatus.INITIATED,
    })
    status: CallStatus;

    @Column({ type: 'timestamp with time zone', nullable: true })
    started_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    ended_at: Date;

    @Column({ type: 'int', nullable: true, comment: 'Duration in seconds' })
    duration: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'conversation_id' })
    conversation: Conversation;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'caller_id' })
    caller: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'callee_id' })
    callee: User;
}
