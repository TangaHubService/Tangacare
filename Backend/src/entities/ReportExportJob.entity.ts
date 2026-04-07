import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('report_export_jobs')
@Index(['organization_id', 'facility_id'])
export class ReportExportJob {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int' })
    organization_id: number;

    @Column({ type: 'int' })
    facility_id: number;

    @Column({ type: 'int', nullable: true })
    created_by_id: number | null;

    /** Same `type` as synchronous GET /reports/export/:type/:format */
    @Column({ type: 'varchar', length: 64 })
    report_type: string;

    @Column({ type: 'varchar', length: 16 })
    format: string;

    @Column({ type: 'varchar', length: 24, default: 'pending' })
    status: string;

    @Column({ type: 'jsonb', nullable: true })
    query: Record<string, unknown> | null;

    @Column({ type: 'text', nullable: true })
    file_path: string | null;

    @Column({ type: 'text', nullable: true })
    error_message: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    completed_at: Date | null;
}
