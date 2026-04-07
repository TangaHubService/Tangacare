import { Router } from 'express';
import { ReturnController } from '../../controllers/pharmacy/return.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const returnController = new ReturnController();

// Create a new return
router.post(
    '/',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.PHARMACIST),
    scopeMiddleware,
    returnController.createReturn,
);

// List returns with filters
router.get(
    '/',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.PHARMACIST, UserRole.AUDITOR),
    scopeMiddleware,
    returnController.listReturns,
);

// Get a specific return
router.get(
    '/:id',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.PHARMACIST, UserRole.AUDITOR),
    scopeMiddleware,
    returnController.getReturn,
);

// Approve a return
router.post(
    '/:id/approve',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.PHARMACIST),
    scopeMiddleware,
    returnController.approveReturn,
);

// Reject a return
router.post(
    '/:id/reject',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.PHARMACIST),
    scopeMiddleware,
    returnController.rejectReturn,
);

// Process refund for an approved return
router.post(
    '/:id/process-refund',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.CASHIER),
    scopeMiddleware,
    returnController.processRefund,
);

export default router;
