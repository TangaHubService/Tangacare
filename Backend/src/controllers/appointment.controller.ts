import { Request, Response } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { ResponseUtil } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dto/index.dto';

export class AppointmentController {
    private appointmentService: AppointmentService;

    constructor() {
        this.appointmentService = new AppointmentService();
    }

    create = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const patientId = req.user!.userId;
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const result = await this.appointmentService.create(
                patientId,
                organizationId,
                req.body as CreateAppointmentDto,
            );
            ResponseUtil.created(res, result, 'Appointment booked successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to book appointment', error.message);
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
                patient_id: req.query.patient_id ? parseInt(req.query.patient_id as string) : undefined,
                doctor_id: req.query.doctor_id ? parseInt(req.query.doctor_id as string) : undefined,
                status: req.query.status as string,
                organization_id: organizationId,
            };
            const result = await this.appointmentService.findAll(filters);
            ResponseUtil.success(res, result, 'Appointments retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve appointments', error.message);
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
            const result = await this.appointmentService.findOne(id, organizationId);
            ResponseUtil.success(res, result, 'Appointment retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve appointment', error.message);
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
            const result = await this.appointmentService.update(id, organizationId, req.body as UpdateAppointmentDto);
            ResponseUtil.success(res, result, 'Appointment updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update appointment', error.message);
            }
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = (req as any).user?.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            await this.appointmentService.delete(id, organizationId);
            ResponseUtil.success(res, null, 'Appointment cancelled successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to cancel appointment', error.message);
            }
        }
    };

    checkAvailability = async (req: Request, res: Response): Promise<void> => {
        try {
            const doctorId = parseInt(req.query.doctor_id as string);
            const date = req.query.date as string;
            const organizationId = (req as any).user?.organizationId;

            if (!doctorId || !date || !organizationId) {
                ResponseUtil.badRequest(res, 'Doctor ID and date are required');
                return;
            }

            const result = await this.appointmentService.checkAvailability(doctorId, organizationId, date);
            ResponseUtil.success(res, result, 'Availability checked successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to check availability', error.message);
        }
    };
}
