import { Router } from 'express';
import { VendorReturnController } from '../../controllers/pharmacy/vendor-return.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const vendorReturnController = new VendorReturnController();

/** POST / — create a vendor return (pending approval) */
router.post(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    vendorReturnController.createVendorReturn,
);

/** GET / — list vendor returns */
router.get(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(
        UserRole.STORE_MANAGER,
        UserRole.FACILITY_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.AUDITOR,
    ),
    scopeMiddleware,
    vendorReturnController.listVendorReturns,
);

/** GET /:id — get one vendor return */
router.get(
    '/:id',
    authenticate,
    requireFacilityScope,
    authorize(
        UserRole.STORE_MANAGER,
        UserRole.FACILITY_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.AUDITOR,
    ),
    scopeMiddleware,
    vendorReturnController.getVendorReturn,
);

/** POST /:id/approve — approve and deduct stock */
router.post(
    '/:id/approve',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    vendorReturnController.approveVendorReturn,
);

/** POST /:id/reject — reject with reason */
router.post(
    '/:id/reject',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    vendorReturnController.rejectVendorReturn,
);

export default router;
