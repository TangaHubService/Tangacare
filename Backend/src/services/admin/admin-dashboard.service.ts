import { AppDataSource } from '../../config/database';
import { Organization } from '../../entities/Organization.entity';
import { Subscription, SubscriptionStatus } from '../../entities/Subscription.entity';
import { SubscriptionPayment, SubscriptionPaymentStatus } from '../../entities/SubscriptionPayment.entity';
import { AdminBillingService } from './admin-billing.service';

export type MonthlyRevenuePoint = { month: string; revenue: number };
export type PlanDistributionRow = { plan: string; count: number };

export type RecentFailedPaymentRow = {
    organization: string;
    amount: number;
    status: string;
    date: Date | string;
};

export type RenewalsDueSoonRow = {
    organization: string;
    plan: string;
    nextBillingDate: Date | string;
    status: string;
};

export class AdminDashboardService {
    async getDashboardData(params?: { renewalsDueSoonDays?: number; trendMonths?: number }) {
        const renewalsDueSoonDays = params?.renewalsDueSoonDays ?? 5;

        const now = new Date();
        const soonThreshold = new Date(now);
        soonThreshold.setDate(soonThreshold.getDate() + renewalsDueSoonDays);

        const paymentRepo = AppDataSource.getRepository(SubscriptionPayment);
        const subscriptionRepo = AppDataSource.getRepository(Subscription);
        const organizationRepo = AppDataSource.getRepository(Organization);

        const [totalOrganizations, billingOverview] = await Promise.all([
            organizationRepo.count(),
            new AdminBillingService().getBillingOverview(),
        ]);

        const totalRevenue = billingOverview?.totalRevenue ?? 0;
        const revenueThisMonth = billingOverview?.revenueThisMonth ?? 0;
        const activeSubscriptions = billingOverview?.activeSubscriptions ?? 0;
        const trialSubscriptions = billingOverview?.trialSubscriptions ?? 0;
        const expiredSubscriptions = billingOverview?.expiredSubscriptions ?? 0;
        const failedPayments = billingOverview?.failedPayments ?? 0;

        const monthlyRevenueTrend: MonthlyRevenuePoint[] = (billingOverview?.monthlyRevenueTrend ?? []).map((m: any) => {
            const rawMonth = String(m.month || '');
            const parts = rawMonth.split('-');
            if (parts.length === 2) {
                const year = Number(parts[0]);
                const monthIndex = Number(parts[1]) - 1;
                if (!Number.isNaN(year) && !Number.isNaN(monthIndex)) {
                    return {
                        month: new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'short' }),
                        revenue: Number(m.revenue ?? 0),
                    };
                }
            }
            return {
                month: rawMonth || '—',
                revenue: Number(m.revenue ?? 0),
            };
        });

        // Proper query using query builder to avoid In([]) edge cases.
        const renewalsDueSoonQ = await subscriptionRepo
            .createQueryBuilder('s')
            .where('s.status IN (:...statuses)', {
                statuses: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
            })
            .andWhere('s.next_billing_at IS NOT NULL')
            .andWhere('s.next_billing_at >= :now', { now })
            .andWhere('s.next_billing_at <= :soonThreshold', { soonThreshold })
            .getCount();

        // Revenue & subscription summary values are reused from AdminBillingService.
        // We still recompute renewalsDueSoon using a narrower window (3-5 days).

        const planDistributionRows = await subscriptionRepo
            .createQueryBuilder('s')
            .innerJoin('s.subscription_plan', 'plan')
            .select('plan.name', 'plan')
            .addSelect('COUNT(s.id)', 'count')
            .groupBy('plan.name')
            .orderBy('count', 'DESC')
            .getRawMany<{ plan: string; count: string }>();

        const planDistribution: PlanDistributionRow[] = planDistributionRows.map((r) => ({
            plan: r.plan,
            count: Number(r.count ?? 0),
        }));

        const recentFailedPayments = await paymentRepo
            .createQueryBuilder('p')
            .innerJoin('p.subscription', 's')
            .innerJoin('s.organization', 'org')
            .select('org.name', 'organization')
            .addSelect('p.amount_rwf', 'amount')
            .addSelect('p.status', 'status')
            .addSelect('p.created_at', 'date')
            .where('p.status = :status', { status: SubscriptionPaymentStatus.FAILED })
            .orderBy('p.created_at', 'DESC')
            .limit(5)
            .getRawMany<{ organization: string; amount: string; status: string; date: Date }>();

        const renewalsDueSoonSubscriptions = await subscriptionRepo
            .createQueryBuilder('s')
            .innerJoin('s.organization', 'org')
            .innerJoin('s.subscription_plan', 'plan')
            .select('org.name', 'organization')
            .addSelect('plan.name', 'plan')
            .addSelect('s.next_billing_at', 'nextBillingDate')
            .addSelect('s.status', 'status')
            .where('s.status IN (:...statuses)', {
                statuses: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
            })
            .andWhere('s.next_billing_at IS NOT NULL')
            .andWhere('s.next_billing_at >= :now', { now })
            .andWhere('s.next_billing_at <= :soonThreshold', { soonThreshold })
            .orderBy('s.next_billing_at', 'ASC')
            .limit(10)
            .getRawMany<{ organization: string; plan: string; nextBillingDate: Date; status: string }>();

        return {
            totalRevenue,
            revenueThisMonth,
            activeSubscriptions,
            trialSubscriptions,
            expiredSubscriptions,
            failedPayments,
            totalOrganizations,
            renewalsDueSoon: renewalsDueSoonQ,
            monthlyRevenueTrend,
            planDistribution,
            recentFailedPayments: recentFailedPayments.map((p) => ({
                organization: p.organization,
                amount: Number(p.amount ?? 0),
                status: p.status,
                date: p.date,
            })),
            renewalsDueSoonSubscriptions: renewalsDueSoonSubscriptions.map((r) => ({
                organization: r.organization,
                plan: r.plan,
                nextBillingDate: r.nextBillingDate,
                status: r.status,
            })),
        };
    }
}

