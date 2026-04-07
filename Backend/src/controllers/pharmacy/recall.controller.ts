import { Request, Response } from 'express';
import { RecallService } from '../../services/pharmacy/recall.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import { PdfUtil } from '../../utils/pdf.util';
import { AppDataSource } from '../../config/database';
import { BatchRecall } from '../../entities/BatchRecall.entity';
import { RecallStatus } from '../../entities/BatchRecall.entity';

export class RecallController {
    private recallService: RecallService;

    constructor() {
        this.recallService = new RecallService();
    }

    /**
     * GET /pharmacy/recalls
     */
    getRecalls = async (req: Request, res: Response): Promise<void> => {
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

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const status = req.query.status as RecallStatus | undefined;

            const result = await this.recallService.getRecallList(facilityId, organizationId, status, page, limit);
            ResponseUtil.success(res, result, 'Recalls retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch recalls', error.message);
        }
    };

    /**
     * POST /pharmacy/recalls
     */
    initiateRecall = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const user = (req as any).user;

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const recallData = {
                ...req.body,
                facility_id: facilityId,
                organization_id: organizationId,
                initiated_by_id: user?.userId,
            };

            const result = await this.recallService.initiateRecall(recallData);
            ResponseUtil.success(res, result, 'Recall initiated successfully', 201);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to initiate recall', error.message);
        }
    };

    /**
     * GET /pharmacy/recalls/:id/notice
     * Downloads the Recall Notice PDF
     */
    downloadNotice = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id, 10);
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const recallRepo = AppDataSource.getRepository(BatchRecall);

            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const recall = await recallRepo.findOne({
                where: facilityId
                    ? { id, facility_id: facilityId, organization_id: organizationId }
                    : { id, organization_id: organizationId },
                relations: ['medicine', 'batch', 'facility'],
            });

            if (!recall) {
                ResponseUtil.notFound(res, 'Recall not found');
                return;
            }

            const fileName = `recall_notice_${recall.batch?.batch_number || id}`;
            await PdfUtil.generateRecallNotice(res, recall, fileName);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate recall notice', error.message);
        }
    };

    /**
     * GET /pharmacy/recalls/:id/affected-sales
     */
    getAffectedSales = async (req: Request, res: Response): Promise<void> => {
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
            const id = parseInt(req.params.id, 10);
            const result = await this.recallService.getRecallById(id, organizationId, facilityId);
            ResponseUtil.success(res, result.affected_sales, 'Affected sales retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch affected sales', error.message);
        }
    };

    /**
     * GET /pharmacy/recalls/:id
     */
    getRecallById = async (req: Request, res: Response): Promise<void> => {
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

            const id = parseInt(req.params.id, 10);
            const result = await this.recallService.getRecallById(id, organizationId, facilityId);
            ResponseUtil.success(res, result, 'Recall retrieved successfully');
        } catch (error: any) {
            if (error.message === 'Recall not found') {
                ResponseUtil.notFound(res, error.message);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to fetch recall', error.message);
        }
    };
}
