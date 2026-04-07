import { Router } from 'express';
import { VarianceController } from '../../controllers/pharmacy/variance.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';

const router = Router();
const varianceController = new VarianceController();

// All routes require authentication
router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

// Record new variance
router.post('/', requirePermission(PERMISSIONS.INVENTORY_WRITE), varianceController.recordVariance);

// Get variance report
router.get(
    '/',
    requirePermission(PERMISSIONS.INVENTORY_READ, PERMISSIONS.REPORTS_READ),
    varianceController.getVarianceReport,
);

// Get variance by ID
router.get('/:id', requirePermission(PERMISSIONS.INVENTORY_READ), varianceController.getVarianceById);

// Approve variance
router.post('/:id/approve', requirePermission(PERMISSIONS.INVENTORY_WRITE), varianceController.approveVariance);

// Reject variance
router.post('/:id/reject', requirePermission(PERMISSIONS.INVENTORY_WRITE), varianceController.rejectVariance);

export default router;
