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
import { Organization } from './Organization.entity';

export enum InsuranceProviderType {
    PUBLIC = 'PUBLIC',
    PRIVATE = 'PRIVATE',
}

@Entity('insurance_providers')
@Index(['organization_id', 'name'])
export class InsuranceProvider {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', nullable: true })
    organization_id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({
        type: 'enum',
        enum: InsuranceProviderType,
        default: InsuranceProviderType.PRIVATE,
    })
    type: InsuranceProviderType;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    coverage_percentage: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    max_coverage_limit: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
}
