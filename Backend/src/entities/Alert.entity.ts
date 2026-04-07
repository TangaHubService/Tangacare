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
import { Medicine } from './Medicine.entity';
import { Batch } from './Batch.entity';
import { Organization } from './Organization.entity';

export enum AlertType {
    LOW_STOCK = 'low_stock',
    EXPIRY_SOON = 'expiry_soon',
    EXPIRED = 'expired',
    CONTROLLED_DRUG_THRESHOLD = 'controlled_drug_threshold',
    REORDER_SUGGESTION = 'reorder_suggestion',
}

export enum AlertStatus {
    ACTIVE = 'active',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
}

@Entity('alerts')
@Index(['facility_id', 'status', 'alert_type'])
@Index(['organization_id'])
export class Alert {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({
        type: 'enum',
        enum: AlertType,
    })
    alert_type: AlertType;

    @Column({
        type: 'enum',
        enum: AlertStatus,
        default: AlertStatus.ACTIVE,
    })
    status: AlertStatus;

    @Column({ type: 'int', nullable: true })
    medicine_id: number;

    @Column({ type: 'int', nullable: true })
    batch_id: number;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'int', nullable: true })
    current_value: number;

    @Column({ type: 'int', nullable: true })
    threshold_value: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_notified_at: Date;

    @Column({
        type: 'varchar',
        length: 20,
        default: 'info',
        comment: 'info, warning, critical, out_of_stock',
    })
    severity: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    acknowledged_at: Date;

    @Column({ type: 'int', nullable: true })
    acknowledged_by_id: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    resolved_at: Date;

    @Column({ type: 'int', nullable: true })
    resolved_by_id: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    action_taken: string;

    @Column({ type: 'text', nullable: true })
    action_reason: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Medicine, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Batch, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
