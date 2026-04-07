import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';

interface NearExpiryActionsReportProps {
    facilityId?: number;
    /** Look-ahead window in days (controlled from Reports toolbar). */
    horizonDays?: number;
}

export function NearExpiryActionsReport({
    facilityId,
    horizonDays: horizonDaysProp = 90,
}: NearExpiryActionsReportProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const result = await pharmacyService.getNearExpiryActions({
                    facilityId,
                    horizon_days: horizonDaysProp,
                });
                setData(result);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, horizonDaysProp]);

    const rows = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

    if (!facilityId) {
        return <div className="text-sm text-slate-500">Select a facility to view this report.</div>;
    }

    if (loading) {
        return (
            <SkeletonTable
                rows={8}
                columns={8}
                headers={['Medicine', 'Batch', 'Days', 'Qty', 'Risk', 'Action', 'Reason', 'Value']}
                className="border-none shadow-none"
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500" />
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Near-Expiry Action Plan
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ({horizonDaysProp}d horizon)
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['markdown', 'transfer', 'vendor_return', 'disposal', 'monitor'].map(
                    (actionType) => (
                        <div key={actionType} className="tc-stat-card tc-stat-card-neutral">
                            <div className="tc-stat-card-header">
                                <p className="tc-stat-card-title">{actionType.replace('_', ' ')}</p>
                                <span className="tc-stat-card-icon bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                                    <AlertTriangle size={13} />
                                </span>
                            </div>
                            <div className="tc-stat-card-foot">
                                <p className="tc-stat-card-value">
                                    {Number(data?.summary?.[actionType] || 0).toLocaleString()}
                                </p>
                                <p className="tc-stat-card-subtitle">Actions</p>
                            </div>
                        </div>
                    ),
                )}
            </div>

            <div className="tc-table-surface">
                <div className="tc-table-scroll">
                    <table className="tc-table w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                                <th className="px-4 py-3 text-left font-black">Medicine</th>
                                <th className="px-4 py-3 text-left font-black">Batch</th>
                                <th className="px-4 py-3 text-right font-black">Days</th>
                                <th className="px-4 py-3 text-right font-black">Qty</th>
                                <th className="px-4 py-3 text-left font-black">Risk</th>
                                <th className="px-4 py-3 text-left font-black">Action</th>
                                <th className="px-4 py-3 text-left font-black">Reason</th>
                                <th className="px-4 py-3 text-right font-black">Risk Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.map((item: any) => (
                                <tr key={item.stock_id}>
                                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                        {item.medicine_name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                        {item.batch_number}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {Number(item.days_to_expiry || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {Number(item.quantity || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700">
                                            {String(item.risk_level || 'low')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                                        {String(item.recommended_action || '').replace('_', ' ')}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {item.action_reason}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold">
                                        RWF {Number(item.risk_value || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-4 py-8 text-center text-slate-500"
                                    >
                                        No near-expiry action candidates found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
