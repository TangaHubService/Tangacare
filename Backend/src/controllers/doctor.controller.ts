import { Request, Response } from 'express';
import { DoctorService } from '../services/doctor.service';
import { ResponseUtil } from '../utils/response.util';
import { CreateDoctorDto, UpdateDoctorDto } from '../dto/index.dto';

export class DoctorController {
    private doctorService: DoctorService;

    constructor() {
        this.doctorService = new DoctorService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.doctorService.create(req.body as CreateDoctorDto, organizationId);
            ResponseUtil.created(res, result, 'Doctor profile created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create doctor profile', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const filters = {
                specialization: req.query.specialization as string,
                is_available: req.query.is_available ? req.query.is_available === 'true' : undefined,
                organization_id: organizationId,
            };
            const result = await this.doctorService.findAll(filters);
            ResponseUtil.success(res, result, 'Doctors retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve doctors', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.doctorService.findOne(id, organizationId);
            ResponseUtil.success(res, result, 'Doctor retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve doctor', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.doctorService.update(id, organizationId, req.body as UpdateDoctorDto);
            ResponseUtil.success(res, result, 'Doctor profile updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update doctor profile', error.message);
            }
        }
    };

    getSpecializations = async (_req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (_req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.doctorService.getSpecializations(organizationId);
            ResponseUtil.success(res, result, 'Specializations retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve specializations', error.message);
        }
    };
}
