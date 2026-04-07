import { useEffect, useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';

interface DemandForecastReportProps {
    facilityId?: number;
}

const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DemandForecastReport({ facilityId }: DemandForecastReportProps) {
    const [horizonDays, setHorizonDays] = useState(30);
    const [historyDays, setHistoryDays] = useState(180);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const result = await pharmacyService.getDemandForecast({
                    facilityId,
                    horizon_days: horizonDays,
                    history_days: historyDays,
                });
                setData(result);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, horizonDays, historyDays]);

    const rows = useMemo(() => (Array.isArray(data?.medicines) ? data.medicines : []), [data]);

    if (!facilityId) {
        return <div className="text-sm text-slate-500">Select a facility to view this report.</div>;
    }

    if (loading) {
        return (
            <SkeletonTable
                rows={8}
                columns={8}
                headers={[
                    'Medicine',
                    'Stock',
                    'Historical Daily',
                    'Forecast',
                    'Trend',
                    'Season Peak',
                    'Confidence',
                    'MAPE',
                ]}
                className="border-none shadow-none"
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <LineChart size={16} className="text-healthcare-primary" />
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        Demand Forecast & Seasonality
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={String(horizonDays)}
                        onChange={(e) => setHorizonDays(Number(e.target.value))}
                        className="px-2 py-1 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                        <option value="14">Horizon: 14d</option>
                        <option value="30">Horizon: 30d</option>
                        <option value="60">Horizon: 60d</option>
                    </select>
                    <select
                        value={String(historyDays)}
                        onChange={(e) => setHistoryDays(Number(e.target.value))}
                        className="px-2 py-1 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                        <option value="90">History: 90d</option>
                        <option value="180">History: 180d</option>
                        <option value="365">History: 365d</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="tc-table w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 text-left font-black">Medicine</th>
                            <th className="px-4 py-3 text-right font-black">Stock</th>
                            <th className="px-4 py-3 text-right font-black">Historical/day</th>
                            <th className="px-4 py-3 text-right font-black">Forecast</th>
                            <th className="px-4 py-3 text-center font-black">Trend</th>
                            <th className="px-4 py-3 text-center font-black">Peak Day</th>
                            <th className="px-4 py-3 text-right font-black">Confidence</th>
                            <th className="px-4 py-3 text-right font-black">MAPE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((item: any) => (
                            <tr key={item.medicine_id}>
                                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                    {item.medicine_name}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.current_stock || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.historical_daily_average || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-healthcare-primary">
                                    {Number(item.forecast_total || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span
                                        className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                            item.trend_direction === 'up'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : item.trend_direction === 'down'
                                                  ? 'bg-rose-50 text-rose-700'
                                                  : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {String(item.trend_direction || 'stable')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {WEEKDAY_LABEL[Number(item.peak_weekday ?? 0)] || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(item.confidence_score || 0).toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {item.mape_estimate === null || item.mape_estimate === undefined
                                        ? 'N/A'
                                        : `${Number(item.mape_estimate).toFixed(1)}%`}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                    No forecast data available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
