import fs from 'fs/promises';
import path from 'path';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { ReportExportJob } from '../../entities/ReportExportJob.entity';
import { AppError } from '../../middleware/error.middleware';
import { ExportService } from './export.service';
import { ReportingExportDatasetService } from './reporting-export-dataset.service';
import { ReportingService } from './reporting.service';
import { IntelligenceService } from './intelligence.service';
import { ParService } from './par.service';
import { AuditService } from './audit.service';
import type { ParsedQs } from 'qs';

export class ReportExportJobService {
    private readonly jobRepository: Repository<ReportExportJob>;
    private readonly exportService: ExportService;
    private readonly datasetService: ReportingExportDatasetService;

    constructor() {
        this.jobRepository = AppDataSource.getRepository(ReportExportJob);
        this.exportService = new ExportService();
        const reportingService = new ReportingService();
        this.datasetService = new ReportingExportDatasetService(
            reportingService,
            new IntelligenceService(),
            new ParService(),
            new AuditService(),
        );
    }

    async enqueue(params: {
        organizationId: number;
        facilityId: number;
        userId: number | null;
        reportType: string;
        format: string;
        query: ParsedQs;
    }): Promise<ReportExportJob> {
        if (params.format !== 'excel') {
            throw new AppError('Async export jobs support format=excel only', 400);
        }

        const job = this.jobRepository.create({
            organization_id: params.organizationId,
            facility_id: params.facilityId,
            created_by_id: params.userId,
            report_type: params.reportType,
            format: params.format,
            status: 'pending',
            query: params.query as unknown as Record<string, unknown>,
        });
        await this.jobRepository.save(job);

        setImmediate(() => {
            void this.runJob(job.id);
        });

        return job;
    }

    async getById(id: string, organizationId: number): Promise<ReportExportJob | null> {
        return this.jobRepository.findOne({
            where: { id, organization_id: organizationId },
        });
    }

    getDownloadPath(job: ReportExportJob): string | null {
        return job.file_path && job.status === 'completed' ? job.file_path : null;
    }

    private async runJob(id: string): Promise<void> {
        const job = await this.jobRepository.findOne({ where: { id } });
        if (!job) {
            return;
        }

        job.status = 'processing';
        job.error_message = null;
        await this.jobRepository.save(job);

        try {
            const bundle = await this.datasetService.build(
                job.report_type,
                job.facility_id,
                job.organization_id,
                (job.query || {}) as ParsedQs,
            );

            const buffer = await this.exportService.exportToExcelBuffer(
                bundle.columns,
                bundle.data,
                bundle.fileName,
                bundle.title,
            );

            const baseDir = path.join(process.env.UPLOAD_PATH || './uploads', 'report-exports');
            await fs.mkdir(baseDir, { recursive: true });
            const filePath = path.join(baseDir, `${id}.xlsx`);
            await fs.writeFile(filePath, buffer);

            job.file_path = filePath;
            job.status = 'completed';
            job.completed_at = new Date();
        } catch (e: any) {
            job.status = 'failed';
            job.error_message = e?.message || String(e);
            job.completed_at = new Date();
        }

        await this.jobRepository.save(job);
    }
}
