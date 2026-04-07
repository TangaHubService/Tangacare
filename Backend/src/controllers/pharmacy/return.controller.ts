import { Request, Response, NextFunction } from 'express';
import { ReturnService } from '../../services/pharmacy/return.service';
import { CreateReturnDto, ReturnFiltersDto } from '../../dto/pharmacy.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { resolveFacilityId } from '../../utils/request.util';

export class ReturnController {
    private returnService: ReturnService;

    constructor() {
        this.returnService = new ReturnService();
    }

    createReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const createDto = plainToClass(CreateReturnDto, req.body);
            const errors = await validate(createDto);

            if (errors.length > 0) {
                res.status(400).json({ errors });
                return;
            }

            const user = (req as any).user;
            const userId = user?.userId;
            const facilityId = resolveFacilityId(req);

            if (!userId) {
                res.status(401).json({ message: 'User ID is required' });
                return;
            }

            if (!facilityId) {
                res.status(400).json({ message: 'Facility ID is required' });
                return;
            }

            const customerReturn = await this.returnService.createReturn(createDto, userId, facilityId);

            res.status(201).json({
                message: 'Return created successfully',
                data: customerReturn,
            });
        } catch (error) {
            next(error);
        }
    };

    listReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const filters: ReturnFiltersDto = {
                facility_id: resolveFacilityId(req),
                status: req.query.status as string,
                start_date: req.query.start_date as string,
                end_date: req.query.end_date as string,
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
            };

            const result = await this.returnService.listReturns(filters);

            res.status(200).json({
                message: 'Returns retrieved successfully',
                ...result,
            });
        } catch (error) {
            next(error);
        }
    };

    getReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const customerReturn = await this.returnService.getReturn(returnId);

            res.status(200).json({
                message: 'Return retrieved successfully',
                data: customerReturn,
            });
        } catch (error) {
            next(error);
        }
    };

    approveReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const userId = (req as any).user?.userId;

            const customerReturn = await this.returnService.approveReturn(returnId, userId);

            res.status(200).json({
                message: 'Return approved successfully',
                data: customerReturn,
            });
        } catch (error) {
            next(error);
        }
    };

    rejectReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const userId = (req as any).user?.userId;
            const { reason } = req.body;

            if (!reason) {
                res.status(400).json({ message: 'Rejection reason is required' });
                return;
            }

            const customerReturn = await this.returnService.rejectReturn(returnId, userId, reason);

            res.status(200).json({
                message: 'Return rejected successfully',
                data: customerReturn,
            });
        } catch (error) {
            next(error);
        }
    };

    processRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const returnId = Number(req.params.id);
            const customerReturn = await this.returnService.processRefund(returnId);

            res.status(200).json({
                message: 'Refund processed successfully',
                data: customerReturn,
            });
        } catch (error) {
            next(error);
        }
    };
}
