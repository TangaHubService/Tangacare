import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

export enum TipCategory {
    GENERAL = 'general',
    NUTRITION = 'nutrition',
    EXERCISE = 'exercise',
    MENTAL_HEALTH = 'mental_health',
    PREVENTION = 'prevention',
}

export enum Language {
    EN = 'en',
    RW = 'rw',
}

@Entity('health_tips')
export class HealthTip {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text' })
    content: string;

    @Column({
        type: 'enum',
        enum: TipCategory,
    })
    category: TipCategory;

    @Column({
        type: 'enum',
        enum: Language,
        default: Language.EN,
    })
    language: Language;

    @Column({ type: 'boolean', default: false })
    is_published: boolean;

    @Column({ type: 'timestamp with time zone', nullable: true })
    published_at: Date;

    @Column({ type: 'int', nullable: true })
    author_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => User, (user) => user.health_tips, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'author_id' })
    author: User;
}
