import 'reflect-metadata';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Facility } from './Facility.entity';
import { StorageLocation } from './StorageLocation.entity';
import { User } from './User.entity';

export enum ColdChainTelemetrySource {
    MANUAL = 'manual',
    SENSOR = 'sensor',
}

@Entity('cold_chain_telemetry')
@Index(['facility_id', 'storage_location_id', 'recorded_at'])
export class ColdChainTelemetry {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int' })
    storage_location_id: number;

    @Column({ type: 'int', nullable: true })
    recorded_by_id: number | null;

    @Column({
        type: 'enum',
        enum: ColdChainTelemetrySource,
        default: ColdChainTelemetrySource.MANUAL,
    })
    source: ColdChainTelemetrySource;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    temperature_c: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    humidity_percent: number | null;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    expected_min_c: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    expected_max_c: number;

    @Column({ type: 'boolean' })
    within_range: boolean;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
    recorded_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => StorageLocation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storage_location_id' })
    location: StorageLocation;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'recorded_by_id' })
    recorded_by: User | null;
}
