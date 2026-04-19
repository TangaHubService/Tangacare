import { Request, Response } from 'express';
import { AppError } from '../../middleware/error.middleware';
import { QualityCaseService } from '../../services/pharmacy/quality-case.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateQualityCaseDto, UpdateQualityCaseDto } from '../../dto/pharmacy.dto';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

export class QualityCaseController {
    private service = new QualityCaseService();

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const facilityId = resolveFacilityId(req);
            const page = parseInt(req.query.page as string, 10) || 1;
            const limit = parseInt(req.query.limit as string, 10) || 50;
            const result = await this.service.list(organizationId, facilityId || undefined, page, limit);
            ResponseUtil.success(res, result, 'Quality cases retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to list quality cases', error.message);
        }
    };

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const dto = req.body as CreateQualityCaseDto;
            const saved = await this.service.create(dto, organizationId, user?.userId);
            ResponseUtil.success(res, saved, 'Quality case created', 201);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create quality case', error.message);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const id = parseInt(req.params.id, 10);
            const dto = req.body as UpdateQualityCaseDto;
            const saved = await this.service.update(id, organizationId, dto, user?.userId);
            ResponseUtil.success(res, saved, 'Quality case updated');
        } catch (error: any) {
            if (error instanceof AppError && error.statusCode === 404) {
                ResponseUtil.notFound(res, error.message);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to update quality case', error.message);
        }
    };
}
