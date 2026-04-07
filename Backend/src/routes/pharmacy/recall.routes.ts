import { Router } from 'express';
import { RecallController } from '../../controllers/pharmacy/recall.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';

const router = Router();
const controller = new RecallController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

router.get('/', requirePermission(PERMISSIONS.REPORTS_READ), controller.getRecalls);

router.post('/', requirePermission(PERMISSIONS.INVENTORY_WRITE), controller.initiateRecall);

router.get('/:id', requirePermission(PERMISSIONS.REPORTS_READ), controller.getRecallById);

router.get('/:id/notice', requirePermission(PERMISSIONS.REPORTS_READ), controller.downloadNotice);

router.get('/:id/affected-sales', requirePermission(PERMISSIONS.REPORTS_READ), controller.getAffectedSales);

export default router;
