import 'reflect-metadata';
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
import { Facility } from './Facility.entity';
import { Organization } from './Organization.entity';
import { Stock } from './Stock.entity';

export enum TemperatureType {
    ROOM_TEMP = 'ROOM_TEMP',
    COLD = 'COLD',
    FROZEN = 'FROZEN',
}

@Entity('storage_locations')
@Index(['facility_id', 'code'], { unique: true })
export class StorageLocation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number | null;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    code: string;

    @Column({ type: 'int', nullable: true })
    parent_id: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    area: string;

    @Column({
        type: 'enum',
        enum: TemperatureType,
        default: TemperatureType.ROOM_TEMP,
    })
    temperature_type: TemperatureType;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, (facility) => facility.storage_locations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;

    @ManyToOne(() => StorageLocation, (location) => location.children, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent: StorageLocation;

    @OneToMany(() => StorageLocation, (location) => location.parent)
    children: StorageLocation[];

    @OneToMany(() => Stock, (stock) => stock.location)
    stocks: Stock[];
}
