import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PieChart as PieChartIcon, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { pharmacyService } from '../../services/pharmacy.service';
import type { ABCAnalysisData } from '../../types/pharmacy';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';
import { ChartSkeleton } from './DashboardSkeletons';

const CLASS_COLORS = {
    A: '#059669',
    B: '#d97706',
    C: '#e11d48',
} as const;

interface DashboardABCStockChartProps {
    facilityId: number | null;
}

/**
 * ABC consumption-value split for quick stock performance review on the dashboard.
 */
export function DashboardABCStockChart({ facilityId }: DashboardABCStockChartProps) {
    const navigate = useNavigate();
    const { formatMoney } = useRuntimeConfig();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard-abc-analysis', facilityId],
        queryFn: async (): Promise<ABCAnalysisData> => pharmacyService.getABCAnalysis(),
        enabled: facilityId != null,
        staleTime: 5 * 60_000,
    });

    if (facilityId == null) {
        return (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center dark:border-slate-600 dark:bg-slate-800/40">
                <PieChartIcon className="mb-2 h-8 w-8 text-[#94A3B8] dark:text-slate-500" />
                <p className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                    Select a branch to see ABC stock value split (Class A / B / C).
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="h-[250px] rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 dark:border-slate-700 dark:bg-slate-900">
                <ChartSkeleton />
            </div>
        );
    }

    if (isError || !data?.summary) {
        return (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-6 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm text-[#64748B] dark:text-slate-400">
                    Could not load ABC analysis. Try again from Reports → Fast moving.
                </p>
                <button
                    type="button"
                    onClick={() =>
                        navigate({ to: '/app/analytics/fast-moving' as any, search: {} as any })
                    }
                    className="mt-3 text-xs font-bold text-[#2563EB] hover:underline dark:text-blue-300"
                >
                    Open analytics
                </button>
            </div>
        );
    }

    const s = data.summary;
    const chartData = [
        {
            key: 'A',
            name: 'Class A',
            label: 'Class A',
            short: 'A',
            value: s.classes.A.totalValue,
            items: s.classes.A.itemCount,
            pct: s.classes.A.percentage,
            fill: CLASS_COLORS.A,
        },
        {
            key: 'B',
            name: 'Class B',
            label: 'Class B',
            short: 'B',
            value: s.classes.B.totalValue,
            items: s.classes.B.itemCount,
            pct: s.classes.B.percentage,
            fill: CLASS_COLORS.B,
        },
        {
            key: 'C',
            name: 'Class C',
            label: 'Class C',
            short: 'C',
            value: s.classes.C.totalValue,
            items: s.classes.C.itemCount,
            pct: s.classes.C.percentage,
            fill: CLASS_COLORS.C,
        },
    ];


    return (
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3 dark:border-slate-700 sm:px-5 sm:py-4">
                <div className="flex min-w-0 items-start gap-2">
                    <div className="mt-0.5 rounded-lg bg-[#EFF6FF] p-1.5 dark:bg-blue-900/40">
                        <PieChartIcon size={18} className="text-[#2563EB] dark:text-blue-300" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight text-[#111827] dark:text-slate-100">
                            ABC — stock performance
                        </h3>
                        <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#64748B] dark:text-slate-400">
                            Consumption value by class (prioritize A items; tune C shelf space).
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() =>
                        navigate({ to: '/app/analytics/fast-moving' as any, search: {} as any })
                    }
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:underline dark:text-blue-300"
                >
                    Details <ArrowRight size={12} />
                </button>
            </div>

            <div className="relative min-h-[240px] flex-1 px-2 pb-1 pt-2 sm:px-4">
                <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                    <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="46%"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={2}
                            strokeWidth={1}
                            stroke="var(--pie-stroke, #fff)"
                        >
                            {chartData.map((entry) => (
                                <Cell key={entry.key} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => [formatMoney(Number(value ?? 0)), 'Consumption value']}
                            labelFormatter={(_, payload) => {
                                const p = payload?.[0]?.payload as (typeof chartData)[0] | undefined;
                                return p
                                    ? `${p.label} · ${p.items} SKUs · ${p.pct.toFixed(1)}% of total`
                                    : '';
                            }}
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid rgb(226 232 240)',
                                fontSize: '12px',
                            }}
                        />
                        <Legend verticalAlign="bottom" height={28} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] dark:text-slate-500">
                        Total value
                    </span>
                    <span className="text-sm font-black tabular-nums text-[#111827] dark:text-slate-100 sm:text-base">
                        {s.totalValue > 0 ? formatMoney(s.totalValue) : '—'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#E5E7EB] px-3 py-3 dark:border-slate-700 sm:px-4">
                {chartData.map((row) => (
                    <div
                        key={row.key}
                        className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-2 py-1.5 text-center dark:border-slate-700 dark:bg-slate-800/60"
                    >
                        <div
                            className="text-[10px] font-black uppercase tracking-wider"
                            style={{ color: row.fill }}
                        >
                            {row.key}
                        </div>
                        <div className="text-[11px] font-bold text-[#334155] dark:text-slate-200">
                            {row.items} items
                        </div>
                        <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                            {row.pct.toFixed(0)}% value
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
