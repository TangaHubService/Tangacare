import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

export enum RecordType {
    ALLERGY = 'allergy',
    CONDITION = 'condition',
    MEDICATION = 'medication',
    VACCINATION = 'vaccination',
    OTHER = 'other',
}

@Entity('health_records')
export class HealthRecord {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    patient_id: number;

    @Column({
        type: 'enum',
        enum: RecordType,
    })
    record_type: RecordType;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'date', nullable: true })
    start_date: Date;

    @Column({ type: 'date', nullable: true })
    end_date: Date;

    @Column({ type: 'varchar', length: 20, nullable: true })
    severity: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => User, (user) => user.health_records, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'patient_id' })
    patient: User;
}
