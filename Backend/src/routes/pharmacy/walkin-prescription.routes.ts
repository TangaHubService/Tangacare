import { Router } from 'express';
import { WalkInPrescriptionController } from '../../controllers/pharmacy/walkin-prescription.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { validateDto } from '../../middleware/validation.middleware';
import { CreateWalkInPrescriptionDto } from '../../dto/pharmacy.dto';

const router = Router();
const controller = new WalkInPrescriptionController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

router.post(
    '/',
    requirePermission(PERMISSIONS.DISPENSING_WRITE),
    validateDto(CreateWalkInPrescriptionDto),
    controller.create,
);

export default router;
