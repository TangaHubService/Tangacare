import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validateDto } from '../middleware/validation.middleware';
import { PayNowDto, StartSubscriptionDto } from '../dto/subscription.dto';
import { SubscriptionController } from '../controllers/subscription.controller';

const router = Router();
const controller = new SubscriptionController();

router.post('/start', authenticate, validateDto(StartSubscriptionDto), controller.start);
router.post('/renew', authenticate, controller.renew);
router.post('/pay-now', authenticate, validateDto(PayNowDto), controller.payNow);
router.get('/checkout-summary', authenticate, controller.getCheckoutSummary);
router.get('/me', authenticate, controller.getMe);
router.get('/me/limits', authenticate, controller.getLimits);
router.get('/me/payments', authenticate, controller.getPayments);
router.get('/me/payments/:paymentId/invoice', authenticate, controller.getPaymentInvoicePdf);
router.get('/me/expiration-warning', authenticate, controller.getExpirationWarning);
router.get('/me/billing-overview', authenticate, controller.getBillingOverview);

// Paypack webhooks must be public (no auth). Signature verification is handled inside controller/service.
router.head('/paypack/webhook', controller.handlePaypackWebhookHealthcheck);
router.post('/paypack/webhook', controller.handlePaypackWebhook);

export default router;

