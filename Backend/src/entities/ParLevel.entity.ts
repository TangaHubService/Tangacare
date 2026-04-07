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
import { User } from './User.entity';
import { Organization } from './Organization.entity';

export enum ParReplenishmentPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

export enum ParReplenishmentTaskStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

@Entity('department_par_levels')
@Index(['facility_id', 'department_id', 'medicine_id'], { unique: true })
@Index(['organization_id'])
export class DepartmentParLevel {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int' })
    department_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int' })
    par_level: number;

    @Column({ type: 'int', nullable: true })
    min_level: number;

    @Column({ type: 'int', nullable: true })
    refill_to_level: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'int', nullable: true })
    created_by_id: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Department, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'department_id' })
    department: Department;

    @ManyToOne(() => Medicine, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}

@Entity('par_replenishment_tasks')
@Index(['facility_id', 'status', 'priority'])
@Index(['organization_id'])
export class ParReplenishmentTask {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int' })
    department_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int', default: 0 })
    current_quantity: number;

    @Column({ type: 'int' })
    target_quantity: number;

    @Column({ type: 'int' })
    suggested_quantity: number;

    @Column({
        type: 'enum',
        enum: ParReplenishmentPriority,
        default: ParReplenishmentPriority.MEDIUM,
    })
    priority: ParReplenishmentPriority;

    @Column({
        type: 'enum',
        enum: ParReplenishmentTaskStatus,
        default: ParReplenishmentTaskStatus.PENDING,
    })
    status: ParReplenishmentTaskStatus;

    @Column({ type: 'int', nullable: true })
    generated_by_id: number;

    @Column({ type: 'int', nullable: true })
    completed_by_id: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    due_at: Date;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    completed_at: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Department, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'department_id' })
    department: Department;

    @ManyToOne(() => Medicine, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'generated_by_id' })
    generated_by: User;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'completed_by_id' })
    completed_by: User;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
