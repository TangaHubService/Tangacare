import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { AuthRequest } from '../middleware/auth.middleware';
import { resolveOrganizationId } from '../utils/request.util';
import { ResponseUtil } from '../utils/response.util';
import { CheckoutSummaryDto, PayNowDto, StartSubscriptionDto } from '../dto/subscription.dto';
import { SubscriptionService } from '../services/subscriptions/subscription.service';
import { PdfBrandingUtil } from '../utils/pdf-branding.util';

export class SubscriptionController {
    private subscriptionService: SubscriptionService;

    constructor() {
        this.subscriptionService = new SubscriptionService();
    }

    private isClientInputError(message?: string): boolean {
        const m = String(message || '').toLowerCase();
        return (
            m.includes('required') ||
            m.includes('not found') ||
            m.includes('invalid') ||
            m.includes('must be') ||
            m.includes('pricing is not available')
        );
    }

    start = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const body = req.body as StartSubscriptionDto;
            const subscription = await this.subscriptionService.startSubscription({
                organization_id: organizationId,
                plan_code: body.plan_code,
                phone_number: body.phone_number,
                payment_method_preference: body.payment_method_preference,
            });

            ResponseUtil.created(res, subscription, 'Subscription trial started');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to start subscription', error?.message);
        }
    };

    getMe = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const subscription = await this.subscriptionService.getMySubscription(organizationId);
            ResponseUtil.success(res, subscription, 'Subscription retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch subscription', error?.message);
        }
    };

    getLimits = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const limits = await this.subscriptionService.getMyLimits(organizationId);
            ResponseUtil.success(res, limits, 'Subscription limits retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch subscription limits', error?.message);
        }
    };

    getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const payments = await this.subscriptionService.getMyPayments(organizationId);
            ResponseUtil.success(res, payments, 'Subscription payments retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch subscription payments', error?.message);
        }
    };

    getPaymentInvoicePdf = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const paymentId = Number(req.params.paymentId);
            if (!Number.isFinite(paymentId) || paymentId <= 0) {
                ResponseUtil.badRequest(res, 'Invalid payment id');
                return;
            }

            const payment = await this.subscriptionService.getPaymentForOrganization(organizationId, paymentId);
            if (!payment) {
                ResponseUtil.notFound(res, 'Payment invoice not found');
                return;
            }

            const doc = new PDFDocument({ margin: 42, size: 'A4', bufferPages: true });
            const fileName = `invoice-${payment.id}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
            doc.pipe(res);

            const planName = payment.subscription?.subscription_plan?.name || 'Subscription';
            const invoiceDate = payment.created_at ? new Date(payment.created_at).toLocaleString() : '—';
            const paidDate = payment.paid_at ? new Date(payment.paid_at).toLocaleString() : 'Pending';
            const amount = Number(payment.amount_rwf || 0).toLocaleString();
            const issuedAt = new Date().toLocaleString();

            const logoOffset = PdfBrandingUtil.drawLogo(doc, 50, doc.y - 2, 24);
            doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text('Invoice', 50 + logoOffset, doc.y);
            doc.moveDown(0.2);
            doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('TangaCare Subscription Payment');
            doc.moveDown(0.7);

            doc.fontSize(10).fillColor('#0f172a');
            doc.text(`Invoice #: ${payment.id}`, { align: 'right' });
            doc.text(`Issued: ${issuedAt}`, { align: 'right' });
            doc.text(`Invoice date: ${invoiceDate}`, { align: 'right' });
            doc.moveDown(0.5);

            const boxX = 50;
            const boxW = 495;
            const boxY = doc.y;
            doc.roundedRect(boxX, boxY, boxW, 118, 8).fillAndStroke('#f8fafc', '#e2e8f0');
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Payment Details', boxX + 14, boxY + 12);
            doc.font('Helvetica').fontSize(10).fillColor('#334155');
            doc.text(`Plan: ${planName}`, boxX + 14, boxY + 34);
            doc.text(`Status: ${String(payment.status).toUpperCase()}`, boxX + 14, boxY + 49);
            doc.text(`Provider: ${payment.provider || 'N/A'}`, boxX + 14, boxY + 64);
            doc.text(`Reference: ${payment.gateway_ref}`, boxX + 14, boxY + 79, { width: boxW - 30 });
            doc.text(`Paid at: ${paidDate}`, boxX + 14, boxY + 96, { width: boxW - 30 });

            doc.y = boxY + 132;
            doc.roundedRect(boxX, doc.y, boxW, 54, 8).fillAndStroke('#ecfeff', '#99f6e4');
            doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(11).text('Total Paid', boxX + 14, doc.y + 12);
            doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(`RWF ${amount}`, boxX + 14, doc.y + 26);

            doc.moveDown(2.2);
            doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(
                'Thank you for using TangaCare. Keep this invoice for your records.',
                50,
            );

            PdfBrandingUtil.decorateBufferedPages(doc);
            doc.end();
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate invoice pdf', error?.message);
        }
    };

    getCheckoutSummary = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const query = req.query as any as CheckoutSummaryDto;
            const summary = await this.subscriptionService.getCheckoutSummary({
                organization_id: organizationId,
                plan_code: query.plan_code,
                duration_months: Number(query.duration_months),
            });
            ResponseUtil.success(res, summary, 'Checkout summary retrieved');
        } catch (error: any) {
            if (this.isClientInputError(error?.message)) {
                ResponseUtil.badRequest(res, error?.message || 'Invalid checkout request');
                return;
            }
            ResponseUtil.internalError(res, 'Failed to get checkout summary', error?.message);
        }
    };

    renew = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const body = req.body as Partial<StartSubscriptionDto>;
            const subscription = await this.subscriptionService.renewSubscription({
                organization_id: organizationId,
                plan_code: body.plan_code,
                phone_number: body.phone_number,
                payment_method_preference: body.payment_method_preference,
            });

            ResponseUtil.success(res, subscription, 'Subscription renewed');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to renew subscription', error?.message);
        }
    };

    // Triggers a Paypack cash-in immediately (instead of waiting for the scheduler),
    // so the frontend can show success/failure in real time.
    payNow = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }

            const body = req.body as PayNowDto;
            const result = await this.subscriptionService.payNow({
                organization_id: organizationId,
                plan_code: body.plan_code,
                phone_number: body.phone_number,
                payment_method_preference: body.payment_method_preference,
                term: body.term,
                duration_months: body.duration_months,
                idempotency_key: body.idempotency_key,
            });

            ResponseUtil.success(res, result, 'Payment initiated');
        } catch (error: any) {
            if (this.isClientInputError(error?.message)) {
                ResponseUtil.badRequest(res, error?.message || 'Invalid payment request');
                return;
            }
            ResponseUtil.internalError(res, 'Failed to initiate payment', error?.message);
        }
    };

    getExpirationWarning = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const warning = await this.subscriptionService.getExpirationWarning(organizationId);
            ResponseUtil.success(res, warning, 'Subscription expiration warning retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch expiration warning', error?.message);
        }
    };

    getBillingOverview = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const overview = await this.subscriptionService.getBillingOverview(organizationId);
            ResponseUtil.success(res, overview, 'Billing overview retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch billing overview', error?.message);
        }
    };

    handlePaypackWebhook = async (req: Request, res: Response): Promise<void> => {
        try {
            const secret = process.env.PAYPACK_WEBHOOK_SIGN_KEY;
            if (!secret) {
                ResponseUtil.internalError(res, 'Paypack webhook secret missing', 'Missing PAYPACK_WEBHOOK_SIGN_KEY');
                return;
            }

            const signatureHeader =
                (req.headers['x-paypack-signature'] as string | undefined) ||
                (req.headers['X-Paypack-Signature'] as string | undefined) ||
                req.get('X-Paypack-Signature');

            await this.subscriptionService.handlePaypackTransactionProcessed({
                payload: req.body as any,
                rawBody: (req as any).rawBody,
                signatureHeader: signatureHeader ? String(signatureHeader) : undefined,
                paypackWebhookSecret: secret,
            });

            ResponseUtil.success(res, null, 'Webhook processed');
        } catch (error: any) {
            // Paypack may retry on non-2xx. Use 400 for signature/payload issues.
            const msg = error?.message || 'Webhook failed';
            const statusCode = msg.toLowerCase().includes('signature') ? 400 : 500;
            ResponseUtil.error(res, msg, statusCode);
        }
    };

    // Paypack pings webhook URL with HEAD before sending POST payloads.
    // Returning 200 here confirms the endpoint is publicly reachable.
    handlePaypackWebhookHealthcheck = async (_req: Request, res: Response): Promise<void> => {
        res.status(200).send();
    };
}

