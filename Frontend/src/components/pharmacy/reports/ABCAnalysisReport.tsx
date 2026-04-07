import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function ABCAnalysisReport() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [data, setData] = useState<import('../../../types/pharmacy').ABCAnalysisData | null>(
        null,
    );
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (effectiveFacilityId) {
            loadAnalysis();
        }
    }, [effectiveFacilityId]);

    const loadAnalysis = async () => {
        if (!effectiveFacilityId) return;
        setLoading(true);
        try {
            const res = await pharmacyService.getABCAnalysis();
            setData(res);
        } catch (error) {
            console.error('Failed to load ABC analysis', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={2}
                headers={null}
                className="border-none shadow-none"
            />
        );
    if (!data) return null;

    const summary = data.summary;
    const chartData = [
        { name: 'Class A (High Value)', value: summary.classes.A.totalValue, color: '#059669' }, // Emerald-600
        { name: 'Class B (Moderate)', value: summary.classes.B.totalValue, color: '#d97706' }, // Amber-600
        { name: 'Class C (Low Value)', value: summary.classes.C.totalValue, color: '#ef4444' }, // Rose-500
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-full">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2 text-center uppercase text-xs tracking-widest">
                        Inventory Value Distribution
                    </h3>
                    <div className="flex-1 min-h-[300px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => [
                                        new Intl.NumberFormat('sw-TZ', {
                                            style: 'currency',
                                            currency: 'TZS',
                                        }).format(value),
                                        'Value',
                                    ]}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-sm text-slate-400 font-medium">Total Value</span>
                            <span className="text-xl font-black text-slate-800 dark:text-white">
                                {new Intl.NumberFormat('sw-TZ', {
                                    style: 'currency',
                                    currency: 'TZS',
                                    notation: 'compact',
                                    compactDisplay: 'short',
                                }).format(summary.totalValue)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                            <div>
                                <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                    Class A
                                </div>
                                <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">
                                    High Value (80%)
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-black text-emerald-700 dark:text-emerald-400">
                                    {summary.classes.A.itemCount} Items
                                </div>
                                <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">
                                    {summary.classes.A.percentage.toFixed(1)}% of Total
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                            <div>
                                <div className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                                    Class B
                                </div>
                                <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium">
                                    Moderate (15%)
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-black text-amber-700 dark:text-amber-400">
                                    {summary.classes.B.itemCount} Items
                                </div>
                                <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium">
                                    {summary.classes.B.percentage.toFixed(1)}% of Total
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20">
                            <div>
                                <div className="font-bold text-rose-700 dark:text-rose-400 text-sm">
                                    Class C
                                </div>
                                <div className="text-[10px] text-rose-600/70 dark:text-rose-400/70 font-medium">
                                    Low Value (5%)
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-black text-rose-700 dark:text-rose-400">
                                    {summary.classes.C.itemCount} Items
                                </div>
                                <div className="text-[10px] text-rose-600/70 dark:text-rose-400/70 font-medium">
                                    {summary.classes.C.percentage.toFixed(1)}% of Total
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-lg">
                                Top Class A Items
                            </h4>
                            <p className="text-slate-500 text-xs mt-1">
                                These items generate 80% of your consumption value. Monitor them
                                closely.
                            </p>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wide">
                            High Priority
                        </span>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="tc-table w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">
                                        Medicine
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-right">
                                        Consumption Value
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-right">
                                        Contribution
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.class_a.slice(0, 10).map((item, index) => (
                                    <tr
                                        key={item.medicine_id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold border border-emerald-100">
                                                    {index + 1}
                                                </div>
                                                <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 transition-colors">
                                                    {item.medicine_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-black text-slate-700 dark:text-white">
                                                {new Intl.NumberFormat('sw-TZ', {
                                                    style: 'currency',
                                                    currency: 'TZS',
                                                    maximumFractionDigits: 0,
                                                }).format(item.consumption_value)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap w-48">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-xs font-bold text-emerald-600">
                                                    {(
                                                        (item.consumption_value /
                                                            summary.totalValue) *
                                                        100
                                                    ).toFixed(1)}
                                                    %
                                                </div>
                                                <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-emerald-500 h-full rounded-full"
                                                        style={{
                                                            width: `${(item.consumption_value / summary.totalValue) * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
