import { Request, Response } from 'express';
import { FacilityService } from '../../services/pharmacy/facility.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateFacilityDto, UpdateFacilityDto } from '../../dto/pharmacy.dto';
import { resolveOrganizationId } from '../../utils/request.util';

export class FacilityController {
    private facilityService: FacilityService;

    constructor() {
        this.facilityService = new FacilityService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.facilityService.create(
                req.body as CreateFacilityDto,
                user?.userId,
                user?.role,
                organizationId,
            );
            ResponseUtil.created(res, result, 'Facility created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create facility', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string;

            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            const isSuperAdmin = user?.role === 'super_admin';

            if (!organizationId && !isSuperAdmin) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const filterAdminId = user?.role === 'facility_admin' ? user.userId : undefined;

            const result = await this.facilityService.findAll(
                page,
                limit,
                search,
                filterAdminId,
                undefined,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Facilities retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve facilities', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const facilityId = user?.facilityId;
            const role = user?.role;

            if (role === 'facility_admin') {
                const assigned = await this.facilityService.findByAdminId(user.userId, organizationId);
                if (!assigned || assigned.id !== id) {
                    ResponseUtil.error(res, 'You do not have permission to access this facility', 403);
                    return;
                }
                ResponseUtil.success(res, assigned, 'Facility retrieved successfully');
                return;
            }

            if (role === 'owner' && organizationId) {
                const facility = await this.facilityService.findOne(id, organizationId);
                ResponseUtil.success(res, facility, 'Facility retrieved successfully');
                return;
            }
            if (facilityId && facilityId !== id) {
                ResponseUtil.error(res, 'You do not have permission to access this facility', 403);
                return;
            }
            const result = await this.facilityService.findOne(id, organizationId);
            ResponseUtil.success(res, result, 'Facility retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve facility', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const facilityId = user?.facilityId;
            const role = user?.role;
            if (role === 'facility_admin') {
                const assigned = await this.facilityService.findByAdminId(user.userId, organizationId);
                if (!assigned || assigned.id !== id) {
                    ResponseUtil.error(res, 'You do not have permission to update this facility', 403);
                    return;
                }
            } else if (role === 'owner') {
                if (organizationId) {
                    await this.facilityService.findOne(id, organizationId);
                } else if (facilityId) {
                    if (facilityId !== id) {
                        ResponseUtil.error(res, 'You do not have permission to update this facility', 403);
                        return;
                    }
                } else {
                    ResponseUtil.error(res, 'You do not have permission to update this facility', 403);
                    return;
                }
            } else {
                if (facilityId && facilityId !== id) {
                    ResponseUtil.error(res, 'You do not have permission to update this facility', 403);
                    return;
                }

                if (!facilityId) {
                    ResponseUtil.error(res, 'You do not have permission to update this facility', 403);
                    return;
                }
            }
            const result = await this.facilityService.update(id, req.body as UpdateFacilityDto, organizationId);
            ResponseUtil.success(res, result, 'Facility updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update facility', error.message);
            }
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);

            if (user?.role !== 'super_admin') {
                ResponseUtil.error(res, 'Only Super Admin can delete facilities', 403);
                return;
            }
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            await this.facilityService.delete(id, organizationId);
            ResponseUtil.success(res, null, 'Facility deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete facility', error.message);
            }
        }
    };
}
