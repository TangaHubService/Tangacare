import { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';

interface FastSlowMovingReportProps {
    facilityId?: number;
}

type VelocitySegment = 'fast' | 'medium' | 'slow' | 'dead';

const SEGMENT_LABEL: Record<VelocitySegment, string> = {
    fast: 'Fast',
    medium: 'Medium',
    slow: 'Slow',
    dead: 'Dead',
};

const SEGMENT_CLASS: Record<VelocitySegment, string> = {
    fast: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-blue-50 text-blue-700 border-blue-200',
    slow: 'bg-amber-50 text-amber-700 border-amber-200',
    dead: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function FastSlowMovingReport({ facilityId }: FastSlowMovingReportProps) {
    const [days, setDays] = useState(90);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const result = await pharmacyService.getVelocitySegmentation({ facilityId, days });
                setData(result);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, days]);

    const rows = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

    if (!facilityId) {
        return <div className="text-sm text-slate-500">Select a facility to view this report.</div>;
    }

    if (loading) {
        return (
            <SkeletonTable
                rows={8}
                columns={6}
                headers={['Medicine', 'Segment', 'Demand', 'Velocity', 'Days Cover', 'Action']}
                className="border-none shadow-none"
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-healthcare-primary" />
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        Fast / Slow Moving Analysis
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {[30, 60, 90, 180].map((option) => (
                        <button
                            key={option}
                            onClick={() => setDays(option)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                                days === option
                                    ? 'bg-healthcare-primary text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                        >
                            {option}d
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['fast', 'medium', 'slow', 'dead'] as VelocitySegment[]).map((segment) => (
                    <div
                        key={segment}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                        <p className="text-[10px] font-black uppercase text-slate-400">
                            {SEGMENT_LABEL[segment]}
                        </p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-100">
                            {Number(data?.summary?.[segment] || 0)}
                        </p>
                    </div>
                ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="tc-table w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 text-left font-black">Medicine</th>
                            <th className="px-4 py-3 text-left font-black">Segment</th>
                            <th className="px-4 py-3 text-right font-black">Demand</th>
                            <th className="px-4 py-3 text-right font-black">Velocity/day</th>
                            <th className="px-4 py-3 text-right font-black">Days Cover</th>
                            <th className="px-4 py-3 text-left font-black">Suggested Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((item: any) => (
                            <tr key={item.medicine_id}>
                                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                    {item.medicine_name}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex px-2 py-1 rounded-full border text-[10px] font-black uppercase ${SEGMENT_CLASS[item.segment as VelocitySegment]}`}
                                    >
                                        {SEGMENT_LABEL[item.segment as VelocitySegment] ||
                                            item.segment}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.total_demand || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.daily_velocity || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.days_of_cover || 0).toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                    {item.suggested_action}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                    No movement data available for this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
