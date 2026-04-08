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
    BATCH_RECALL = 'batch_recall',
    STOCK_VARIANCE = 'stock_variance',
    COLD_CHAIN_EXCURSION = 'cold_chain_excursion',
}

export enum AlertStatus {
    ACTIVE = 'active',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
}

@Entity('alerts')
@Index(['facility_id', 'status', 'alert_type'])
@Index(['organization_id'])
@Index(['facility_id', 'alert_type', 'reference_type', 'reference_id', 'status'])
export class Alert {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number | null;

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
    medicine_id: number | null;

    @Column({ type: 'int', nullable: true })
    batch_id: number | null;

    @Column({ type: 'varchar', length: 80, nullable: true })
    reference_type: string | null;

    @Column({ type: 'int', nullable: true })
    reference_id: number | null;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'int', nullable: true })
    current_value: number | null;

    @Column({ type: 'int', nullable: true })
    threshold_value: number | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_notified_at: Date | null;

    @Column({
        type: 'varchar',
        length: 20,
        default: 'info',
        comment: 'info, warning, critical, out_of_stock',
    })
    severity: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    acknowledged_at: Date | null;

    @Column({ type: 'int', nullable: true })
    acknowledged_by_id: number | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    resolved_at: Date | null;

    @Column({ type: 'int', nullable: true })
    resolved_by_id: number | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    action_taken: string | null;

    @Column({ type: 'text', nullable: true })
    action_reason: string | null;

    @Column({ type: 'jsonb', nullable: true })
    context_data: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Medicine, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine | null;

    @ManyToOne(() => Batch, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batch_id' })
    batch: Batch | null;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;
}
