import crypto from 'crypto';
import { AppDataSource } from '../../config/database';
import { Organization, SubscriptionStatus as OrganizationSubscriptionStatus } from '../../entities/Organization.entity';
import { Facility } from '../../entities/Facility.entity';
import { PaypackWebhookEvent } from '../../entities/PaypackWebhookEvent.entity';
import { Subscription, SubscriptionStatus as SubscriptionInternalStatus } from '../../entities/Subscription.entity';
import {
    SubscriptionPayment,
    SubscriptionPaymentGateway,
    SubscriptionPaymentKind,
    SubscriptionPaymentStatus,
} from '../../entities/SubscriptionPayment.entity';
import { SubscriptionPlan, SubscriptionPlanCode } from '../../entities/SubscriptionPlan.entity';
import { User } from '../../entities/User.entity';
import { PaypackGateway } from '../payment-gateways/paypackGateway';
import { BillingTerm } from '../../dto/subscription.dto';

type PaypackWebhookPayload = {
    event_id?: string;
    kind?: string;
    data?: any;
};

function addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
}

function addMonths(base: Date, months: number): Date {
    const d = new Date(base);
    d.setMonth(d.getMonth() + months);
    return d;
}

function getDurationMonths(input?: { duration_months?: number; term?: BillingTerm }): number {
    if (input?.duration_months != null) {
        return input.duration_months;
    }
    if (input?.term === BillingTerm.YEARLY) return 12;
    return 1;
}

function computeSubscriptionPricing(monthlyPrice: number, durationMonths: number): {
    base_amount_rwf: number;
    discount_percent: number;
    discount_amount_rwf: number;
    total_amount_rwf: number;
} {
    const baseAmount = Math.round(monthlyPrice * durationMonths);
    const discountPercent = durationMonths === 12 ? 20 : 0;
    const discountAmount = Math.round(baseAmount * (discountPercent / 100));
    const totalAmount = baseAmount - discountAmount;
    return {
        base_amount_rwf: baseAmount,
        discount_percent: discountPercent,
        discount_amount_rwf: discountAmount,
        total_amount_rwf: totalAmount,
    };
}

export class SubscriptionService {
    async getCheckoutSummary(params: {
        organization_id: number;
        plan_code: SubscriptionPlanCode;
        duration_months: number;
    }): Promise<{
        plan_code: SubscriptionPlanCode;
        plan_name: string;
        duration_months: number;
        monthly_price_rwf: number;
        base_amount_rwf: number;
        discount_percent: number;
        discount_amount_rwf: number;
        total_amount_rwf: number;
        is_renewal: boolean;
    }> {
        const { organization_id, plan_code, duration_months } = params;
        if (![1, 3, 12].includes(duration_months)) {
            throw new Error('duration_months must be 1, 3, or 12');
        }

        const planRepo = AppDataSource.getRepository(SubscriptionPlan);
        const subscriptionRepo = AppDataSource.getRepository(Subscription);

        const plan = await planRepo.findOne({ where: { plan_code } });
        if (!plan || !plan.price_rwf_monthly || plan.price_rwf_monthly <= 0) {
            throw new Error('Subscription plan pricing is not available');
        }

        const latest = await subscriptionRepo.findOne({
            where: { organization_id },
            order: { created_at: 'DESC' },
        });

        return {
            plan_code,
            plan_name: plan.name,
            duration_months,
            monthly_price_rwf: plan.price_rwf_monthly,
            ...computeSubscriptionPricing(plan.price_rwf_monthly, duration_months),
            is_renewal: !!latest,
        };
    }

    async startSubscription(params: {
        organization_id: number;
        plan_code: SubscriptionPlanCode;
        phone_number: string;
        payment_method_preference?: string;
    }): Promise<Subscription> {
        const { organization_id, plan_code, phone_number, payment_method_preference } = params;

        const planRepo = AppDataSource.getRepository(SubscriptionPlan);
        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        const orgRepo = AppDataSource.getRepository(Organization);

        const org = await orgRepo.findOne({ where: { id: organization_id } });
        if (!org) throw new Error('Organization not found');

        const existing = await subscriptionRepo.findOne({
            where: { organization_id },
            order: { created_at: 'DESC' },
            relations: ['subscription_plan'],
        });

        if (existing && ![SubscriptionInternalStatus.EXPIRED, SubscriptionInternalStatus.CANCELLED].includes(existing.status)) {
            // Minimal guard: don't create another trial/active subscription while one exists.
            return existing;
        }

        const plan = await planRepo.findOne({ where: { plan_code } });
        if (!plan) throw new Error('Subscription plan not found');

        const now = new Date();
        const trialEndAt = addDays(now, plan.trial_days ?? 7);

        const subscription = subscriptionRepo.create({
            organization_id,
            subscription_plan_id: plan.id,
            status: SubscriptionInternalStatus.TRIALING,
            billing_period_months: 1,
            trial_end_at: trialEndAt,
            current_period_end_at: null,
            next_billing_at: trialEndAt,
            cancelled_at: null,
            paypack_phone_number: phone_number,
            payment_method_preference: payment_method_preference ?? null,
            billing_attempts: 0,
        });

        const saved = await subscriptionRepo.save(subscription);

        // Keep legacy org subscription_status in sync (trial)
        org.subscription_status = OrganizationSubscriptionStatus.TRIAL;
        await orgRepo.save(org);

        const result = await subscriptionRepo.findOne({
            where: { id: saved.id },
            relations: ['subscription_plan'],
        });
        if (!result) throw new Error('Subscription not found after create');
        return result;
    }

    async getMySubscription(organization_id: number): Promise<Subscription | null> {
        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        return await subscriptionRepo.findOne({
            where: { organization_id },
            order: { created_at: 'DESC' },
            relations: ['subscription_plan'],
        });
    }

    async getMyPayments(organization_id: number): Promise<SubscriptionPayment[]> {
        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        const paymentRepo = AppDataSource.getRepository(SubscriptionPayment);

        const subscription = await subscriptionRepo.findOne({
            where: { organization_id },
            order: { created_at: 'DESC' },
        });

        if (!subscription) return [];

        return await paymentRepo.find({
            where: { subscription_id: subscription.id },
            order: { created_at: 'DESC' },
        });
    }

    async getPaymentForOrganization(organization_id: number, paymentId: number): Promise<SubscriptionPayment | null> {
        const paymentRepo = AppDataSource.getRepository(SubscriptionPayment);
        const payment = await paymentRepo.findOne({
            where: { id: paymentId },
            relations: ['subscription', 'subscription.subscription_plan'],
        });
        if (!payment) return null;
        if (payment.subscription?.organization_id !== organization_id) return null;
        return payment;
    }

    async renewSubscription(params: {
        organization_id: number;
        plan_code?: SubscriptionPlanCode;
        phone_number?: string;
        payment_method_preference?: string;
    }): Promise<Subscription> {
        const { organization_id, plan_code, phone_number, payment_method_preference } = params;
        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        const latest = await subscriptionRepo.findOne({
            where: { organization_id },
            order: { created_at: 'DESC' },
            relations: ['subscription_plan'],
        });

        // If no subscription exists, this acts as first purchase.
        if (!latest) {
            if (!plan_code || !phone_number) {
                throw new Error('plan_code and phone_number are required when no subscription exists');
            }
            return await this.startSubscription({
                organization_id,
                plan_code,
                phone_number,
                payment_method_preference,
            });
        }

        // If already active/trialing, just return current subscription details.
        if ([SubscriptionInternalStatus.ACTIVE, SubscriptionInternalStatus.TRIALING].includes(latest.status)) {
            return latest;
        }

        return await this.startSubscription({
            organization_id,
            plan_code: plan_code || latest.subscription_plan?.plan_code,
            phone_number: phone_number || latest.paypack_phone_number,
            payment_method_preference: payment_method_preference || latest.payment_method_preference || undefined,
        });
    }

    async payNow(params: {
        organization_id: number;
        plan_code?: SubscriptionPlanCode;
        phone_number: string;
        payment_method_preference?: string;
        term?: BillingTerm;
        duration_months?: number;
        idempotency_key?: string;
    }): Promise<{
        ref: string;
        payment_status: SubscriptionPaymentStatus;
        instruction?: string;
        amount_rwf: number;
        gateway_cashin_status?: string;
    }> {
        const { organization_id, plan_code, phone_number, payment_method_preference, term, duration_months, idempotency_key } = params;

        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        const planRepo = AppDataSource.getRepository(SubscriptionPlan);
        const orgRepo = AppDataSource.getRepository(Organization);
        const paymentRepo = AppDataSource.getRepository(SubscriptionPayment);

        const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '7', 10);
        const maxAttempts = parseInt(process.env.SUBSCRIPTION_MAX_ATTEMPTS || '2', 10);

        const org = await orgRepo.findOne({ where: { id: organization_id } });
        if (!org) throw new Error('Organization not found');

        const now = new Date();
        const latest = await subscriptionRepo.findOne({
            where: { organization_id },
            order: { created_at: 'DESC' },
            relations: ['subscription_plan'],
        });

        const requestedPlanCode = plan_code || latest?.subscription_plan?.plan_code;
        if (!requestedPlanCode) {
            throw new Error('plan_code is required when no subscription exists');
        }

        const plan = await planRepo.findOne({ where: { plan_code: requestedPlanCode } });
        if (!plan) throw new Error('Subscription plan not found');
        if (!plan.price_rwf_monthly || !Number.isFinite(plan.price_rwf_monthly) || plan.price_rwf_monthly <= 0) {
            throw new Error('Subscription plan price_rwf_monthly is required to pay now');
        }

        const billingPeriodMonths = getDurationMonths({ duration_months, term });
        if (![1, 3, 12].includes(billingPeriodMonths)) {
            throw new Error('duration_months must be 1, 3, or 12');
        }
        const pricing = computeSubscriptionPricing(plan.price_rwf_monthly, billingPeriodMonths);
        const amountRwf = pricing.total_amount_rwf;

        // Create/update subscription record first, so we have a subscription_id for payments.
        let subscription = latest;
        const isExpiredOrCancelled =
            !subscription ||
            [SubscriptionInternalStatus.EXPIRED, SubscriptionInternalStatus.CANCELLED].includes(subscription.status);

        if (!subscription || isExpiredOrCancelled) {
            subscription = subscriptionRepo.create({
                organization_id,
                subscription_plan_id: plan.id,
                status: SubscriptionInternalStatus.PAST_DUE,
                billing_period_months: billingPeriodMonths,
                trial_end_at: null,
                current_period_end_at: null,
                next_billing_at: addMonths(now, billingPeriodMonths),
                cancelled_at: null,
                paypack_phone_number: phone_number,
                payment_method_preference: payment_method_preference ?? null,
                billing_attempts: 0,
            });
        } else {
            // Allow early renewal: we update the plan/phone now, and finalize status on payment result.
            subscription.subscription_plan_id = plan.id;
            subscription.billing_period_months = billingPeriodMonths;
            subscription.paypack_phone_number = phone_number;
            subscription.payment_method_preference = payment_method_preference ?? subscription.payment_method_preference ?? null;
            subscription.next_billing_at = addMonths(now, billingPeriodMonths);
        }

        subscription.subscription_plan = subscription.subscription_plan || plan;
        subscription.status = SubscriptionInternalStatus.PAST_DUE;
        await subscriptionRepo.save(subscription);

        const paypack = new PaypackGateway();

        const computedKeyBase = `${subscription.id}:${requestedPlanCode}:${phone_number}:${billingPeriodMonths}:${amountRwf}:${now
            .toISOString()
            .slice(0, 10)}`;
        const finalIdempotencyKey = idempotency_key || crypto.createHash('sha256').update(computedKeyBase).digest('hex').slice(0, 32);

        const cashIn = await paypack.createCashIn({
            amount_rwf: amountRwf,
            phone_number,
            idempotency_key: finalIdempotencyKey,
        });

        // If we already have this gateway_ref, return stored status (idempotency).
        const existingPayment = await paymentRepo.findOne({
            where: { gateway_ref: cashIn.ref },
            relations: ['subscription', 'subscription.subscription_plan'],
        });
        if (existingPayment) {
            return {
                ref: cashIn.ref,
                payment_status: existingPayment.status,
                instruction: cashIn.message,
                amount_rwf: existingPayment.amount_rwf,
                gateway_cashin_status: cashIn.status,
            };
        }

        const cashInStatusNormalized = String(cashIn.status ?? '').toLowerCase();
        let paymentStatus: SubscriptionPaymentStatus = SubscriptionPaymentStatus.PENDING;
        if (cashInStatusNormalized === 'successful') paymentStatus = SubscriptionPaymentStatus.SUCCESS;
        if (cashInStatusNormalized === 'failed') paymentStatus = SubscriptionPaymentStatus.FAILED;

        const paidAt = paymentStatus === SubscriptionPaymentStatus.SUCCESS ? now : null;

        const payment = paymentRepo.create({
            subscription_id: subscription.id,
            amount_rwf: amountRwf,
            currency: 'RWF',
            gateway: SubscriptionPaymentGateway.PAYPACK,
            gateway_ref: cashIn.ref,
            status: paymentStatus,
            kind: SubscriptionPaymentKind.CASHIN,
            provider: cashIn.provider ?? null,
            paid_at: paidAt,
        });

        await paymentRepo.save(payment);

        // Finalize subscription + org based on known cash-in status.
        if (paymentStatus === SubscriptionPaymentStatus.SUCCESS) {
            const currentPeriodAnchor =
                subscription.current_period_end_at && subscription.current_period_end_at > now
                    ? subscription.current_period_end_at
                    : now;
            const currentPeriodEnd = addMonths(currentPeriodAnchor, billingPeriodMonths);
            subscription.status = SubscriptionInternalStatus.ACTIVE;
            subscription.current_period_end_at = currentPeriodEnd;
            subscription.next_billing_at = currentPeriodEnd;
            subscription.trial_end_at = null;
            subscription.cancelled_at = null;
            subscription.billing_period_months = billingPeriodMonths;
            subscription.billing_attempts = 0;
            await subscriptionRepo.save(subscription);

            org.subscription_status = OrganizationSubscriptionStatus.ACTIVE;
            await orgRepo.save(org);
        } else if (paymentStatus === SubscriptionPaymentStatus.FAILED) {
            subscription.billing_attempts = (subscription.billing_attempts ?? 0) + 1;
            subscription.status = SubscriptionInternalStatus.PAST_DUE;
            subscription.current_period_end_at = null;
            subscription.next_billing_at = addDays(now, graceDays);
            subscription.billing_period_months = billingPeriodMonths;
            if (subscription.billing_attempts >= maxAttempts) {
                subscription.status = SubscriptionInternalStatus.EXPIRED;
            }
            await subscriptionRepo.save(subscription);

            org.subscription_status = OrganizationSubscriptionStatus.SUSPENDED;
            await orgRepo.save(org);
        } else {
            // pending
            org.subscription_status = OrganizationSubscriptionStatus.SUSPENDED;
            await orgRepo.save(org);
            subscription.status = SubscriptionInternalStatus.PAST_DUE;
            subscription.next_billing_at = addMonths(now, billingPeriodMonths);
            subscription.billing_period_months = billingPeriodMonths;
            await subscriptionRepo.save(subscription);
        }

        return {
            ref: cashIn.ref,
            payment_status: paymentStatus,
            instruction: cashIn.message,
            amount_rwf: amountRwf,
            gateway_cashin_status: cashIn.status,
        };
    }

    async getExpirationWarning(organization_id: number): Promise<{
        isExpiringSoon: boolean;
        isExpired: boolean;
        daysLeft: number | null;
        expiresAt: Date | null;
        planName: string | null;
        renewUrl: string;
    }> {
        const subscription = await this.getMySubscription(organization_id);
        const expiresAt = subscription?.current_period_end_at ?? subscription?.next_billing_at ?? null;
        const planName = subscription?.subscription_plan?.name ?? null;
        const renewUrl = '/checkout?mode=renew';

        if (!subscription || !expiresAt) {
            return {
                isExpiringSoon: false,
                isExpired: false,
                daysLeft: null,
                expiresAt: null,
                planName,
                renewUrl,
            };
        }

        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return {
            isExpiringSoon: daysLeft >= 0 && daysLeft < 10,
            isExpired: daysLeft < 0 || subscription.status === SubscriptionInternalStatus.EXPIRED,
            daysLeft,
            expiresAt,
            planName,
            renewUrl,
        };
    }

    async getBillingOverview(organization_id: number): Promise<{
        current_subscription: Subscription | null;
        payment_history: SubscriptionPayment[];
        renewal_history: SubscriptionPayment[];
        next_billing_date: Date | null;
    }> {
        const subscription = await this.getMySubscription(organization_id);
        const paymentHistory = await this.getMyPayments(organization_id);
        return {
            current_subscription: subscription,
            payment_history: paymentHistory,
            renewal_history: paymentHistory.filter((p) => p.status === SubscriptionPaymentStatus.SUCCESS),
            next_billing_date: subscription?.next_billing_at ?? subscription?.current_period_end_at ?? null,
        };
    }

    async getMyLimits(organization_id: number): Promise<{
        status: SubscriptionInternalStatus | 'none';
        plan_code: SubscriptionPlanCode | null;
        limits: { max_users: number | null; max_facilities: number | null };
        usage: { users_count: number; facilities_count: number };
        can_add_users: boolean;
        can_add_facilities: boolean;
    }> {
        const subscription = await this.getMySubscription(organization_id);

        const userRepo = AppDataSource.getRepository(User);
        const facilityRepo = AppDataSource.getRepository(Facility);

        const usersCount = await userRepo
            .createQueryBuilder('u')
            .where('u.organization_id = :orgId', { orgId: organization_id })
            .andWhere('u.deleted_at IS NULL')
            .andWhere('u.is_active = true')
            .getCount();

        const facilitiesCount = await facilityRepo
            .createQueryBuilder('f')
            .where('f.organization_id = :orgId', { orgId: organization_id })
            .andWhere('f.is_active = true')
            .getCount();

        if (!subscription) {
            return {
                status: 'none',
                plan_code: null,
                limits: { max_users: null, max_facilities: null },
                usage: { users_count: usersCount, facilities_count: facilitiesCount },
                can_add_users: true,
                can_add_facilities: true,
            };
        }

        const plan = subscription.subscription_plan;
        const maxUsers = plan?.max_users ?? null;
        const maxFacilities = plan?.max_facilities ?? null;

        const canAddUsers = maxUsers == null ? true : usersCount < maxUsers;
        const canAddFacilities = maxFacilities == null ? true : facilitiesCount < maxFacilities;

        return {
            status: subscription.status,
            plan_code: plan?.plan_code ?? null,
            limits: { max_users: maxUsers, max_facilities: maxFacilities },
            usage: { users_count: usersCount, facilities_count: facilitiesCount },
            can_add_users: canAddUsers,
            can_add_facilities: canAddFacilities,
        };
    }

    async handlePaypackTransactionProcessed(params: {
        payload: PaypackWebhookPayload;
        rawBody: Buffer | undefined;
        signatureHeader: string | undefined;
        paypackWebhookSecret: string;
    }): Promise<void> {
        const { payload, rawBody, signatureHeader, paypackWebhookSecret } = params;
        const eventId = payload.event_id;

        if (!eventId) {
            throw new Error('Missing Paypack event_id');
        }

        const eventKind = payload.kind;
        const data = payload.data || {};
        const txRef: string | undefined = data.ref;
        const txStatus: string | undefined = data.status;
        const txKind: string | undefined = data.kind;
        const provider: string | null = data.provider ?? null;
        const processedAtRaw: string | undefined = data.processed_at;
        const processedAt = processedAtRaw ? new Date(processedAtRaw) : new Date();

        const webhookRepo = AppDataSource.getRepository(PaypackWebhookEvent);
        const subscriptionPaymentRepo = AppDataSource.getRepository(SubscriptionPayment);
        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        const orgRepo = AppDataSource.getRepository(Organization);

        // Dedupe by event_id (store even if signature invalid)
        const existing = await webhookRepo.findOne({ where: { event_id: eventId } });
        if (existing) return;

        if (!rawBody) {
            throw new Error('Missing raw webhook body buffer');
        }

        const computedSignature = crypto
            .createHmac('sha256', paypackWebhookSecret)
            .update(rawBody)
            .digest('base64');

        const signatureValid = !!signatureHeader && computedSignature === signatureHeader;

        // Insert webhook event record (unique constraint on event_id).
        // If another concurrent webhook handler already inserted it, we can exit safely.
        try {
            await webhookRepo.save({
                event_id: eventId,
                kind: eventKind || null,
                signature_valid: signatureValid,
                payload,
            });
        } catch (error: any) {
            if (error?.code === '23505') return;
            throw error;
        }

        if (!signatureValid) {
            throw new Error('Invalid Paypack webhook signature');
        }

        if (eventKind !== 'transaction:processed') {
            // Not the event we care about; already stored for audit.
            return;
        }

        if (!txRef || txKind !== 'CASHIN' || !txStatus) {
            return;
        }

        // Match Paypack transaction reference to our subscription_payment row
        const payment = await subscriptionPaymentRepo.findOne({
            where: { gateway_ref: txRef },
            relations: ['subscription', 'subscription.subscription_plan'],
        });

        if (!payment) {
            // Unknown payment ref - ignore (but keep webhook record for traceability)
            return;
        }

        const subscription = payment.subscription;
        const organizationId = subscription.organization_id;
        const org = await orgRepo.findOne({ where: { id: organizationId } });

        if (!org) return;

        // Idempotent updates: if we already processed success/failure, don't repeat.
        if ([SubscriptionPaymentStatus.SUCCESS, SubscriptionPaymentStatus.FAILED].includes(payment.status)) {
            return;
        }

        if (txStatus === 'successful') {
            const billingPeriodMonths = subscription.billing_period_months ?? 1;
            const anchor =
                subscription.current_period_end_at && subscription.current_period_end_at > processedAt
                    ? subscription.current_period_end_at
                    : processedAt;
            payment.status = SubscriptionPaymentStatus.SUCCESS;
            payment.paid_at = processedAt;
            payment.provider = provider;
            payment.kind = SubscriptionPaymentKind.CASHIN;
            await subscriptionPaymentRepo.save(payment);

            subscription.status = SubscriptionInternalStatus.ACTIVE;
            subscription.billing_attempts = 0;
            subscription.current_period_end_at = addMonths(anchor, billingPeriodMonths);
            subscription.next_billing_at = subscription.current_period_end_at;
            subscription.trial_end_at = null;
            await subscriptionRepo.save(subscription);

            org.subscription_status = OrganizationSubscriptionStatus.ACTIVE;
            await orgRepo.save(org);
            return;
        }

        if (txStatus === 'failed') {
            payment.status = SubscriptionPaymentStatus.FAILED;
            payment.paid_at = null;
            payment.provider = provider;
            payment.kind = SubscriptionPaymentKind.CASHIN;
            await subscriptionPaymentRepo.save(payment);

            const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '7', 10);
            const maxAttempts = parseInt(process.env.SUBSCRIPTION_MAX_ATTEMPTS || '2', 10);

            subscription.billing_attempts = (subscription.billing_attempts ?? 0) + 1;
            subscription.status = SubscriptionInternalStatus.PAST_DUE;
            subscription.next_billing_at = addDays(processedAt, graceDays);

            if (subscription.billing_attempts >= maxAttempts) {
                subscription.status = SubscriptionInternalStatus.EXPIRED;
            }

            await subscriptionRepo.save(subscription);

            // Keep legacy org status coarse-grained.
            org.subscription_status = OrganizationSubscriptionStatus.SUSPENDED;
            await orgRepo.save(org);
            return;
        }

        // Unknown txStatus - ignore.
    }
}

