import { Request, Response } from 'express';
import { OrganizationService } from '../../services/pharmacy/organization.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../dto/pharmacy.dto';
import { resolveOrganizationId } from '../../utils/request.util';

export class OrganizationController {
    private organizationService: OrganizationService;

    constructor() {
        this.organizationService = new OrganizationService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.organizationService.create(req.body as CreateOrganizationDto);
            ResponseUtil.created(res, result, 'Organization created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create organization', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string;
            const organizationId = resolveOrganizationId(req);
            const user = (req as any).user;
            const isSuperAdmin = user?.role === 'super_admin';

            if (!organizationId && !isSuperAdmin) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.organizationService.findAll(page, limit, search, organizationId);
            ResponseUtil.success(res, result, 'Organizations retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve organizations', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            if (organizationId !== id) {
                ResponseUtil.error(res, 'You do not have permission to access this organization', 403);
                return;
            }
            const result = await this.organizationService.findOne(id);
            ResponseUtil.success(res, result, 'Organization retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve organization', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            if (organizationId !== id) {
                ResponseUtil.error(res, 'You do not have permission to update this organization', 403);
                return;
            }
            const result = await this.organizationService.update(id, req.body as UpdateOrganizationDto);
            ResponseUtil.success(res, result, 'Organization updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update organization', error.message);
            }
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            if (organizationId !== id) {
                ResponseUtil.error(res, 'You do not have permission to delete this organization', 403);
                return;
            }
            await this.organizationService.delete(id);
            ResponseUtil.success(res, null, 'Organization deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete organization', error.message);
            }
        }
    };
}
