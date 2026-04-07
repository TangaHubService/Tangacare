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

interface Performer {
    employee_id: number;
    employee_name: string;
    total_sales: number;
    transaction_count: number;
    average_transaction_value: number;
}

interface PerformanceChartProps {
    data: Performer[];
    title?: string;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const PerformanceChart = ({
    data,
    title = 'Employee Sales Performance',
}: PerformanceChartProps) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            </div>
            <div className="p-6">
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#e2e8f0"
                            />
                            <XAxis
                                dataKey="employee_name"
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                interval={0}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(value) => `RWF ${value.toLocaleString()}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '12px',
                                }}
                                formatter={(value: any) => [
                                    `RWF ${Number(value || 0).toLocaleString()}`,
                                    'Total Sales',
                                ]}
                            />
                            <Bar dataKey="total_sales" radius={[4, 4, 0, 0]}>
                                {data.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
