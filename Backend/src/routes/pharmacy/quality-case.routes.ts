import { Router } from 'express';
import { QualityCaseController } from '../../controllers/pharmacy/quality-case.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { validateDto } from '../../middleware/validation.middleware';
import { CreateQualityCaseDto, UpdateQualityCaseDto } from '../../dto/pharmacy.dto';

const router = Router();
const controller = new QualityCaseController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

router.get('/', requirePermission(PERMISSIONS.REPORTS_READ, PERMISSIONS.INVENTORY_READ), controller.list);

router.post(
    '/',
    requirePermission(PERMISSIONS.INVENTORY_WRITE),
    validateDto(CreateQualityCaseDto),
    controller.create,
);

router.patch(
    '/:id',
    requirePermission(PERMISSIONS.INVENTORY_WRITE),
    validateDto(UpdateQualityCaseDto),
    controller.update,
);

export default router;
