import { Request, Response } from 'express';
import { DispensingService } from '../../services/pharmacy/dispensing.service';
import { ResponseUtil } from '../../utils/response.util';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CreateDispenseTransactionDto } from '../../dto/pharmacy.dto';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import { IdempotencyStore } from '../../utils/idempotency.util';

export class DispensingController {
    private dispensingService: DispensingService;

    constructor() {
        this.dispensingService = new DispensingService();
    }

    dispense = async (req: AuthRequest, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        const facilityId = resolveFacilityId(req);
        const organizationId = resolveOrganizationId(req);
        const createDto = req.body as CreateDispenseTransactionDto;
        const idemHeader = req.headers['idempotency-key'];
        const idemKey =
            typeof idemHeader === 'string'
                ? IdempotencyStore.buildKey('dispense:create', idemHeader, facilityId, userId)
                : null;
        let shouldReleaseInFlight = false;

        try {
            if (facilityId) {
                createDto.facility_id = facilityId;
            }
            if (organizationId) {
                createDto.organization_id = organizationId;
            }

            if (idemKey) {
                const cached = await IdempotencyStore.get(idemKey);
                if (cached) {
                    res.status(cached.statusCode).json(cached.body);
                    return;
                }
                if (!(await IdempotencyStore.markInFlight(idemKey, 'dispense:create', facilityId, userId))) {
                    ResponseUtil.error(res, 'Request with same idempotency key is in progress', 409);
                    return;
                }
                shouldReleaseInFlight = true;
            }

            const result = await this.dispensingService.dispense(createDto, userId);
            const responseBody = {
                success: true,
                message: 'Medicine dispensed successfully',
                data: result,
                timestamp: new Date().toISOString(),
            };
            if (idemKey) {
                await IdempotencyStore.set(idemKey, 201, responseBody);
                shouldReleaseInFlight = false;
            }
            res.status(201).json(responseBody);
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to dispense medicine', error.message);
            }
        } finally {
            if (idemKey && shouldReleaseInFlight) {
                await IdempotencyStore.clearInFlight(idemKey);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const patientId = req.query.patient_id ? parseInt(req.query.patient_id as string) : undefined;

            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const result = await this.dispensingService.findAll(facilityId, organizationId, patientId, page, limit);
            ResponseUtil.success(res, result, 'Dispense transactions retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve dispense transactions', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const result = await this.dispensingService.findOne(id, organizationId, facilityId);
            ResponseUtil.success(res, result, 'Dispense transaction retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve dispense transaction', error.message);
            }
        }
    };

    getSubstitutions = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const medicineId = Number(req.params.medicineId);
            if (!Number.isInteger(medicineId) || medicineId <= 0) {
                ResponseUtil.badRequest(res, 'medicineId must be a positive integer');
                return;
            }

            const alternatives = await this.dispensingService.getSubstitutionRecommendations(
                facilityId,
                organizationId,
                medicineId,
            );
            ResponseUtil.success(
                res,
                {
                    medicine_id: medicineId,
                    alternatives,
                },
                'Substitution recommendations retrieved successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve substitution recommendations', error.message);
        }
    };
}
