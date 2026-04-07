import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';
import { validateDto } from '../middleware/validation.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../entities/User.entity';
import { CreateDoctorDto, UpdateDoctorDto } from '../dto/index.dto';

const router = Router();
const doctorController = new DoctorController();

router.get('/', authenticate, doctorController.findAll);
router.post('/', authenticate, authorize(UserRole.ADMIN), validateDto(CreateDoctorDto), doctorController.create);

router.get('/specializations', authenticate, doctorController.getSpecializations);

router.get('/:id', authenticate, doctorController.findOne);

router.put(
    '/:id',
    authenticate,
    authorize(UserRole.DOCTOR, UserRole.ADMIN),
    validateDto(UpdateDoctorDto),
    doctorController.update,
);

export default router;
