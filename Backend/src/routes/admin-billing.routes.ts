import { Router } from 'express';
import { validateDto } from '../middleware/validation.middleware';
import { AdminBillingController } from '../controllers/admin/billing.admin.controller';
import {
    ChangeSubscriptionPlanDto,
    CreatePlanDto,
    ExtendTrialDto,
    UpdateGatewayDto,
    UpdateSubscriptionStatusDto,
} from '../dto/admin-billing.dto';

const router = Router();
const controller = new AdminBillingController();

router.get('/overview', controller.overview);

router.get('/customers', controller.customers);
router.get('/customers/:organizationId', controller.customerByOrganization);

router.get('/subscriptions', controller.subscriptions);
router.get('/subscriptions/:id', controller.subscriptionById);
router.patch('/subscriptions/:id/status', validateDto(UpdateSubscriptionStatusDto), controller.updateSubscriptionStatus);
router.post('/subscriptions/:id/extend-trial', validateDto(ExtendTrialDto), controller.extendTrial);
router.post('/subscriptions/:id/change-plan', validateDto(ChangeSubscriptionPlanDto), controller.changePlan);
router.post('/subscriptions/:id/cancel-pending-plan-change', controller.cancelPendingPlanChange);

router.get('/payments', controller.payments);
router.get('/payments/:id', controller.paymentById);

router.get('/trials', controller.trials);

router.get('/plans', controller.plans);
router.post('/plans', validateDto(CreatePlanDto), controller.createPlan);
router.patch('/plans/:id', controller.updatePlan);
router.get('/plans/:id/features', controller.planFeatures);
router.put('/plans/:id/features', controller.updatePlanFeatures);

router.get('/gateways', controller.gateways);
router.patch('/gateways/:id', validateDto(UpdateGatewayDto), controller.updateGateway);

export default router;

