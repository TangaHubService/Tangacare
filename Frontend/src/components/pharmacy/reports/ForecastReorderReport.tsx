import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';

interface ForecastReorderReportProps {
    facilityId?: number;
}

export function ForecastReorderReport({ facilityId }: ForecastReorderReportProps) {
    const [horizonDays, setHorizonDays] = useState(30);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const result = await pharmacyService.getSmartReorderPlan({
                    facilityId,
                    horizon_days: horizonDays,
                });
                setData(result);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, horizonDays]);

    const rows = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

    if (!facilityId) {
        return <div className="text-sm text-slate-500">Select a facility to view this report.</div>;
    }

    if (loading) {
        return (
            <SkeletonTable
                rows={8}
                columns={10}
                headers={[
                    'Medicine',
                    'Usable',
                    'Demand',
                    'Safety',
                    'Target',
                    'Order Qty',
                    'Lead Time',
                    'JIT Date',
                    'Priority',
                    'Reason',
                ]}
                className="border-none shadow-none"
            />
        );
    }

    const criticalCount = rows.filter((item: any) =>
        ['critical', 'high'].includes(String(item.priority)),
    ).length;
    const totalOrderQty = rows.reduce(
        (sum: number, item: any) => sum + Number(item.recommended_order_qty || 0),
        0,
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ShoppingCart size={16} className="text-healthcare-primary" />
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        Forecast Reorder (JIT)
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {[14, 30, 60].map((option) => (
                        <button
                            key={option}
                            onClick={() => setHorizonDays(option)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                                horizonDays === option
                                    ? 'bg-healthcare-primary text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                        >
                            {option}d
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">
                        Critical / High
                    </p>
                    <p className="text-lg font-black text-rose-600">{criticalCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Order Lines</p>
                    <p className="text-lg font-black text-slate-700 dark:text-slate-100">
                        {rows.length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">
                        Total Order Qty
                    </p>
                    <p className="text-lg font-black text-healthcare-primary">
                        {totalOrderQty.toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="tc-table w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 text-left font-black">Medicine</th>
                            <th className="px-4 py-3 text-right font-black">Usable</th>
                            <th className="px-4 py-3 text-right font-black">Demand</th>
                            <th className="px-4 py-3 text-right font-black">Safety</th>
                            <th className="px-4 py-3 text-right font-black">Target</th>
                            <th className="px-4 py-3 text-right font-black">Order Qty</th>
                            <th className="px-4 py-3 text-right font-black">Lead Time</th>
                            <th className="px-4 py-3 text-center font-black">JIT Reorder By</th>
                            <th className="px-4 py-3 text-left font-black">Priority</th>
                            <th className="px-4 py-3 text-left font-black">Reason</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((item: any) => (
                            <tr key={item.medicine_id}>
                                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                    {item.medicine_name}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.usable_stock || 0).toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.forecast_horizon_demand || 0).toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.safety_stock || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.target_stock || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-healthcare-primary">
                                    {Number(item.recommended_order_qty || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.lead_time_days || 0)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {item.jit_reorder_by_date || 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                            item.priority === 'critical'
                                                ? 'bg-rose-50 text-rose-700'
                                                : item.priority === 'high'
                                                  ? 'bg-amber-50 text-amber-700'
                                                  : item.priority === 'medium'
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {String(item.priority || 'low')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{item.reason}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                                    No reorder lines generated for the current horizon.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
