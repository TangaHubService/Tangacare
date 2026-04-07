import { Router } from 'express';
import { AnalyticsController } from '../../controllers/pharmacy/analytics.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const analyticsController = new AnalyticsController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

router.get('/kpis', analyticsController.getAdvancedKPIs);
router.get('/critical-medicines', analyticsController.getCriticalMedicines);
router.get('/expiry-heatmap', analyticsController.getExpiryHeatMap);
router.get('/fefo-compliance', analyticsController.getFEFOCompliance);
router.get('/abc-analysis', analyticsController.getABCAnalysis);
router.get('/multi-location', analyticsController.getMultiLocationComparison);
router.get('/overstock', analyticsController.getOverstockReport);
router.post('/recalculate-consumption', analyticsController.recalculateConsumption);
router.get(
    '/reorder-suggestions/:facilityId?',
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
    ),
    analyticsController.getReorderSuggestions,
);
router.get('/supplier-performance', analyticsController.getSupplierPerformance);
router.get('/velocity-segmentation', analyticsController.getVelocitySegmentation);
router.get('/supplier-intelligence', analyticsController.getSupplierIntelligence);
router.get('/near-expiry-actions', analyticsController.getNearExpiryActions);
router.get('/demand-forecast', analyticsController.getDemandForecast);
router.get('/smart-reorder', analyticsController.getSmartReorderPlan);
router.get('/predictive-expiry', analyticsController.getPredictiveExpiry);
router.get('/multi-branch-transfer', analyticsController.getMultiBranchTransferSuggestions);
router.get('/mobile-workflow-board', analyticsController.getMobileWorkflowBoard);

export default router;
