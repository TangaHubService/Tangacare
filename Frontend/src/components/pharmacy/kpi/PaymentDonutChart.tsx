import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CreditCard } from 'lucide-react';
import type { PaymentBreakdown } from '../../../types/pharmacy';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

export const PaymentDonutChart = ({ data }: { data: PaymentBreakdown[] }) => {
    const { formatMoney } = useRuntimeConfig();
    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <CreditCard size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            Payment Mix
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Settlement Methods
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="total_amount"
                            nameKey="payment_method"
                        >
                            {data.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    stroke="none"
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '11px',
                                fontWeight: '700',
                            }}
                            formatter={(value: any) => [formatMoney(value), 'Total']}
                        />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            formatter={(value) => (
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    {value}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
