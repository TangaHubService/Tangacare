import { Request, Response } from 'express';
import { ResponseUtil } from '../../utils/response.util';
import { InsuranceProviderService } from '../../services/pharmacy/insurance-provider.service';
import { InsuranceService } from '../../services/pharmacy/insurance.service';
import { resolveFacilityId } from '../../utils/request.util';

export class InsuranceController {
    private providerService: InsuranceProviderService;
    private insuranceService: InsuranceService;

    constructor() {
        this.providerService = new InsuranceProviderService();
        this.insuranceService = new InsuranceService();
    }

    // Provider Endpoints
    findAllProviders = async (_req: Request, res: Response): Promise<void> => {
        try {
            const providers = await this.providerService.findAll();
            ResponseUtil.success(res, providers, 'Insurance providers retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch insurance providers', error.message);
        }
    };

    createProvider = async (req: Request, res: Response): Promise<void> => {
        try {
            const provider = await this.providerService.create(req.body);
            ResponseUtil.success(res, provider, 'Insurance provider created successfully', 201);
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to create insurance provider', error.message);
        }
    };

    updateProvider = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id, 10);
            const provider = await this.providerService.update(id, req.body);
            ResponseUtil.success(res, provider, 'Insurance provider updated successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to update insurance provider', error.message);
        }
    };

    // Claim Endpoints
    findAllClaims = async (req: Request, res: Response): Promise<void> => {
        try {
            const { status, provider_id, start_date, end_date } = req.query;

            const claims = await this.insuranceService.findAll(
                {
                    status: status as any,
                    provider_id: provider_id ? parseInt(provider_id as any, 10) : undefined,
                    start_date: start_date as string,
                    end_date: end_date as string,
                },
                req as any,
            );
            ResponseUtil.success(res, claims, 'Insurance claims retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch insurance claims', error.message);
        }
    };


    createClaim = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.forbidden(res, 'Facility context missing.');
                return;
            }

            const claim = await this.insuranceService.createClaim({
                ...req.body,
                facility_id: parseInt(facilityId as any, 10),
            });
            ResponseUtil.success(res, claim, 'Insurance claim created successfully', 201);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create insurance claim', error.message);
        }
    };

    updateClaim = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);

            if (!facilityId || !user?.userId) {
                ResponseUtil.forbidden(res, 'User identity or facility context missing.');
                return;
            }

            const id = parseInt(req.params.id, 10);
            const claim = await this.insuranceService.updateClaim(
                id,
                req.body,
                user.userId,
                parseInt(facilityId as any, 10),
            );
            ResponseUtil.success(res, claim, 'Insurance claim updated successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to update insurance claim', error.message);
        }
    };
}
