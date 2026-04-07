import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Calendar } from 'lucide-react';
import { parseLocalDate } from '../../../lib/date';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

interface SalesTrendChartProps {
    data: Array<{ date: string; sales: number }>;
    title?: string;
}

export const SalesTrendChart = ({ data, title = '30-Day Sales Trend' }: SalesTrendChartProps) => {
    const { formatMoney, currencySymbol } = useRuntimeConfig();
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {title}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Daily Revenue Pattern
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                            tickFormatter={(str) => {
                                const date = parseLocalDate(str);
                                return date.toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                });
                            }}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                            tickFormatter={(value) =>
                                `${currencySymbol} ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`
                            }
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '12px',
                                fontWeight: '700',
                            }}
                            formatter={(value: any) => [formatMoney(value), 'Revenue']}
                            labelFormatter={(label) =>
                                parseLocalDate(label).toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })
                            }
                        />
                        <Line
                            type="monotone"
                            dataKey="sales"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
