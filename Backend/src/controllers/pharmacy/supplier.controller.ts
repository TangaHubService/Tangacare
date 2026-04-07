import { Request, Response } from 'express';
import { SupplierService } from '../../services/pharmacy/supplier.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateSupplierDto, UpdateSupplierDto } from '../../dto/pharmacy.dto';
import { resolveFacilityId } from '../../utils/request.util';

export class SupplierController {
    private supplierService: SupplierService;

    constructor() {
        this.supplierService = new SupplierService();
    }

    create = async (req: any, res: Response): Promise<void> => {
        try {
            const createDto = req.body as CreateSupplierDto;
            if (req.user?.organizationId) {
                createDto.organization_id = req.user.organizationId;
            }

            const facilityId = resolveFacilityId(req);
            if (facilityId) {
                createDto.facility_id = facilityId;
            }

            const userId = (req as any).user?.userId;
            const orgId = (req as any).user?.organizationId;
            const result = await this.supplierService.create(createDto, orgId, userId);
            ResponseUtil.created(res, result, 'Supplier created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create supplier', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string;
            const isActive =
                req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined;
            const organizationId = (req as any).user?.organizationId;
            const facilityId = resolveFacilityId(req);

            const result = await this.supplierService.findAll(
                organizationId,
                facilityId,
                page,
                limit,
                search,
                isActive,
            );
            ResponseUtil.success(res, result, 'Suppliers retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve suppliers', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = (req as any).user?.organizationId;
            const result = await this.supplierService.findOne(id, organizationId);
            ResponseUtil.success(res, result, 'Supplier retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve supplier', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = (req as any).user?.organizationId;
            const userId = (req as any).user?.userId;
            const result = await this.supplierService.update(id, req.body as UpdateSupplierDto, organizationId, userId);
            ResponseUtil.success(res, result, 'Supplier updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update supplier', error.message);
            }
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = (req as any).user?.organizationId;
            const userId = (req as any).user?.userId;
            await this.supplierService.delete(id, organizationId, userId);
            ResponseUtil.success(res, null, 'Supplier deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete supplier', error.message);
            }
        }
    };
}
