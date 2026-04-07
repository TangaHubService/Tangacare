import { Request, Response } from 'express';
import { PrescriptionService, PaymentService, HealthRecordService, HealthTipService } from '../services/index.service';
import { ResponseUtil } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';

export class PrescriptionController {
    private prescriptionService: PrescriptionService;

    constructor() {
        this.prescriptionService = new PrescriptionService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.prescriptionService.create(req.body);
            ResponseUtil.created(res, result, 'Prescription created successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create prescription', error.message);
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const filters = {
                patient_id: req.query.patient_id ? parseInt(req.query.patient_id as string) : undefined,
                doctor_id: req.query.doctor_id ? parseInt(req.query.doctor_id as string) : undefined,
            };
            const result = await this.prescriptionService.findAll(filters);
            ResponseUtil.success(res, result, 'Prescriptions retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve prescriptions', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const result = await this.prescriptionService.findOne(id);
            ResponseUtil.success(res, result, 'Prescription retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve prescription', error.message);
            }
        }
    };
}

export class PaymentController {
    private paymentService: PaymentService;

    constructor() {
        this.paymentService = new PaymentService();
    }

    initiate = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const patientId = req.user!.userId;
            const result = await this.paymentService.initiate(patientId, req.body);
            ResponseUtil.created(res, result, 'Payment initiated successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to initiate payment', error.message);
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const filters = {
                patient_id: req.query.patient_id ? parseInt(req.query.patient_id as string) : undefined,
            };
            const result = await this.paymentService.findAll(filters);
            ResponseUtil.success(res, result, 'Payments retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve payments', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const result = await this.paymentService.findOne(id);
            ResponseUtil.success(res, result, 'Payment retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve payment', error.message);
            }
        }
    };

    handleWebhook = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.paymentService.handleWebhook(req.body);
            ResponseUtil.success(res, null, 'Webhook processed successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to process webhook', error.message);
        }
    };
}

export class HealthRecordController {
    private healthRecordService: HealthRecordService;

    constructor() {
        this.healthRecordService = new HealthRecordService();
    }

    create = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const patientId = req.user!.userId;
            const result = await this.healthRecordService.create(patientId, req.body);
            ResponseUtil.created(res, result, 'Health record created successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create health record', error.message);
        }
    };

    findAll = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const patientId = req.user!.userId;
            const result = await this.healthRecordService.findAll(patientId);
            ResponseUtil.success(res, result, 'Health records retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve health records', error.message);
        }
    };
}

export class HealthTipController {
    private healthTipService: HealthTipService;

    constructor() {
        this.healthTipService = new HealthTipService();
    }

    create = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const authorId = req.user!.userId;
            const result = await this.healthTipService.create(authorId, req.body);
            ResponseUtil.created(res, result, 'Health tip created successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create health tip', error.message);
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const filters = {
                category: req.query.category as string,
                language: req.query.language as string,
            };
            const result = await this.healthTipService.findAll(filters);
            ResponseUtil.success(res, result, 'Health tips retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve health tips', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const result = await this.healthTipService.findOne(id);
            ResponseUtil.success(res, result, 'Health tip retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve health tip', error.message);
            }
        }
    };
}
