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

@Entity('medicine_facility_settings')
@Index(['facility_id', 'medicine_id'], { unique: true })
export class MedicineFacilitySetting {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int' })
    medicine_id: number;

    @Column({ type: 'int', nullable: true })
    min_stock_level: number;

    @Column({ type: 'int', nullable: true })
    reorder_point: number;

    @Column({ type: 'int', nullable: true })
    target_stock_level: number;

    /** When set, overrides Medicine.selling_price for this facility (dispensing/POS). */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    selling_price_override: number | null;

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
}
