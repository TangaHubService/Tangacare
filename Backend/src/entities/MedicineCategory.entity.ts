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
import { Organization } from './Organization.entity';
import { Medicine } from './Medicine.entity';

@Entity('medicine_categories')
@Index(['code', 'organization_id'], {
    unique: true,
    where: '"organization_id" IS NOT NULL',
})
@Index(['name', 'organization_id'])
export class MedicineCategory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 50, unique: false })
    code: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    default_markup_percent: number | null;

    @Column({ type: 'int', nullable: true })
    organization_id: number | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization | null;

    @OneToMany(() => Medicine, (medicine) => medicine.category)
    medicines: Medicine[];
}
