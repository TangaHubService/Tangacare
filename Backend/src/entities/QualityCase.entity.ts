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
import { Organization } from './Organization.entity';
import { Facility } from './Facility.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { User } from './User.entity';

export enum QualityCaseType {
    COMPLAINT = 'complaint',
    CAPA = 'capa',
    ADR = 'adr',
}

export enum QualityCaseStatus {
    OPEN = 'open',
    INVESTIGATING = 'investigating',
    CLOSED = 'closed',
}

@Entity('quality_cases')
@Index(['organization_id'])
@Index(['facility_id'])
export class QualityCase {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    organization_id: number;

    @Column({ type: 'int', nullable: true })
    facility_id: number | null;

    @Column({ type: 'enum', enum: QualityCaseType })
    type: QualityCaseType;

    @Column({ type: 'enum', enum: QualityCaseStatus, default: QualityCaseStatus.OPEN })
    status: QualityCaseStatus;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'int', nullable: true })
    medicine_id: number | null;

    @Column({ type: 'int', nullable: true })
    batch_id: number | null;

    @Column({ type: 'text', nullable: true })
    capa_actions: string | null;

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    reported_at: Date;

    @Column({ type: 'timestamptz', nullable: true })
    closed_at: Date | null;

    @Column({ type: 'int', nullable: true })
    created_by_id: number | null;

    @Column({ type: 'int', nullable: true })
    updated_by_id: number | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    @ManyToOne(() => Facility, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility | null;

    @ManyToOne(() => Medicine, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine | null;

    @ManyToOne(() => Batch, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;
}
