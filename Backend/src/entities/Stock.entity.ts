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
import { Department } from './Department.entity';
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { User } from './User.entity';

import { StorageLocation } from './StorageLocation.entity';
import { Organization } from './Organization.entity';

@Entity('stocks')
@Index(['facility_id', 'medicine_id', 'batch_id', 'department_id', 'location_id'], { unique: true })
@Index(['organization_id'])
export class Stock {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    department_id: number;

    @Column({ type: 'int', nullable: true })
    location_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    batch_id: number;

    @Column({ type: 'int', default: 0 })
    quantity: number;

    @Column({ type: 'int', default: 0 })
    reserved_quantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    unit_price: number;

    @Column({ type: 'boolean', default: false })
    is_frozen: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @Column({ type: 'timestamp with time zone', nullable: true })
    deleted_at: Date;

    @Column({ type: 'int', nullable: true })
    deleted_by_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, (facility) => facility.stocks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Department, (department) => department.stocks, {
        nullable: true,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'department_id' })
    department: Department;

    @ManyToOne(() => Medicine, (medicine) => medicine.stocks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch, (batch) => batch.stocks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => StorageLocation, (location) => location.stocks, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'location_id' })
    location: StorageLocation;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'deleted_by_id' })
    deleted_by: User;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
