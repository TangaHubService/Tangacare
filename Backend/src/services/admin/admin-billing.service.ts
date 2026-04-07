import { Between, ILike, In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Organization } from '../../entities/Organization.entity';
import { PlanFeature } from '../../entities/PlanFeature.entity';
import { PaymentGateway } from '../../entities/PaymentGateway.entity';
import { Subscription, SubscriptionStatus } from '../../entities/Subscription.entity';
import {
    SubscriptionChangeSchedule,
    SubscriptionChangeScheduleStatus,
} from '../../entities/SubscriptionChangeSchedule.entity';
import { SubscriptionPayment, SubscriptionPaymentStatus } from '../../entities/SubscriptionPayment.entity';
import { SubscriptionPlan } from '../../entities/SubscriptionPlan.entity';

function parseDate(input?: string): Date | undefined {
    if (!input) return undefined;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

export class AdminBillingService {
    async getBillingOverview() {
        const paymentRepo = AppDataSource.getRepository(SubscriptionPayment);
        const subscriptionRepo = AppDataSource.getRepository(Subscription);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const soonThreshold = new Date(now);
        soonThreshold.setDate(soonThreshold.getDate() + 7);

        const [allPaid, monthPaid, activeSubscriptions, trialSubscriptions, expiredSubscriptions, failedPayments, renewalsDueSoon, totalSubscriptions] =
            await Promise.all([
                paymentRepo.find({ where: { status: SubscriptionPaymentStatus.SUCCESS } }),
                paymentRepo.find({
                    where: {
                        status: SubscriptionPaymentStatus.SUCCESS,
                        paid_at: Between(monthStart, now),
                    },
                }),
                subscriptionRepo.count({ where: { status: SubscriptionStatus.ACTIVE } }),
                subscriptionRepo.count({ where: { status: SubscriptionStatus.TRIALING } }),
                subscriptionRepo.count({ where: { status: SubscriptionStatus.EXPIRED } }),
                paymentRepo.count({ where: { status: SubscriptionPaymentStatus.FAILED } }),
                subscriptionRepo.count({
                    where: {
                        status: In([SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
                        next_billing_at: Between(now, soonThreshold),
                    } as any,
                }),
                subscriptionRepo.count(),
            ]);

        const totalRevenue = allPaid.reduce((acc, p) => acc + (p.amount_rwf || 0), 0);
        const revenueThisMonth = monthPaid.reduce((acc, p) => acc + (p.amount_rwf || 0), 0);

        // Last 6 months trend
        const monthlyRevenueTrend: Array<{ month: string; revenue: number }> = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const revenue = allPaid
                .filter((p) => p.paid_at && p.paid_at >= start && p.paid_at < end)
                .reduce((acc, p) => acc + (p.amount_rwf || 0), 0);
            monthlyRevenueTrend.push({
                month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
                revenue,
            });
        }

        const planRows = await subscriptionRepo
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.subscription_plan', 'plan')
            .getMany();
        const planMap = new Map<string, number>();
        for (const row of planRows) {
            const code = row.subscription_plan?.plan_code || 'unknown';
            planMap.set(code, (planMap.get(code) || 0) + 1);
        }
        const planDistribution = Array.from(planMap.entries()).map(([planCode, count]) => ({
            planCode,
            count,
            sharePercent: totalSubscriptions > 0 ? Number(((count / totalSubscriptions) * 100).toFixed(2)) : 0,
        }));

        return {
            totalRevenue,
            revenueThisMonth,
            activeSubscriptions,
            trialSubscriptions,
            expiredSubscriptions,
            failedPayments,
            renewalsDueSoon,
            monthlyRevenueTrend,
            planDistribution,
        };
    }

    async getAllCustomersBillingStatus(params: {
        search?: string;
        plan?: string;
        status?: string;
        page: number;
        limit: number;
    }) {
        const { search, plan, status, page, limit } = params;
        const orgRepo = AppDataSource.getRepository(Organization);
        const subRepo = AppDataSource.getRepository(Subscription);
        const payRepo = AppDataSource.getRepository(SubscriptionPayment);

        const orgWhere: any = {};
        if (search) orgWhere.name = ILike(`%${search}%`);
        const [orgs, total] = await orgRepo.findAndCount({
            where: orgWhere,
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        const data = await Promise.all(
            orgs.map(async (org) => {
                const sub = await subRepo.findOne({
                    where: { organization_id: org.id },
                    order: { created_at: 'DESC' },
                    relations: ['subscription_plan'],
                });
                if (!sub) {
                    return {
                        organization: org,
                        subscription: null,
                        lastPaymentDate: null,
                        totalPayments: 0,
                    };
                }
                if (plan && sub.subscription_plan?.plan_code !== plan) return null;
                if (status && sub.status !== status) return null;

                const payments = await payRepo.find({
                    where: { subscription_id: sub.id },
                    order: { created_at: 'DESC' },
                });

                return {
                    organization: org,
                    subscription: sub,
                    lastPaymentDate: payments[0]?.paid_at || null,
                    totalPayments: payments.length,
                };
            }),
        );

        const filtered = data.filter(Boolean);
        return {
            data: filtered,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getCustomerBillingStatus(organizationId: number) {
        const org = await AppDataSource.getRepository(Organization).findOne({ where: { id: organizationId } });
        if (!org) throw new Error('Organization not found');
        const sub = await AppDataSource.getRepository(Subscription).findOne({
            where: { organization_id: organizationId },
            order: { created_at: 'DESC' },
            relations: ['subscription_plan'],
        });
        const payments = sub
            ? await AppDataSource.getRepository(SubscriptionPayment).find({
                  where: { subscription_id: sub.id },
                  order: { created_at: 'DESC' },
              })
            : [];

        const pendingPlanChange = sub
            ? await AppDataSource.getRepository(SubscriptionChangeSchedule).findOne({
                  where: {
                      subscription_id: sub.id,
                      status: SubscriptionChangeScheduleStatus.PENDING,
                  },
                  relations: ['from_plan', 'to_plan'],
                  order: { created_at: 'DESC' },
              })
            : null;

        return { organization: org, subscription: sub, payments, pendingPlanChange };
    }

    async getAllSubscriptions(filters: any) {
        const repo = AppDataSource.getRepository(Subscription);
        const qb = repo
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.subscription_plan', 'plan')
            .leftJoinAndSelect('s.organization', 'org')
            .orderBy('s.created_at', 'DESC');

        if (filters.status) qb.andWhere('s.status = :status', { status: filters.status });
        if (filters.plan) qb.andWhere('plan.plan_code = :plan', { plan: filters.plan });
        if (filters.search) qb.andWhere('org.name ILIKE :search', { search: `%${filters.search}%` });

        const from = parseDate(filters.dateFrom);
        const to = parseDate(filters.dateTo);
        if (from && to) qb.andWhere('s.created_at BETWEEN :from AND :to', { from, to });

        const page = Number(filters.page || 1);
        const limit = Math.min(Number(filters.limit || 20), 100);
        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getSubscriptionById(id: number) {
        return await AppDataSource.getRepository(Subscription).findOne({
            where: { id },
            relations: ['subscription_plan', 'organization'],
        });
    }

    async updateSubscriptionStatus(id: number, status: SubscriptionStatus) {
        const repo = AppDataSource.getRepository(Subscription);
        const sub = await repo.findOne({ where: { id } });
        if (!sub) throw new Error('Subscription not found');
        sub.status = status;
        return await repo.save(sub);
    }

    async extendTrial(subscriptionId: number, days: number) {
        const repo = AppDataSource.getRepository(Subscription);
        const sub = await repo.findOne({ where: { id: subscriptionId } });
        if (!sub) throw new Error('Subscription not found');
        const base = sub.trial_end_at || new Date();
        const updated = new Date(base);
        updated.setDate(updated.getDate() + days);
        sub.trial_end_at = updated;
        sub.next_billing_at = updated;
        sub.status = SubscriptionStatus.TRIALING;
        return await repo.save(sub);
    }

    async changeSubscriptionPlan(subscriptionId: number, toPlanId: number, effectiveMode: 'immediate' | 'next_cycle') {
        const subRepo = AppDataSource.getRepository(Subscription);
        const scheduleRepo = AppDataSource.getRepository(SubscriptionChangeSchedule);

        const sub = await subRepo.findOne({ where: { id: subscriptionId }, relations: ['subscription_plan'] });
        if (!sub) throw new Error('Subscription not found');

        if (effectiveMode === 'immediate') {
            sub.subscription_plan_id = toPlanId;
            await subRepo.save(sub);
            return { mode: 'immediate', subscription: sub };
        }

        const schedule = scheduleRepo.create({
            subscription_id: sub.id,
            from_plan_id: sub.subscription_plan_id,
            to_plan_id: toPlanId,
            effective_date: sub.next_billing_at || new Date(),
            status: SubscriptionChangeScheduleStatus.PENDING,
        });
        await scheduleRepo.save(schedule);
        return { mode: 'next_cycle', schedule };
    }

    async cancelPendingSubscriptionPlanChange(subscriptionId: number) {
        const scheduleRepo = AppDataSource.getRepository(SubscriptionChangeSchedule);
        const pending = await scheduleRepo.findOne({
            where: {
                subscription_id: subscriptionId,
                status: SubscriptionChangeScheduleStatus.PENDING,
            },
            relations: ['from_plan', 'to_plan'],
            order: { created_at: 'DESC' },
        });
        if (!pending) throw new Error('No pending plan change found');
        pending.status = SubscriptionChangeScheduleStatus.CANCELLED;
        return await scheduleRepo.save(pending);
    }

    async getAllPayments(filters: any) {
        const repo = AppDataSource.getRepository(SubscriptionPayment);
        const qb = repo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.subscription', 's')
            .leftJoinAndSelect('s.organization', 'org')
            .leftJoinAndSelect('s.subscription_plan', 'plan')
            .orderBy('p.created_at', 'DESC');

        if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });
        if (filters.gateway) qb.andWhere('p.gateway = :gateway', { gateway: filters.gateway });
        if (filters.provider) qb.andWhere('p.provider = :provider', { provider: filters.provider });
        if (filters.plan) qb.andWhere('plan.plan_code = :plan', { plan: filters.plan });
        if (filters.search) qb.andWhere('org.name ILIKE :search', { search: `%${filters.search}%` });

        const from = parseDate(filters.dateFrom);
        const to = parseDate(filters.dateTo);
        if (from && to) qb.andWhere('p.created_at BETWEEN :from AND :to', { from, to });

        const page = Number(filters.page || 1);
        const limit = Math.min(Number(filters.limit || 20), 100);
        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getPaymentById(id: number) {
        return await AppDataSource.getRepository(SubscriptionPayment).findOne({
            where: { id },
            relations: ['subscription', 'subscription.organization', 'subscription.subscription_plan'],
        });
    }

    async getTrialSubscriptions() {
        return await AppDataSource.getRepository(Subscription).find({
            where: { status: SubscriptionStatus.TRIALING },
            relations: ['subscription_plan', 'organization'],
            order: { trial_end_at: 'ASC' },
        });
    }

    async getPlanList() {
        return await AppDataSource.getRepository(SubscriptionPlan).find({ order: { id: 'ASC' } });
    }

    async createPlan(input: {
        name: string;
        code: string;
        price_rwf_monthly?: number;
        is_active?: boolean;
    }) {
        const repo = AppDataSource.getRepository(SubscriptionPlan);
        const entity = repo.create({
            name: input.name,
            plan_code: input.code as any,
            price_rwf_monthly: input.price_rwf_monthly ?? null,
            trial_days: 7,
            max_users: null,
            max_facilities: null,
        });
        const saved = await repo.save(entity);
        return { ...saved, is_active: input.is_active ?? true };
    }

    async updatePlan(id: number, input: Partial<{ name: string; price_rwf_monthly: number }>) {
        const repo = AppDataSource.getRepository(SubscriptionPlan);
        const plan = await repo.findOne({ where: { id } });
        if (!plan) throw new Error('Plan not found');
        if (input.name != null) plan.name = input.name;
        if (input.price_rwf_monthly != null) plan.price_rwf_monthly = input.price_rwf_monthly;
        return await repo.save(plan);
    }

    async getPlanFeatures(planId: number) {
        return await AppDataSource.getRepository(PlanFeature).find({
            where: { plan_id: planId },
            order: { key: 'ASC' },
        });
    }

    async updatePlanFeatures(planId: number, features: Array<{ key: string; enabled: boolean; limit_value?: number | null }>) {
        const repo = AppDataSource.getRepository(PlanFeature);
        const existing = await repo.find({ where: { plan_id: planId } });
        const map = new Map(existing.map((f) => [f.key, f]));
        for (const item of features) {
            const found = map.get(item.key);
            if (found) {
                found.enabled = item.enabled;
                found.limit_value = item.limit_value ?? null;
                await repo.save(found);
            } else {
                await repo.save(
                    repo.create({
                        plan_id: planId,
                        key: item.key,
                        enabled: item.enabled,
                        limit_value: item.limit_value ?? null,
                    }),
                );
            }
        }
        return await this.getPlanFeatures(planId);
    }

    async getPaymentGatewaySettings() {
        return await AppDataSource.getRepository(PaymentGateway).find({ order: { updated_at: 'DESC' } });
    }

    async updatePaymentGatewaySettings(gatewayId: number, data: { is_active?: boolean; config_json?: Record<string, any> }) {
        const repo = AppDataSource.getRepository(PaymentGateway);
        const gateway = await repo.findOne({ where: { id: gatewayId } });
        if (!gateway) throw new Error('Gateway not found');
        if (data.is_active != null) gateway.is_active = data.is_active;
        if (data.config_json != null) gateway.config_json = data.config_json;
        return await repo.save(gateway);
    }
}

