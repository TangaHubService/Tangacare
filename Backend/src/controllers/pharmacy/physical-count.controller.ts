import { Request, Response } from 'express';
import { PhysicalCountService } from '../../services/pharmacy/physical-count.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId } from '../../utils/request.util';

export class PhysicalCountController {
    private physicalCountService: PhysicalCountService;

    constructor() {
        this.physicalCountService = new PhysicalCountService();
    }

    private resolveUserId(req: Request): number | undefined {
        const user = (req as any).user;
        const rawUserId = user?.userId ?? user?.id;
        const userId = Number(rawUserId);
        return Number.isFinite(userId) && userId > 0 ? userId : undefined;
    }

    private resolveOrganizationId(req: Request): number | undefined {
        const user = (req as any).user;
        const orgId = Number(user?.organizationId);
        return Number.isFinite(orgId) && orgId > 0 ? orgId : undefined;
    }

    startCount = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = this.resolveUserId(req);
            const facilityId = resolveFacilityId(req);
            const organizationId = this.resolveOrganizationId(req);
            const { medicineIds } = req.body;

            if (!userId) {
                ResponseUtil.unauthorized(res, 'Authenticated user ID is required');
                return;
            }
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const result = await this.physicalCountService.createPhysicalCount(
                facilityId,
                organizationId,
                userId,
                medicineIds,
            );
            ResponseUtil.success(res, result, 'Physical count started successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to start physical count', error.message);
        }
    };

    updateItem = async (req: Request, res: Response): Promise<void> => {
        try {
            const itemId = parseInt(req.params.itemId, 10);
            const { countedQuantity, notes } = req.body;

            if (isNaN(itemId)) {
                ResponseUtil.badRequest(res, 'Item ID is required');
                return;
            }

            const result = await this.physicalCountService.updateCountItem(itemId, countedQuantity, notes);
            ResponseUtil.success(res, result, 'Count item updated successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update count item', error.message);
        }
    };

    approveCount = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = this.resolveUserId(req);
            const organizationId = this.resolveOrganizationId(req);
            const countId = parseInt(req.params.countId, 10);

            if (isNaN(countId)) {
                ResponseUtil.badRequest(res, 'Count ID is required');
                return;
            }
            if (!userId) {
                ResponseUtil.unauthorized(res, 'Authenticated user ID is required');
                return;
            }
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const result = await this.physicalCountService.approvePhysicalCount(countId, organizationId, userId);
            ResponseUtil.success(res, result, 'Physical count approved and inventory reconciled');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to approve physical count', error.message);
        }
    };

    getCount = async (req: Request, res: Response): Promise<void> => {
        try {
            const countId = parseInt(req.params.countId, 10);
            const organizationId = this.resolveOrganizationId(req);
            const result = await this.physicalCountService.getPhysicalCount(countId, organizationId);
            ResponseUtil.success(res, result, 'Physical count retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve physical count', error.message);
        }
    };

    listCounts = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = this.resolveOrganizationId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const result = await this.physicalCountService.listPhysicalCounts(facilityId, organizationId);
            ResponseUtil.success(res, result, 'Physical counts listed successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to list physical counts', error.message);
        }
    };
}
