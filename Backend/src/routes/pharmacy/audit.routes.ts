import { Router } from 'express';
import { AuditController } from '../../controllers/pharmacy/audit.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const auditController = new AuditController();

router.get(
    '/',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.AUDITOR,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
        UserRole.ADMIN,
    ),
    auditController.list,
);

router.get(
    '/stock-movements',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.AUDITOR,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
        UserRole.ADMIN,
    ),
    auditController.getStockMovements,
);

router.get(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.AUDITOR,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
        UserRole.ADMIN,
    ),
    auditController.getOne,
);

export default router;
