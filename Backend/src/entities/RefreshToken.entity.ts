import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    CreateDateColumn,
} from 'typeorm';
import { User } from './User.entity';

/**
 * C-4: Refresh token persistence for secure revocation.
 * On logout (or suspicious activity), set revoked_at to invalidate the token immediately.
 */
@Entity('refresh_tokens')
@Index(['token_hash'], { unique: true })
@Index(['user_id'])
export class RefreshToken {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    user_id: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    /** SHA-256 hash of the raw token value — never store the raw token */
    @Column({ type: 'varchar', length: 64, unique: true })
    token_hash: string;

    @Column({ type: 'timestamp with time zone' })
    expires_at: Date;

    /** Non-null means the token has been revoked (logout / security event) */
    @Column({ type: 'timestamp with time zone', nullable: true, default: null })
    revoked_at: Date | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;
}
