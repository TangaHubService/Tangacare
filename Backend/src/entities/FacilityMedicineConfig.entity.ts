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
import { Organization } from './Organization.entity';

/** Per-facility costing and stock targets; pairs with org-level Medicine and medicine_facility_settings. */
@Entity('facility_medicine_configs')
@Index(['facility_id', 'medicine_id'], { unique: true })
@Index(['organization_id'])
export class FacilityMedicineConfig {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    average_cost: number; // Weighted Average Cost (WAC)

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    last_purchase_price: number;

    @Column({ type: 'int', nullable: true })
    min_stock_level: number | null; // Facility-specific override

    @Column({ type: 'int', nullable: true })
    target_stock_level: number | null; // Facility-specific override

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @ManyToOne(() => Medicine, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'medicine_id' })
    medicine: Medicine;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
