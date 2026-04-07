import {
    DollarSign,
    ShoppingCart,
    Package,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Activity,
} from 'lucide-react';
import type { DashboardSummary } from '../../../types/pharmacy';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color: 'emerald' | 'blue' | 'indigo' | 'rose' | 'amber';
}

const StatCard = ({ title, value, subtitle, icon, trend, color }: StatCardProps) => {
    const colorMap = {
        emerald:
            'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
        rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
        amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    };

    return (
        <div className="tc-stat-card tc-stat-card-neutral">
            <div className="tc-stat-card-header">
                <div className={`tc-stat-card-icon border ${colorMap[color]}`}>{icon}</div>
                {trend && (
                    <div
                        className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            trend.isPositive
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                        }`}
                    >
                        {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trend.value).toFixed(1)}%
                    </div>
                )}
            </div>
            <div className="tc-stat-card-foot">
                <div className="min-w-0">
                    <p className="tc-stat-card-title">{title}</p>
                    <h3 className="tc-stat-card-value truncate">{value}</h3>
                </div>
                {subtitle && <p className="tc-stat-card-subtitle text-right">{subtitle}</p>}
            </div>
        </div>
    );
};

export const SummaryStatCards = ({ summary }: { summary: DashboardSummary }) => {
    const { formatMoney } = useRuntimeConfig();
    const { today, expiry_risk } = summary;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
                title="Today's Sales"
                value={formatMoney(today.financial.total_revenue)}
                subtitle="Gross revenue today"
                icon={<DollarSign size={15} />}
                color="emerald"
                trend={{
                    value: today.operational.sales_growth_rate,
                    isPositive: today.operational.sales_growth_rate >= 0,
                }}
            />
            <StatCard
                title="Today's Profit"
                value={formatMoney(today.financial.net_profit)}
                subtitle={`${today.financial.net_profit_margin.toFixed(1)}% margin`}
                icon={<Activity size={15} />}
                color="indigo"
            />
            <StatCard
                title="Transactions"
                value={today.financial.total_transactions}
                subtitle="Sales count today"
                icon={<ShoppingCart size={15} />}
                color="blue"
            />
            <StatCard
                title="Items Sold"
                value={today.operational.total_sales_volume}
                subtitle="Total units moved"
                icon={<Package size={15} />}
                color="blue"
            />
            <StatCard
                title="Out of Stock"
                value={today.inventory.out_of_stock_items}
                subtitle="Items needing reorder"
                icon={<AlertTriangle size={15} />}
                color="rose"
            />
            <StatCard
                title="Expiry Warning"
                value={expiry_risk.under_90_days.count}
                subtitle="Expiring < 90 days"
                icon={<AlertTriangle size={15} />}
                color="amber"
            />
        </div>
    );
};
