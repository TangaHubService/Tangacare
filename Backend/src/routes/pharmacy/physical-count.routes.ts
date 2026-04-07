import { Router } from 'express';
import { PhysicalCountController } from '../../controllers/pharmacy/physical-count.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../entities/User.entity';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';

const router = Router();
const physicalCountController = new PhysicalCountController();

router.post(
    '/start',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    physicalCountController.startCount,
);

router.put(
    '/items/:itemId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    physicalCountController.updateItem,
);

router.post(
    '/:countId/approve',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    physicalCountController.approveCount,
);

router.get(
    '/:countId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST, UserRole.AUDITOR),
    scopeMiddleware,
    physicalCountController.getCount,
);

router.get(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST, UserRole.AUDITOR),
    scopeMiddleware,
    physicalCountController.listCounts,
);

export default router;
