import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organization } from './Organization.entity';
import { Facility } from './Facility.entity';
import { UserRole } from './User.entity';

export enum InvitationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    EXPIRED = 'expired',
    REVOKED = 'revoked',
}

@Entity('invitations')
export class Invitation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    email: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    code: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.PHARMACIST,
    })
    role: UserRole;

    @Column({ type: 'int' })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    facility_id: number;

    @Column({
        type: 'enum',
        enum: InvitationStatus,
        default: InvitationStatus.PENDING,
    })
    status: InvitationStatus;

    @Column({ type: 'timestamp with time zone' })
    expires_at: Date;

    @Column({ type: 'int' })
    invited_by_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Organization)
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    @ManyToOne(() => Facility, { nullable: true })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility | null;
}
