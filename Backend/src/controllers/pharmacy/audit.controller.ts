import { Request, Response } from 'express';
import { AuditService } from '../../services/pharmacy/audit.service';
import { ResponseUtil } from '../../utils/response.util';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';

export class AuditController {
    private auditService: AuditService;

    constructor() {
        this.auditService = new AuditService();
    }

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId = user?.organizationId;
            const scopedFacilityId = (req as any).scopedFacilityId;

            const facilityId =
                scopedFacilityId !== undefined
                    ? scopedFacilityId
                    : req.query.facilityId
                      ? parseInt(req.query.facilityId as string, 10)
                      : undefined;

            const entityType = req.query.entityType as AuditEntityType | undefined;
            const action = req.query.action as AuditAction | undefined;
            const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
            const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 100) : 50;

            const result = await this.auditService.findAll(
                facilityId,
                undefined,
                entityType,
                action,
                page,
                limit,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Audit logs retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to get audit logs', error.message);
        }
    };

    getOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id, 10);
            const user = (req as any).user;
            const organizationId = user?.organizationId;
            const scopedFacilityId = (req as any).scopedFacilityId;

            const log = await this.auditService.findOne(id, scopedFacilityId, organizationId);
            ResponseUtil.success(res, log, 'Audit log retrieved successfully');
        } catch (error: any) {
            if (error.message === 'Audit log not found') {
                ResponseUtil.error(res, error.message, 404);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to get audit log', error.message);
        }
    };

    getStockMovements = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId = user?.organizationId;
            const scopedFacilityId = (req as any).scopedFacilityId;

            const facilityId =
                scopedFacilityId !== undefined
                    ? scopedFacilityId
                    : req.query.facilityId
                      ? parseInt(req.query.facilityId as string, 10)
                      : undefined;

            if (!facilityId && !organizationId) {
                ResponseUtil.error(res, 'Facility or Organization context required', 400);
                return;
            }
            const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
            const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
            const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
            const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 100) : 50;

            const search =
                typeof req.query.search === 'string' && req.query.search.trim().length >= 2
                    ? req.query.search.trim()
                    : undefined;

            const result = await this.auditService.getStockMovements(
                facilityId,
                startDate,
                endDate,
                page,
                limit,
                organizationId,
                search,
            );
            ResponseUtil.success(res, result, 'Stock movements retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to get stock movements', error.message);
        }
    };
}
