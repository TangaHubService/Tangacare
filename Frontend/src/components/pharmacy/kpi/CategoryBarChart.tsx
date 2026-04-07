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
import { Layers } from 'lucide-react';
import type { CategorySummary } from '../../../types/pharmacy';

export const CategoryBarChart = ({ data }: { data: CategorySummary[] }) => {
    const COLORS = ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                        <Layers size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            Profit by Category
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Monthly Performance
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="category_name"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                            width={100}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '12px',
                                fontWeight: '700',
                            }}
                            formatter={(value: any) => [`RWF ${value.toLocaleString()}`, 'Profit']}
                        />
                        <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
