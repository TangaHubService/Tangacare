import { Router } from 'express';
import { DisposalController } from '../../controllers/pharmacy/disposal.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const disposalController = new DisposalController();

/** POST / — create a disposal request */
router.post(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    disposalController.createDisposal,
);

/** GET / — list disposal requests */
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
    disposalController.listDisposals,
);

/** GET /:id — get one disposal request */
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
    disposalController.getDisposal,
);

/** POST /:id/approve — approve a disposal request */
router.post(
    '/:id/approve',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    disposalController.approveDisposal,
);

/** POST /:id/witness — witness a controlled drug disposal */
router.post(
    '/:id/witness',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.STORE_MANAGER),
    scopeMiddleware,
    disposalController.witnessDisposal,
);

/** POST /:id/post — finalize and deduct stock */
router.post(
    '/:id/post',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    disposalController.postDisposal,
);

/** POST /:id/void — void a disposal request */
router.post(
    '/:id/void',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    disposalController.voidDisposal,
);

export default router;
