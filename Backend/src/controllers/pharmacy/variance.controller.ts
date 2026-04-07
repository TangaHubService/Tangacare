import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { VarianceService, CreateVarianceDto, VarianceReportFilters } from '../../services/pharmacy/variance.service';
import { VarianceType, VarianceStatus } from '../../entities/StockVariance.entity';
import { AppError } from '../../middleware/error.middleware';
import { resolveFacilityId } from '../../utils/request.util';

export class VarianceController {
    private varianceService: VarianceService;

    constructor() {
        this.varianceService = new VarianceService();
    }

    recordVariance = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const userId = req.user?.userId;
            const organizationId = req.user?.organizationId;

            if (!userId) throw new AppError('User ID is required', 400);
            if (!organizationId) throw new AppError('Organization context missing', 400);

            const data: CreateVarianceDto = {
                facility_id: facilityId!,
                organization_id: organizationId,
                medicine_id: req.body.medicine_id,
                batch_id: req.body.batch_id,
                physical_quantity: req.body.physical_quantity,
                variance_type: req.body.variance_type || VarianceType.PHYSICAL_COUNT,
                reason: req.body.reason,
                notes: req.body.notes,
                counted_by_id: userId,
                counted_at: req.body.counted_at ? new Date(req.body.counted_at) : undefined,
            };

            const variance = await this.varianceService.recordVariance(data);

            res.status(201).json({
                status: 'success',
                message: 'Variance recorded successfully',
                data: variance,
            });
        } catch (error) {
            next(error);
        }
    };

    approveVariance = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const organizationId = req.user?.organizationId;
            const adjustStock = req.body.adjust_stock !== false;

            if (!userId) throw new AppError('User ID is required', 400);
            if (!organizationId) throw new AppError('Organization context missing', 400);

            const variance = await this.varianceService.approveVariance(Number(id), organizationId, userId, adjustStock);

            res.status(200).json({
                status: 'success',
                message: 'Variance approved successfully',
                data: variance,
            });
        } catch (error) {
            next(error);
        }
    };

    rejectVariance = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const organizationId = req.user?.organizationId;
            const reason = req.body.reason;

            if (!userId) throw new AppError('User ID is required', 400);
            if (!organizationId) throw new AppError('Organization context missing', 400);

            const variance = await this.varianceService.rejectVariance(Number(id), organizationId, userId, reason);

            res.status(200).json({
                status: 'success',
                message: 'Variance rejected successfully',
                data: variance,
            });
        } catch (error) {
            next(error);
        }
    };

    getVarianceReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = req.user?.organizationId;

            const filters: VarianceReportFilters = {
                facility_id: facilityId!,
                organization_id: organizationId,
                start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
                end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
                status: req.query.status as VarianceStatus | undefined,
                variance_type: req.query.variance_type as VarianceType | undefined,
                medicine_id: req.query.medicine_id ? Number(req.query.medicine_id) : undefined,
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 50,
            };

            const report = await this.varianceService.getVarianceReport(filters);

            res.status(200).json({
                status: 'success',
                message: 'Variance report retrieved successfully',
                ...report,
            });
        } catch (error) {
            next(error);
        }
    };

    getVarianceById = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const facilityId = resolveFacilityId(req);
            const organizationId = req.user?.organizationId;
            const variance = await this.varianceService.getVarianceById(Number(id), organizationId, facilityId ?? undefined);

            res.status(200).json({
                status: 'success',
                message: 'Variance retrieved successfully',
                data: variance,
            });
        } catch (error) {
            next(error);
        }
    };
}
