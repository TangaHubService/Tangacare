import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/super-admin.middleware';
import { AdminOrganizationsController } from '../controllers/admin/organizations.admin.controller';
import { AdminDashboardController } from '../controllers/admin/admin-dashboard.controller';
import adminBillingRouter from './admin-billing.routes';

const router = Router();
const controller = new AdminOrganizationsController();
const dashboardController = new AdminDashboardController();

router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/organizations', controller.listOrganizations);
router.get('/organizations/:orgId/users', controller.listOrganizationUsers);
router.get('/organizations/:orgId/medicines', controller.listOrganizationMedicines);
router.get('/organizations/:orgId/stock', controller.listOrganizationStock);
router.post('/organizations/:orgId/impersonate', controller.impersonateOrganization);
router.use('/billing', adminBillingRouter);

// Super admin overview dashboard
router.get('/dashboard', dashboardController.dashboard);

export default router;

