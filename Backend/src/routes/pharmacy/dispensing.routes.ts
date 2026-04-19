import { Router } from 'express';
import { DispensingController } from '../../controllers/pharmacy/dispensing.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateDispenseTransactionDto } from '../../dto/pharmacy.dto';
import { PERMISSIONS } from '../../config/permissions';

const router = Router();
const dispensingController = new DispensingController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_WRITE),
    scopeMiddleware,
    validateDto(CreateDispenseTransactionDto),
    dispensingController.dispense,
);

router.get(
    '/',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_READ),
    scopeMiddleware,
    dispensingController.findAll,
);

router.get(
    '/substitutions/:medicineId',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_READ),
    scopeMiddleware,
    dispensingController.getSubstitutions,
);

router.get(
    '/:id',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_READ),
    scopeMiddleware,
    dispensingController.findOne,
);

export default router;
