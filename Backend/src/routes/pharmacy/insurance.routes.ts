import { Router } from 'express';
import { InsuranceController } from '../../controllers/pharmacy/insurance.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const insuranceController = new InsuranceController();

// Providers
router.get(
    '/providers',
    authenticate,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    insuranceController.findAllProviders,
);

router.post(
    '/providers',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    insuranceController.createProvider,
);

router.put(
    '/providers/:id',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    insuranceController.updateProvider,
);

router.get(
    '/summary',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    insuranceController.getInsuranceSummary,
);

// Claims
router.get(
    '/claims',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    insuranceController.findAllClaims,
);

router.post(
    '/claims',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    insuranceController.createClaim,
);

router.put(
    '/claims/:id',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    insuranceController.updateClaim,
);

export default router;

