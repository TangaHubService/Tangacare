import { Router } from 'express';
import { DashboardController } from '../../controllers/pharmacy/dashboard.controller';
import { GlobalSearchController } from '../../controllers/pharmacy/global-search.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';

const router = Router();
const dashboardController = new DashboardController();
const globalSearchController = new GlobalSearchController();

router.get('/stats', authenticate, scopeMiddleware, dashboardController.getStats);

router.get('/search', authenticate, scopeMiddleware, globalSearchController.search);

router.get('/transactions', authenticate, scopeMiddleware, dashboardController.getTransactions);

router.get('/top-selling', authenticate, scopeMiddleware, dashboardController.getTopSellingMedicines);

router.get('/inventory-status', authenticate, scopeMiddleware, dashboardController.getInventoryStatus);

router.get('/consumption-trends', authenticate, scopeMiddleware, dashboardController.getConsumptionTrends);

router.get('/expiry-risk', authenticate, scopeMiddleware, dashboardController.getExpiryRisk);

export default router;
