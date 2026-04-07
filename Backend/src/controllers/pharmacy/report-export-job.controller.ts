import { Response } from 'express';
import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ReportExportJobService } from '../../services/pharmacy/report-export-job.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import path from 'path';

export class ReportExportJobController {
    private readonly jobService = new ReportExportJobService();

    /** POST body: { type, format, ...same query fields as sync export e.g. start_date, end_date } */
    createJob = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req as any);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const organizationId = resolveOrganizationId(req as any);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context is required');
                return;
            }

            const body = req.body || {};
            const { type, format, ...queryFields } = body;
            if (!type || !format) {
                ResponseUtil.badRequest(res, 'Body must include `type` and `format`');
                return;
            }

            const job = await this.jobService.enqueue({
                organizationId,
                facilityId,
                userId: req.user?.userId ?? null,
                reportType: String(type),
                format: String(format).toLowerCase(),
                query: queryFields as any,
            });

            ResponseUtil.created(
                res,
                {
                    id: job.id,
                    status: job.status,
                    poll_url: `/api/pharmacy/reports/export-jobs/${job.id}`,
                    download_url: `/api/pharmacy/reports/export-jobs/${job.id}/download`,
                },
                'Export job queued',
            );
        } catch (error: any) {
            if (error instanceof AppError) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to create export job', error?.message);
        }
    };

    getJob = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req as any);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context is required');
                return;
            }
            const { jobId } = req.params;
            const job = await this.jobService.getById(jobId, organizationId);
            if (!job) {
                ResponseUtil.error(res, 'Job not found', 404);
                return;
            }

            ResponseUtil.success(
                res,
                {
                    id: job.id,
                    status: job.status,
                    report_type: job.report_type,
                    format: job.format,
                    error_message: job.error_message,
                    created_at: job.created_at,
                    completed_at: job.completed_at,
                },
                'Export job status',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to load export job', error?.message);
        }
    };

    download = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req as any);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context is required');
                return;
            }
            const { jobId } = req.params;
            const job = await this.jobService.getById(jobId, organizationId);
            if (!job) {
                ResponseUtil.error(res, 'Job not found', 404);
                return;
            }
            const fp = this.jobService.getDownloadPath(job);
            if (!fp) {
                ResponseUtil.error(res, 'Export not ready or failed', 400);
                return;
            }

            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${path.basename(fp)}"`,
            );
            res.sendFile(path.resolve(fp));
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to download export', error?.message);
        }
    };
}
