import { Request, Response } from 'express';
import { BatchService } from '../../services/pharmacy/batch.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateBatchDto, UpdateBatchDto } from '../../dto/pharmacy.dto';
import { resolveFacilityId } from '../../utils/request.util';

export class BatchController {
    private batchService: BatchService;

    constructor() {
        this.batchService = new BatchService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const createDto = { ...(req.body as CreateBatchDto) };
            const facilityId = resolveFacilityId(req);
            const organizationId = (req as any).user?.organizationId;
            if (facilityId) {
                (createDto as any).facility_id = facilityId;
            }
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.batchService.create(createDto, organizationId);
            ResponseUtil.created(res, result, 'Batch created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create batch', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = (req as any).user?.organizationId;
            const medicineId = req.query.medicine_id ? parseInt(req.query.medicine_id as string) : undefined;

            if (medicineId !== undefined && isNaN(medicineId)) {
                ResponseUtil.error(res, 'Invalid medicine ID', 400);
                return;
            }
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const includeExpired = req.query.include_expired === 'true';
            const result = await this.batchService.findAll(organizationId, medicineId, includeExpired, facilityId ?? undefined);
            ResponseUtil.success(res, result, 'Batches retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve batches', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                ResponseUtil.error(res, 'Invalid batch ID', 400);
                return;
            }
            const facilityId = resolveFacilityId(req);
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.batchService.findOne(id, organizationId, facilityId ?? undefined);
            ResponseUtil.success(res, result, 'Batch retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve batch', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                ResponseUtil.error(res, 'Invalid batch ID', 400);
                return;
            }
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.batchService.update(id, req.body as UpdateBatchDto, organizationId);
            ResponseUtil.success(res, result, 'Batch updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update batch', error.message);
            }
        }
    };

    getExpiring = async (req: Request, res: Response): Promise<void> => {
        try {
            const days = req.query.days ? parseInt(req.query.days as string) : 30;
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.batchService.getExpiringBatches(organizationId, days);
            ResponseUtil.success(res, result, 'Expiring batches retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve expiring batches', error.message);
        }
    };
}
