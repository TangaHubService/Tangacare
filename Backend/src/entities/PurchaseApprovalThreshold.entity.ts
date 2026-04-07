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
import { Organization } from './Organization.entity';

/**
 * When a PO total exceeds dual_approval_above_amount, a second approval step should be required
 * (enforce in ProcurementService.approveOrder / future workflow; schema is ready for chains/hospitals).
 */
@Entity('purchase_approval_thresholds')
@Index(['organization_id'])
export class PurchaseApprovalThreshold {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    organization_id: number;

    /** Null = organization default for all facilities */
    @Column({ type: 'int', nullable: true })
    facility_id: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    dual_approval_above_amount: number | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility | null;
}
