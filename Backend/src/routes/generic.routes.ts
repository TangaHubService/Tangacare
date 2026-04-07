import { Router } from 'express';
import {
    PrescriptionController,
    PaymentController,
    HealthRecordController,
    HealthTipController,
} from '../controllers/generic.controller';
import { validateDto } from '../middleware/validation.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../entities/User.entity';
import { CreatePrescriptionDto, CreatePaymentDto, CreateHealthRecordDto, CreateHealthTipDto } from '../dto/index.dto';

const prescriptionRouter = Router();
const prescriptionController = new PrescriptionController();

prescriptionRouter.get('/', authenticate, prescriptionController.findAll);

prescriptionRouter.post(
    '/',
    authenticate,
    authorize(UserRole.DOCTOR),
    validateDto(CreatePrescriptionDto),
    prescriptionController.create,
);

prescriptionRouter.get('/:id', authenticate, prescriptionController.findOne);

const paymentRouter = Router();
const paymentController = new PaymentController();

paymentRouter.get('/', authenticate, paymentController.findAll);

paymentRouter.post('/initiate', authenticate, validateDto(CreatePaymentDto), paymentController.initiate);

paymentRouter.get('/:id', authenticate, paymentController.findOne);

paymentRouter.post('/webhook', paymentController.handleWebhook);

const healthRecordRouter = Router();
const healthRecordController = new HealthRecordController();

healthRecordRouter.get('/', authenticate, healthRecordController.findAll);

healthRecordRouter.post('/', authenticate, validateDto(CreateHealthRecordDto), healthRecordController.create);

const healthTipRouter = Router();
const healthTipController = new HealthTipController();

healthTipRouter.get('/', healthTipController.findAll);

healthTipRouter.get('/:id', healthTipController.findOne);

healthTipRouter.post(
    '/',
    authenticate,
    authorize(UserRole.ADMIN, UserRole.DOCTOR),
    validateDto(CreateHealthTipDto),
    healthTipController.create,
);

export { prescriptionRouter, paymentRouter, healthRecordRouter, healthTipRouter };
