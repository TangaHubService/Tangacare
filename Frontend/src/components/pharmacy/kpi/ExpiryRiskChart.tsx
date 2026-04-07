import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import type { ExpiryRiskBuckets } from '../../../types/pharmacy';

const ExpiryRiskChart = ({ data }: { data: ExpiryRiskBuckets }) => {
    const chartData = [
        {
            label: '< 30 Days',
            value: data.under_30_days.value,
            count: data.under_30_days.count,
            color: '#ef4444',
        },
        {
            label: '< 60 Days',
            value: data.under_60_days.value,
            count: data.under_60_days.count,
            color: '#f59e0b',
        },
        {
            label: '< 90 Days',
            value: data.under_90_days.value,
            count: data.under_90_days.count,
            color: '#3b82f6',
        },
    ];

    const totalAtRisk = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                        <AlertCircle size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            Expiry Risk Value
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Inventory Loss Prevention
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        Total at Risk
                    </p>
                    <p className="text-sm font-black text-rose-600">
                        RWF {totalAtRisk.toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                        />
                        <YAxis hide />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '11px',
                                fontWeight: '700',
                            }}
                            formatter={(value: any) => [
                                `RWF ${value.toLocaleString()}`,
                                'Risk Value',
                            ]}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
                {chartData.map((item) => (
                    <div
                        key={item.label}
                        className="text-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                    >
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1">
                            {item.label}
                        </p>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {item.count} Batches
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExpiryRiskChart;
