import { Router } from 'express';
import { DispensingController } from '../../controllers/pharmacy/dispensing.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateDispenseTransactionDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const dispensingController = new DispensingController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(CreateDispenseTransactionDto),
    dispensingController.dispense,
);

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, dispensingController.findAll);

router.get(
    '/substitutions/:medicineId',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    dispensingController.getSubstitutions,
);

router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, dispensingController.findOne);

export default router;
