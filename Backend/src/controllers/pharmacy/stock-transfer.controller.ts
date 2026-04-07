import { Request, Response } from 'express';
import { StockTransferService } from '../../services/pharmacy/stock-transfer.service';
import { ResponseUtil } from '../../utils/response.util';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CreateStockTransferDto, UpdateStockTransferDto } from '../../dto/pharmacy.dto';
import { StockTransferStatus } from '../../entities/StockTransfer.entity';
import { resolveFacilityId } from '../../utils/request.util';

export class StockTransferController {
    private transferService: StockTransferService;

    constructor() {
        this.transferService = new StockTransferService();
    }

    create = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const createDto = req.body as CreateStockTransferDto;
            const facilityId = resolveFacilityId(req);
            const organizationId = req.user?.organizationId;
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            if (facilityId) { createDto.facility_id = facilityId; }
            createDto.organization_id = organizationId;
            const result = await this.transferService.create(createDto, userId);
            ResponseUtil.created(res, result, 'Stock transfer created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create stock transfer', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const facilityId = resolveFacilityId(req);
            const organizationId = (req as any).user?.organizationId;
            const status = req.query.status as StockTransferStatus | undefined;
            let fromDepartmentId: number | null | undefined = undefined;
            let toDepartmentId: number | null | undefined = undefined;

            if (req.query.from_department_id !== undefined) {
                fromDepartmentId =
                    req.query.from_department_id === 'null' ? null : parseInt(req.query.from_department_id as string);
            }

            if (req.query.to_department_id !== undefined) {
                toDepartmentId =
                    req.query.to_department_id === 'null' ? null : parseInt(req.query.to_department_id as string);
            }

            const result = await this.transferService.findAll(
                organizationId,
                facilityId ?? undefined,
                status,
                fromDepartmentId,
                toDepartmentId,
                page,
                limit,
            );
            ResponseUtil.success(res, result, 'Stock transfers retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve stock transfers', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const facilityId = resolveFacilityId(req);
            const organizationId = (req as any).user?.organizationId;
            const result = await this.transferService.findOne(id, organizationId, facilityId ?? undefined);
            ResponseUtil.success(res, result, 'Stock transfer retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve stock transfer', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const facilityId = resolveFacilityId(req);
            const result = await this.transferService.update(id, req.body as UpdateStockTransferDto, facilityId);
            ResponseUtil.success(res, result, 'Stock transfer updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update stock transfer', error.message);
            }
        }
    };

    complete = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const userId = req.user!.userId;
            const facilityId = resolveFacilityId(req);
            const organizationId = req.user?.organizationId;
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.transferService.completeTransfer(id, userId, organizationId, facilityId ?? undefined);
            ResponseUtil.success(res, result, 'Stock transfer completed successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to complete stock transfer', error.message);
            }
        }
    };

    cancel = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const userId = req.user!.userId;
            const facilityId = resolveFacilityId(req);
            const result = await this.transferService.cancelTransfer(id, userId, facilityId);
            ResponseUtil.success(res, result, 'Stock transfer cancelled successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to cancel stock transfer', error.message);
            }
        }
    };
}
