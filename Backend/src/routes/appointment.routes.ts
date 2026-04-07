import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { validateDto } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dto/index.dto';

const router = Router();
const appointmentController = new AppointmentController();

router.get('/', authenticate, appointmentController.findAll);
router.post('/', authenticate, validateDto(CreateAppointmentDto), appointmentController.create);

router.get('/availability', authenticate, appointmentController.checkAvailability);

router.get('/:id', authenticate, appointmentController.findOne);

router.put('/:id', authenticate, validateDto(UpdateAppointmentDto), appointmentController.update);

router.delete('/:id', authenticate, appointmentController.delete);

export default router;
