import { Router } from 'express';
import { ParController } from '../../controllers/pharmacy/par.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const parController = new ParController();

router.put(
    '/levels/department/:departmentId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    parController.upsertDepartmentLevels,
);

router.get(
    '/dashboard/:facilityId?',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    parController.getDashboard,
);

router.post(
    '/tasks/generate/:facilityId?',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    parController.generateTasks,
);

router.get(
    '/tasks/:facilityId?',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    parController.listTasks,
);

router.patch(
    '/tasks/:taskId/status/:facilityId?',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    scopeMiddleware,
    parController.updateTaskStatus,
);

export default router;
