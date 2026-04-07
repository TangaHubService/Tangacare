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
import { Facility } from './Facility.entity';
import { StorageLocation } from './StorageLocation.entity';
import { User } from './User.entity';
import { Organization } from './Organization.entity';

export enum ColdChainExcursionStatus {
    OPEN = 'open',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
}

@Entity('cold_chain_excursions')
@Index(['facility_id', 'storage_location_id', 'status'])
@Index(['started_at'])
@Index(['organization_id'])
export class ColdChainExcursion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    storage_location_id: number;

    @Column({
        type: 'enum',
        enum: ColdChainExcursionStatus,
        default: ColdChainExcursionStatus.OPEN,
    })
    status: ColdChainExcursionStatus;

    @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
    started_at: Date;

    @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
    last_observed_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    recovered_at: Date | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    resolved_at: Date | null;

    @Column({ type: 'int', nullable: true })
    opened_by_id: number | null;

    @Column({ type: 'int', nullable: true })
    acknowledged_by_id: number | null;

    @Column({ type: 'int', nullable: true })
    resolved_by_id: number | null;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    highest_temperature_c: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    lowest_temperature_c: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    last_temperature_c: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    expected_min_c: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    expected_max_c: number;

    @Column({ type: 'varchar', length: 160, nullable: true })
    resolution_action: string | null;

    @Column({ type: 'text', nullable: true })
    resolution_notes: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => StorageLocation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storage_location_id' })
    location: StorageLocation;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'opened_by_id' })
    opened_by: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'acknowledged_by_id' })
    acknowledged_by: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'resolved_by_id' })
    resolved_by: User | null;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
