import { Request, Response, NextFunction } from 'express';
import { VendorReturnService } from '../../services/pharmacy/vendor-return.service';
import { CreateVendorReturnDto, VendorReturnFiltersDto } from '../../dto/pharmacy.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { resolveFacilityId } from '../../utils/request.util';
import { ResponseUtil } from '../../utils/response.util';

export class VendorReturnController {
    private vendorReturnService: VendorReturnService;

    constructor() {
        this.vendorReturnService = new VendorReturnService();
    }

    /** POST /pharmacy/vendor-returns */
    createVendorReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const dto = plainToClass(CreateVendorReturnDto, req.body);
            const errors = await validate(dto);
            if (errors.length > 0) {
                res.status(400).json({ errors });
                return;
            }

            const user = (req as any).user;
            const userId = user?.userId;
            const facilityId = resolveFacilityId(req);
            const organizationId = user?.organizationId;

            if (!userId) { res.status(401).json({ message: 'Authentication required' }); return; }
            if (!facilityId) { res.status(400).json({ message: 'Facility ID is required' }); return; }
            if (!organizationId) { res.status(400).json({ message: 'Organization context missing' }); return; }

            const result = await this.vendorReturnService.createVendorReturn(dto, userId, facilityId, organizationId);
            ResponseUtil.created(res, result, 'Vendor return created successfully');
        } catch (error) {
            next(error);
        }
    };

    /** GET /pharmacy/vendor-returns */
    listVendorReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as any).user;
            const filters: VendorReturnFiltersDto = {
                facility_id: resolveFacilityId(req),
                organization_id: user?.organizationId,
                status: req.query.status as string,
                supplier_id: req.query.supplier_id ? Number(req.query.supplier_id) : undefined,
                start_date: req.query.start_date as string,
                end_date: req.query.end_date as string,
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
            };
            const result = await this.vendorReturnService.listVendorReturns(filters);
            res.status(200).json({ message: 'Vendor returns retrieved successfully', ...result });
        } catch (error) {
            next(error);
        }
    };

    /** GET /pharmacy/vendor-returns/:id */
    getVendorReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const facilityId = resolveFacilityId(req);
            const organizationId = (req as any).user?.organizationId;
            const result = await this.vendorReturnService.getVendorReturn(returnId, organizationId, facilityId ?? undefined);
            res.status(200).json({ message: 'Vendor return retrieved successfully', data: result });
        } catch (error) {
            next(error);
        }
    };

    /** POST /pharmacy/vendor-returns/:id/approve */
    approveVendorReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const organizationId = user?.organizationId;
            if (!facilityId) { res.status(400).json({ message: 'Facility ID is required' }); return; }
            if (!organizationId) { res.status(400).json({ message: 'Organization context missing' }); return; }

            const result = await this.vendorReturnService.approveVendorReturn(returnId, organizationId, user?.userId, facilityId);
            res.status(200).json({ message: 'Vendor return approved successfully', data: result });
        } catch (error) {
            next(error);
        }
    };

    /** POST /pharmacy/vendor-returns/:id/reject */
    rejectVendorReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const organizationId = user?.organizationId;
            const { reason } = req.body;

            if (!reason) { res.status(400).json({ message: 'Rejection reason is required' }); return; }
            if (!facilityId) { res.status(400).json({ message: 'Facility ID is required' }); return; }
            if (!organizationId) { res.status(400).json({ message: 'Organization context missing' }); return; }

            const result = await this.vendorReturnService.rejectVendorReturn(returnId, organizationId, user?.userId, facilityId, reason);
            res.status(200).json({ message: 'Vendor return rejected', data: result });
        } catch (error) {
            next(error);
        }
    };
}
