import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Package,
    Users,
    Activity,
    Calendar,
    AlertCircle,
    CheckCircle2,
    BarChart3,
    ArrowRight,
} from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import type { ComprehensiveKPIs } from '../../../types/pharmacy';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

interface KPICardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    status?: 'good' | 'warning' | 'critical';
    color?: 'blue' | 'green' | 'amber' | 'rose' | 'indigo';
}

const KPICard = ({ title, value, subtitle, icon, trend, status, color = 'blue' }: KPICardProps) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
        green: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl border ${colorClasses[color]}`}>{icon}</div>
                {trend && (
                    <div
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                            trend.isPositive
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                        }`}
                    >
                        {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trend.value.toFixed(1)}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                    {title}
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
                {(subtitle || status) && (
                    <div className="flex items-center gap-2 mt-2">
                        {status && (
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    status === 'good'
                                        ? 'bg-emerald-500'
                                        : status === 'warning'
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                }`}
                            />
                        )}
                        <span className="text-xs text-slate-400 font-medium">{subtitle}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const KPIDashboard = ({
    facilityId,
    startDate,
    endDate,
}: {
    facilityId: number;
    startDate: string;
    endDate: string;
}) => {
    const { formatMoney } = useRuntimeConfig();
    const {
        data: kpis,
        isLoading,
        error,
    } = useQuery<ComprehensiveKPIs>({
        queryKey: ['comprehensive-kpis', facilityId, startDate, endDate],
        queryFn: () =>
            pharmacyService.getComprehensiveKPIs(facilityId, {
                start_date: startDate,
                end_date: endDate,
            }),
    });

    if (isLoading)
        return (
            <SkeletonTable
                rows={4}
                columns={1}
                headers={null}
                className="border-none shadow-none"
            />
        );
    if (error || !kpis)
        return (
            <div className="p-12 text-center text-slate-400 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20">
                <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">Failed to load KPI data. Please try again later.</p>
            </div>
        );

    const { financial, inventory, operational } = kpis;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed -mt-2">
                KPIs summarize sales, margin, and inventory signals for the selected facility and dates.
                Pair with <strong>Reports → Stock / Expiry</strong> and occasional cycle counts — analytics
                complement on-hand records; they do not replace them.
            </p>
            {/* Financial Overview */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
                        <DollarSign size={20} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Financial Health
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        title="Net Revenue"
                        value={formatMoney(financial.total_revenue)}
                        icon={<DollarSign size={20} />}
                        color="green"
                        subtitle={`Avg. ${formatMoney(financial.revenue_per_day)}/day`}
                    />
                    <KPICard
                        title="Net Profit"
                        value={formatMoney(financial.net_profit)}
                        icon={<Activity size={20} />}
                        color="indigo"
                        subtitle={`${financial.net_profit_margin.toFixed(1)}% margin`}
                        status={financial.net_profit_margin > 20 ? 'good' : 'warning'}
                    />
                    <KPICard
                        title="Avg Sale Value"
                        value={formatMoney(financial.average_transaction_value)}
                        icon={<BarChart3 size={20} />}
                        color="blue"
                        subtitle="Per transaction"
                    />
                    <KPICard
                        title="Total Transactions"
                        value={financial.total_transactions}
                        icon={<TrendingUp size={20} />}
                        color="blue"
                        subtitle="Completed sales"
                    />
                </div>
            </div>

            {/* Inventory Health */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                        <Package size={20} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Inventory Performance
                    </h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <KPICard
                            title="Total Stock Value"
                            value={formatMoney(inventory.total_inventory_value)}
                            icon={<Package size={20} />}
                            color="blue"
                            subtitle={`${inventory.total_items.toLocaleString()} units in stock`}
                        />
                        <KPICard
                            title="Turnover Ratio"
                            value={inventory.inventory_turnover_ratio.toFixed(2)}
                            icon={<Activity size={20} />}
                            color="indigo"
                            subtitle={`${inventory.days_inventory_outstanding.toFixed(1)} days to sell`}
                            status={inventory.inventory_turnover_ratio > 0.5 ? 'good' : 'warning'}
                        />
                        <KPICard
                            title="Stock Alerts"
                            value={inventory.low_stock_items + inventory.out_of_stock_items}
                            icon={<AlertCircle size={20} />}
                            color="rose"
                            subtitle={`${inventory.out_of_stock_items} out of stock`}
                            status={inventory.out_of_stock_items > 0 ? 'critical' : 'warning'}
                        />
                        <KPICard
                            title="Expiry Risk"
                            value={inventory.expiring_soon_items + inventory.expired_items}
                            icon={<Calendar size={20} />}
                            color="amber"
                            subtitle={`${inventory.expired_items} expired units`}
                            status={inventory.expired_items > 0 ? 'critical' : 'warning'}
                        />
                    </div>
                    <div className="bg-gradient-to-br from-healthcare-primary to-teal-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold opacity-80 mb-1">
                                    Stock Health Score
                                </h3>
                                <p className="text-xs opacity-60 uppercase font-black tracking-widest">
                                    Composite Metric
                                </p>
                            </div>
                            <div className="my-6">
                                <div className="text-6xl font-black tracking-tighter">
                                    {inventory.stock_health_score.toFixed(0)}
                                    <span className="text-2xl opacity-50">%</span>
                                </div>
                                <div className="mt-2 w-full bg-white/20 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-white h-full"
                                        style={{ width: `${inventory.stock_health_score}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold bg-white/10 p-3 rounded-xl border border-white/10">
                                {inventory.stock_health_score >= 80 ? (
                                    <CheckCircle2 size={16} />
                                ) : (
                                    <AlertCircle size={16} />
                                )}
                                {inventory.stock_health_score >= 80
                                    ? 'Excellent'
                                    : inventory.stock_health_score >= 60
                                      ? 'Satisfactory'
                                      : 'Needs Attention'}
                            </div>
                        </div>
                        {/* Decorative pattern */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl" />
                    </div>
                </div>
            </div>

            {/* Operational Efficiency */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                        <Users size={20} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Operation & Retention
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        title="Return Rate"
                        value={`${operational.return_rate.toFixed(1)}%`}
                        icon={<Activity size={20} />}
                        color="rose"
                        subtitle="Refunded value / Sales"
                        status={operational.return_rate < 5 ? 'good' : 'warning'}
                    />
                    <KPICard
                        title="Customer Base"
                        value={operational.customer_count.toLocaleString()}
                        icon={<Users size={20} />}
                        color="blue"
                        subtitle="Unique patients"
                    />
                    <KPICard
                        title="Retention Rate"
                        value={`${operational.repeat_customer_rate.toFixed(1)}%`}
                        icon={<TrendingUp size={20} />}
                        color="green"
                        subtitle="Returning customers"
                        status={operational.repeat_customer_rate > 30 ? 'good' : 'warning'}
                    />
                    <KPICard
                        title="Growth Rate"
                        value={`${operational.sales_growth_rate.toFixed(1)}%`}
                        icon={<TrendingUp size={20} />}
                        color="indigo"
                        trend={{
                            value: operational.sales_growth_rate,
                            label: 'vs prev month',
                            isPositive: operational.sales_growth_rate >= 0,
                        }}
                        subtitle="Revenue growth"
                    />
                </div>
            </div>

            {/* Top Product Hero */}
            {operational.top_selling_medicine && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-healthcare-primary/10 rounded-2xl flex items-center justify-center text-healthcare-primary">
                            <BarChart3 size={32} />
                        </div>
                        <div>
                            <p className="text-xs font-black text-healthcare-primary uppercase tracking-widest mb-1">
                                Top Selling Product
                            </p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                                {operational.top_selling_medicine.medicine_name}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">
                                Contributed {formatMoney(operational.top_selling_medicine.revenue)} in
                                revenue
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                Units Sold
                            </p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">
                                {operational.top_selling_medicine.quantity_sold}
                            </p>
                        </div>
                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                        <button className="flex items-center gap-2 group text-healthcare-primary font-bold text-sm hover:underline transition-all">
                            View Details{' '}
                            <ArrowRight
                                size={16}
                                className="group-hover:translate-x-1 transition-transform"
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
