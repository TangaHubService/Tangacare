import { Request, Response } from 'express';
import {
    AcknowledgeColdChainExcursionDto,
    LogColdChainTelemetryDto,
    ResolveColdChainExcursionDto,
} from '../../dto/pharmacy.dto';
import { ColdChainExcursionStatus } from '../../entities/ColdChainExcursion.entity';
import { AppError } from '../../middleware/error.middleware';
import { ColdChainService } from '../../services/pharmacy/cold-chain.service';
import { resolveFacilityId } from '../../utils/request.util';
import { ResponseUtil } from '../../utils/response.util';

export class ColdChainController {
    private coldChainService: ColdChainService;

    constructor() {
        this.coldChainService = new ColdChainService();
    }

    getOverview = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                throw new AppError('Facility scope is required', 400);
            }

            const data = await this.coldChainService.getOverview(facilityId);
            ResponseUtil.success(res, data, 'Cold-chain overview retrieved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to fetch cold-chain overview', error.message);
        }
    };

    logTelemetry = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                throw new AppError('Facility scope is required', 400);
            }

            const locationId = parseInt(req.params.locationId, 10);
            if (Number.isNaN(locationId)) {
                throw new AppError('Valid locationId is required', 400);
            }

            const userId = (req as any).user?.userId;
            const payload = req.body as LogColdChainTelemetryDto;
            const result = await this.coldChainService.logTelemetry(facilityId, locationId, payload, userId);
            ResponseUtil.success(res, result, 'Cold-chain telemetry logged successfully', 201);
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to log cold-chain telemetry', error.message);
        }
    };

    getTelemetryHistory = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                throw new AppError('Facility scope is required', 400);
            }

            const locationId = parseInt(req.params.locationId, 10);
            if (Number.isNaN(locationId)) {
                throw new AppError('Valid locationId is required', 400);
            }

            const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
            const data = await this.coldChainService.getTelemetryHistory(facilityId, locationId, limit);
            ResponseUtil.success(res, data, 'Cold-chain telemetry history retrieved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to fetch cold-chain telemetry history', error.message);
        }
    };

    getExcursions = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                throw new AppError('Facility scope is required', 400);
            }

            const status = req.query.status as ColdChainExcursionStatus | undefined;
            const parsedStatus =
                status && Object.values(ColdChainExcursionStatus).includes(status)
                    ? status
                    : undefined;

            const locationId = req.query.location_id ? parseInt(String(req.query.location_id), 10) : undefined;
            const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

            const data = await this.coldChainService.getExcursions(facilityId, parsedStatus, locationId, limit);
            ResponseUtil.success(res, data, 'Cold-chain excursions retrieved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to fetch cold-chain excursions', error.message);
        }
    };

    acknowledgeExcursion = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                throw new AppError('Facility scope is required', 400);
            }

            const excursionId = parseInt(req.params.id, 10);
            if (Number.isNaN(excursionId)) {
                throw new AppError('Valid excursion id is required', 400);
            }

            const payload = req.body as AcknowledgeColdChainExcursionDto;
            const userId = (req as any).user?.userId;
            const data = await this.coldChainService.acknowledgeExcursion(
                facilityId,
                excursionId,
                userId,
                payload?.notes,
            );

            ResponseUtil.success(res, data, 'Cold-chain excursion acknowledged successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to acknowledge cold-chain excursion', error.message);
        }
    };

    resolveExcursion = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                throw new AppError('Facility scope is required', 400);
            }

            const excursionId = parseInt(req.params.id, 10);
            if (Number.isNaN(excursionId)) {
                throw new AppError('Valid excursion id is required', 400);
            }

            const payload = req.body as ResolveColdChainExcursionDto;
            const userId = (req as any).user?.userId;
            const data = await this.coldChainService.resolveExcursion(
                facilityId,
                excursionId,
                payload.action_taken,
                userId,
                payload.notes,
            );

            ResponseUtil.success(res, data, 'Cold-chain excursion resolved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to resolve cold-chain excursion', error.message);
        }
    };
}
