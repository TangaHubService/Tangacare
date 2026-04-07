import { Router } from 'express';
import { KPIController } from '../../controllers/pharmacy/kpi.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const kpiController = new KPIController();

// Get all KPIs (financial + inventory + operational)
router.get(
    '/comprehensive',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    kpiController.getComprehensiveKPIs,
);

router.get(
    '/comprehensive/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    kpiController.getComprehensiveKPIs,
);

// Get financial KPIs only
router.get(
    '/financial/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    kpiController.getFinancialKPIs,
);

// Get inventory KPIs only
router.get(
    '/inventory/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(
        UserRole.FACILITY_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.AUDITOR,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
    ),
    scopeMiddleware,
    kpiController.getInventoryKPIs,
);

// Get operational KPIs only
router.get(
    '/operational/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    kpiController.getOperationalKPIs,
);

// Get dashboard summary (Today + Month + Trends + Risk)
router.get(
    '/summary',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    kpiController.getDashboardSummary,
);

router.get(
    '/summary/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    kpiController.getDashboardSummary,
);

export default router;
