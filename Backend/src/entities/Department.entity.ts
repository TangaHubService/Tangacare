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
} from 'typeorm';
import { Facility } from './Facility.entity';
import { Stock } from './Stock.entity';
import { StockTransfer } from './StockTransfer.entity';

@Entity('departments')
export class Department {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    location: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @ManyToOne(() => Facility, (facility) => facility.departments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @OneToMany(() => Stock, (stock) => stock.department)
    stocks: Stock[];

    @OneToMany(() => StockTransfer, (transfer) => transfer.from_department)
    outgoing_transfers: StockTransfer[];

    @OneToMany(() => StockTransfer, (transfer) => transfer.to_department)
    incoming_transfers: StockTransfer[];
}
