import { Router } from 'express';
import { AlertController } from '../../controllers/pharmacy/alert.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../entities/User.entity';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';

const router = Router();
const alertController = new AlertController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

// Only facility admins and store managers should trigger these manually
router.post('/check-stock', authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER), alertController.checkLowStock);

router.post('/check-expiry', authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER), alertController.checkExpiries);

router.get(
    '/delivery-logs',
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.STORE_MANAGER,
        UserRole.AUDITOR,
    ),
    alertController.listDeliveryLogs,
);

router.get(
    '/',
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.STORE_MANAGER,
        UserRole.STORE_KEEPER,
        UserRole.PHARMACIST,
        UserRole.AUDITOR,
    ),
    alertController.getAlerts,
);

// Get alert summary/stats
router.get(
    '/summary',
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.STORE_MANAGER,
        UserRole.STORE_KEEPER,
        UserRole.PHARMACIST,
    ),
    alertController.getAlertSummary,
);

// Manually generate alerts
router.post('/generate', authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER), alertController.generateAlerts);

// Acknowledge an alert
router.post(
    '/:id/acknowledge',
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    alertController.acknowledgeAlert,
);

// Resolve an alert
router.put(
    '/:id/resolve',
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    alertController.resolveAlert,
);

export default router;
