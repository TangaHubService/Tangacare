import * as cron from 'node-cron';
import crypto from 'crypto';
import { AlertService } from './alert.service';
import { VarianceService } from './variance.service';
import { ProcurementService } from './procurement.service';
import { ReplenishmentService } from './replenishment.service';
import { EBMClient } from './ebm.client';
import { AppDataSource } from '../../config/database';
import { Facility } from '../../entities/Facility.entity';
import { User, UserRole } from '../../entities/User.entity';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { logger } from '../../middleware/logger.middleware';
import { SettingsService } from './settings.service';
import { SETTINGS_KEYS } from './settings.constants';
import { PaypackGateway } from '../payment-gateways/paypackGateway';
import { Subscription, SubscriptionStatus as SubscriptionInternalStatus } from '../../entities/Subscription.entity';
import { SubscriptionPayment, SubscriptionPaymentStatus, SubscriptionPaymentGateway, SubscriptionPaymentKind } from '../../entities/SubscriptionPayment.entity';

export class SchedulerService {
    private alertService: AlertService;
    private varianceService: VarianceService;
    private procurementService: ProcurementService;
    private replenishmentService: ReplenishmentService;
    private ebmClient: EBMClient;
    private facilityRepository: Repository<Facility>;
    private userRepository: Repository<User>;
    private subscriptionRepository: Repository<Subscription>;
    private subscriptionPaymentRepository: Repository<SubscriptionPayment>;
    private paypackGateway: PaypackGateway;
    private tasks: Map<string, cron.ScheduledTask> = new Map();
    private taskStatus: Map<string, boolean> = new Map();
    private schedulerTimezone: string = 'UTC';

    constructor() {
        this.alertService = new AlertService();
        this.varianceService = new VarianceService();
        this.procurementService = new ProcurementService();
        this.replenishmentService = new ReplenishmentService();
        this.ebmClient = new EBMClient();
        this.facilityRepository = AppDataSource.getRepository(Facility);
        this.userRepository = AppDataSource.getRepository(User);
        this.subscriptionRepository = AppDataSource.getRepository(Subscription);
        this.subscriptionPaymentRepository = AppDataSource.getRepository(SubscriptionPayment);
        this.paypackGateway = new PaypackGateway();
    }

    async initialize(): Promise<void> {
        logger.info('Initializing pharmacy scheduler jobs...');
        this.schedulerTimezone = await this.resolveSchedulerTimezone();
        logger.info(`Scheduler timezone resolved to ${this.schedulerTimezone}`);

        // Hourly Comprehensive Health Check (Low Stock & Expiries)
        this.scheduleAlertChecks('0 * * * *', 'comprehensive-health-check', this.schedulerTimezone);

        // Deep Expiry Check at 2 AM
        this.scheduleExpiryChecks('0 2 * * *', 'daily-expiry-check', this.schedulerTimezone);

        // Hourly Small Variance Auto-Approval
        this.scheduleAutoApproval('0 * * * *', 'variance-auto-approval', this.schedulerTimezone);

        // Daily Critical Reorder PO Generation
        this.scheduleAutoReorder('30 2 * * *', 'critical-reorder-po-gen', this.schedulerTimezone);

        // C-3c: EBM Retry Queue — runs every 15 minutes
        this.scheduleEbmRetry('*/15 * * * *', 'ebm-retry-queue', this.schedulerTimezone);

        // Subscription renewals / trial-end charging — runs every 15 minutes
        this.scheduleSubscriptionRenewals(
            '*/15 * * * *',
            'subscription-renewals',
            this.schedulerTimezone,
        );

        logger.info('Pharmacy scheduler jobs initialized successfully');
    }

    private async getSystemUser(facilityId: number): Promise<User | null> {
        return await this.userRepository.findOne({
            where: {
                facility_id: facilityId,
                role: UserRole.FACILITY_ADMIN,
                is_active: true,
            },
        });
    }

    /** C-3c: Retry failed EBM submissions every 15 minutes */
    private async resolveSchedulerTimezone(): Promise<string> {
        const envTimezone = process.env.SCHEDULER_TIMEZONE;
        if (envTimezone && envTimezone.trim()) {
            return envTimezone.trim();
        }

        const fallback = String(SettingsService.systemDefaultValue(SETTINGS_KEYS.LOCALIZATION_TIMEZONE) || 'UTC');
        const [firstFacility] = await this.facilityRepository.find({
            where: { is_active: true },
            order: { id: 'ASC' },
            take: 1,
        });

        if (!firstFacility) {
            return fallback;
        }

        try {
            const settingsService = new SettingsService();
            const timezone = await settingsService.getEffectiveValue<string>(
                SETTINGS_KEYS.LOCALIZATION_TIMEZONE,
                {
                    tenantId: firstFacility.organization_id || undefined,
                    branchId: firstFacility.id,
                },
            );
            return typeof timezone === 'string' && timezone.trim() ? timezone.trim() : fallback;
        } catch {
            return fallback;
        }
    }

    private scheduleEbmRetry(cronExpression: string, taskName: string, timezone: string): void {
        const task = cron.schedule(
            cronExpression,
            async () => {
                try {
                    if (!this.ebmClient.enabled) return; // skip in stub mode
                    logger.info(`Running ${taskName}...`);
                    await this.ebmClient.processRetryQueue();
                    const stats = await this.ebmClient.getQueueStats();
                    logger.info(`${taskName} completed`, { queue: stats });
                } catch (error: any) {
                    logger.error(`Error in ${taskName}: ${error.message}`);
                }
            },
            { timezone },
        );
        this.tasks.set(taskName, task);
        this.taskStatus.set(taskName, true);
        logger.info(`Scheduled ${taskName} with expression: ${cronExpression}`);
    }

    private scheduleSubscriptionRenewals(cronExpression: string, taskName: string, timezone: string): void {
        const task = cron.schedule(
            cronExpression,
            async () => {
                try {
                    const clientId = process.env.PAYPACK_CLIENT_ID;
                    const clientSecret = process.env.PAYPACK_CLIENT_SECRET;
                    if (!clientId || !clientSecret) {
                        logger.info(
                            `Skipping ${taskName}: PAYPACK_CLIENT_ID/PAYPACK_CLIENT_SECRET not configured`,
                        );
                        return;
                    }

                    const now = new Date();
                    const dueSubscriptions = await this.subscriptionRepository.find({
                        where: {
                            status: In([
                                SubscriptionInternalStatus.TRIALING,
                                SubscriptionInternalStatus.ACTIVE,
                                SubscriptionInternalStatus.PAST_DUE,
                            ]),
                            next_billing_at: LessThanOrEqual(now),
                        } as any,
                        relations: ['subscription_plan'],
                    });

                    if (dueSubscriptions.length === 0) return;

                    for (const sub of dueSubscriptions) {
                        const plan = sub.subscription_plan;
                        const monthlyPrice = plan?.price_rwf_monthly ?? null;
                        const billingPeriodMonths = sub.billing_period_months ?? 1;

                        if (!monthlyPrice || !Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
                            logger.warn(
                                `Skipping subscription ${sub.id}: no auto-bill price for plan ${plan?.plan_code}`,
                            );
                            continue;
                        }

                        const discountMultiplier = billingPeriodMonths === 12 ? 0.8 : 1;
                        const amountRwf = Math.round(monthlyPrice * billingPeriodMonths * discountMultiplier);

                        const pending = await this.subscriptionPaymentRepository.findOne({
                            where: {
                                subscription_id: sub.id,
                                status: SubscriptionPaymentStatus.PENDING,
                            } as any,
                        });

                        if (pending) continue;

                        const nextBillingAtIso = sub.next_billing_at ? sub.next_billing_at.toISOString() : '';
                        const idempotencyKey = crypto
                            .createHash('sha256')
                            .update(`${sub.id}:${nextBillingAtIso}:${billingPeriodMonths}:${discountMultiplier}:${amountRwf}`)
                            .digest('hex')
                            .slice(0, 32);

                        logger.info(
                            `Creating Paypack cash-in for subscription ${sub.id} plan ${plan?.plan_code} billingMonths ${billingPeriodMonths} amount ${amountRwf}`,
                        );

                        const cashIn = await this.paypackGateway.createCashIn({
                            amount_rwf: amountRwf,
                            phone_number: sub.paypack_phone_number,
                            idempotency_key: idempotencyKey,
                        });

                        try {
                            const payment = this.subscriptionPaymentRepository.create({
                                subscription_id: sub.id,
                                amount_rwf: amountRwf,
                                currency: 'RWF',
                                gateway: SubscriptionPaymentGateway.PAYPACK,
                                gateway_ref: cashIn.ref,
                                status: SubscriptionPaymentStatus.PENDING,
                                kind: SubscriptionPaymentKind.CASHIN,
                                provider: null,
                                paid_at: null,
                            });

                            await this.subscriptionPaymentRepository.save(payment);
                        } catch (error: any) {
                            // If two scheduler ticks race, we might attempt to store the same gateway_ref twice.
                            if (error?.code === '23505') continue;
                            throw error;
                        }
                    }
                } catch (error: any) {
                    logger.error(`Error in ${taskName}: ${error.message}`);
                }
            },
            { timezone },
        );

        this.tasks.set(taskName, task);
        this.taskStatus.set(taskName, true);
        logger.info(`Scheduled ${taskName} with expression: ${cronExpression}`);
    }

    private scheduleAutoApproval(cronExpression: string, taskName: string, timezone: string): void {
        const task = cron.schedule(
            cronExpression,
            async () => {
                try {
                    logger.info(`Running scheduled ${taskName}...`);
                    const facilities = await this.facilityRepository.find({ where: { is_active: true } });

                    for (const facility of facilities) {
                        const systemUser = await this.getSystemUser(facility.id);
                        if (!systemUser) continue;

                        // Auto-approve variances < 2,000 RWF
                        const count = await this.varianceService.autoApproveSmallVariances(
                            facility.id,
                            facility.organization_id!,
                            2000,
                            systemUser.id,
                        );
                        if (count > 0) {
                            logger.info(`Auto-approved ${count} small variances for facility ${facility.id}`);
                        }
                    }
                } catch (error: any) {
                    logger.error(`Error in scheduled ${taskName}: ${error.message}`);
                }
            },
            { timezone },
        );

        this.tasks.set(taskName, task);
        this.taskStatus.set(taskName, true);
    }

    private scheduleAutoReorder(cronExpression: string, taskName: string, timezone: string): void {
        const task = cron.schedule(
            cronExpression,
            async () => {
                try {
                    logger.info(`Running scheduled ${taskName}...`);
                    const facilities = await this.facilityRepository.find({ where: { is_active: true } });

                    for (const facility of facilities) {
                        const systemUser = await this.getSystemUser(facility.id);
                        if (!systemUser) continue;

                        // Get canonical replenishment suggestions
                        const suggestions = await this.replenishmentService.getSuggestions(
                            facility.organization_id!,
                            facility.id,
                        );

                        const pos = await this.procurementService.createDraftPOsFromReorderSuggestions(
                            facility.id,
                            facility.organization_id!,
                            suggestions,
                            systemUser.id,
                        );

                        if (pos.length > 0) {
                            logger.info(
                                `Automated ${pos.length} draft PO(s) created for facility ${facility.id}: ${pos
                                    .map((po) => po.order_number)
                                    .join(', ')}`,
                            );
                        }
                    }
                } catch (error: any) {
                    logger.error(`Error in scheduled ${taskName}: ${error.message}`);
                }
            },
            { timezone },
        );

        this.tasks.set(taskName, task);
        this.taskStatus.set(taskName, true);
    }

    private scheduleAlertChecks(cronExpression: string, taskName: string, timezone: string): void {
        const task = cron.schedule(
            cronExpression,
            async () => {
                try {
                    logger.info(`Running scheduled ${taskName}...`);
                    const facilities = await this.facilityRepository.find({ where: { is_active: true } });

                    for (const facility of facilities) {
                        try {
                            await this.alertService.runAllChecks(facility.id, facility.organization_id!);
                            logger.info(`Alert checks completed for facility ${facility.id} (${facility.name})`);
                        } catch (error: any) {
                            logger.error(`Error running alert checks for facility ${facility.id}: ${error.message}`, {
                                facilityId: facility.id,
                                error: error.stack,
                            });
                        }
                    }

                    logger.info(`${taskName} completed for ${facilities.length} facilities`);
                } catch (error: any) {
                    logger.error(`Error in scheduled ${taskName}: ${error.message}`, { error: error.stack });
                }
            },
            {
                timezone,
            },
        );

        this.tasks.set(taskName, task);
        this.taskStatus.set(taskName, true);
        logger.info(`Scheduled ${taskName} with expression: ${cronExpression}`);
    }

    private scheduleExpiryChecks(cronExpression: string, taskName: string, timezone: string): void {
        const task = cron.schedule(
            cronExpression,
            async () => {
                try {
                    logger.info(`Running scheduled ${taskName}...`);
                    const facilities = await this.facilityRepository.find({ where: { is_active: true } });

                    for (const facility of facilities) {
                        try {
                            await this.alertService.checkExpiries(facility.id, facility.organization_id!);
                            logger.info(`Expiry check completed for facility ${facility.id}`);
                        } catch (error: any) {
                            logger.error(`Error running expiry check for facility ${facility.id}: ${error.message}`, {
                                facilityId: facility.id,
                                error: error.stack,
                            });
                        }
                    }

                    logger.info(`${taskName} completed for ${facilities.length} facilities`);
                } catch (error: any) {
                    logger.error(`Error in scheduled ${taskName}: ${error.message}`, { error: error.stack });
                }
            },
            {
                timezone,
            },
        );

        this.tasks.set(taskName, task);
        this.taskStatus.set(taskName, true);
        logger.info(`Scheduled ${taskName} with expression: ${cronExpression}`);
    }

    startTask(taskName: string): void {
        const task = this.tasks.get(taskName);
        if (task) {
            task.start();
            this.taskStatus.set(taskName, true);
            logger.info(`Started scheduled task: ${taskName}`);
        } else {
            logger.warn(`Task not found: ${taskName}`);
        }
    }

    stopTask(taskName: string): void {
        const task = this.tasks.get(taskName);
        if (task) {
            task.stop();
            this.taskStatus.set(taskName, false);
            logger.info(`Stopped scheduled task: ${taskName}`);
        } else {
            logger.warn(`Task not found: ${taskName}`);
        }
    }

    getTasksStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {};
        this.taskStatus.forEach((isRunning, name) => {
            status[name] = isRunning;
        });
        return status;
    }

    shutdown(): void {
        logger.info('Shutting down pharmacy scheduler...');
        this.tasks.forEach((task, name) => {
            task.stop();
            this.taskStatus.set(name, false);
            logger.info(`Stopped scheduled task: ${name}`);
        });
        this.tasks.clear();
        this.taskStatus.clear();
        logger.info('Pharmacy scheduler shutdown complete');
    }
}
