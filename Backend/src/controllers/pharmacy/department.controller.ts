import { Request, Response } from 'express';
import { DepartmentService } from '../../services/pharmacy/department.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../dto/pharmacy.dto';
import { resolveFacilityId } from '../../utils/request.util';

export class DepartmentController {
    private departmentService: DepartmentService;

    constructor() {
        this.departmentService = new DepartmentService();
    }

    create = async (req: any, res: Response): Promise<void> => {
        try {
            const createDto = req.body as CreateDepartmentDto;
            const facilityId = resolveFacilityId(req);
            if (facilityId) {
                createDto.facility_id = facilityId;
            }
            const result = await this.departmentService.create(createDto);
            ResponseUtil.created(res, result, 'Department created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create department', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const facilityId = resolveFacilityId(req);

            const result = await this.departmentService.findAll(facilityId, page, limit);
            ResponseUtil.success(res, result, 'Departments retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve departments', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                ResponseUtil.error(res, 'Invalid department ID', 400);
                return;
            }
            const facilityId = (req as any).user?.facilityId;
            const result = await this.departmentService.findOne(id, facilityId);
            ResponseUtil.success(res, result, 'Department retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve department', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                ResponseUtil.error(res, 'Invalid department ID', 400);
                return;
            }
            const facilityId = (req as any).user?.facilityId;
            const result = await this.departmentService.update(id, req.body as UpdateDepartmentDto, facilityId);
            ResponseUtil.success(res, result, 'Department updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update department', error.message);
            }
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                ResponseUtil.error(res, 'Invalid department ID', 400);
                return;
            }
            const facilityId = (req as any).user?.facilityId;
            await this.departmentService.delete(id, facilityId);
            ResponseUtil.success(res, null, 'Department deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete department', error.message);
            }
        }
    };
}
