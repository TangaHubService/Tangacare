import { useState, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    ArrowDownCircle,
    ArrowUpCircle,
    Repeat,
    Edit3,
    FileText,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { getStockMovementLabel } from '../../lib/stockMovement';
import { formatLocalDateTime } from '../../lib/date';

export function StockRegisterReportPage() {
    const { user, facilityId } = useAuth();
    const fid = facilityId ?? user?.facility_id;
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!fid) {
            setLoading(false);
            setData([]);
            setTotal(0);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        pharmacyService
            .getStockRegisterReport({
                facilityId: fid,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                page,
                limit,
            })
            .then((res) => {
                if (!cancelled) {
                    setData(res.data);
                    setTotal(res.total);
                }
            })
            .catch((err) => {
                if (!cancelled)
                    setError(err?.response?.data?.message || 'Failed to load stock register');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [fid, startDate, endDate, page, limit]);

    const totalPages = Math.ceil(total / limit) || 1;

    return (
        <ProtectedRoute
            allowedRoles={[
                'SUPER_ADMIN',
                'FACILITY_ADMIN',
                'OWNER',
                'AUDITOR',
                'PHARMACIST',
                'STORE_MANAGER',
                'ADMIN',
            ]}
            requireFacility
        >
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-healthcare-dark tracking-tight flex items-center gap-2">
                            <FileText size={28} className="text-healthcare-primary" />
                            Stock Register Report
                        </h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                            Transaction-level movement history for inspection
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to="/app/analytics"
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Back to Reports
                        </Link>
                        <button className="px-5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-healthcare-primary rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-2">
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold"
                    />
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {!fid && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-sm">
                        Select a facility to view the stock register.
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-2 border-healthcare-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <table className="tc-table w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="p-4 font-black text-healthcare-dark uppercase text-xs text-left">
                                            Date
                                        </th>
                                        <th className="p-4 font-black text-healthcare-dark uppercase text-xs text-left">
                                            Type
                                        </th>
                                        <th className="p-4 font-black text-healthcare-dark uppercase text-xs text-left">
                                            Reference
                                        </th>
                                        <th className="p-4 font-black text-healthcare-dark uppercase text-xs text-left">
                                            User
                                        </th>
                                        <th className="p-4 font-black text-healthcare-dark uppercase text-xs text-left">
                                            Description
                                        </th>
                                        <th className="p-4 font-black text-healthcare-dark uppercase text-xs text-right">
                                            Qty Δ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {row.created_at
                                                    ? formatLocalDateTime(row.created_at)
                                                    : '—'}
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center gap-1 font-bold uppercase text-xs">
                                                    {row.movement_type === 'dispense' && (
                                                        <ArrowDownCircle
                                                            size={14}
                                                            className="text-teal-500"
                                                        />
                                                    )}
                                                    {row.movement_type === 'receive' && (
                                                        <ArrowUpCircle
                                                            size={14}
                                                            className="text-blue-500"
                                                        />
                                                    )}
                                                    {row.movement_type === 'transfer' && (
                                                        <Repeat
                                                            size={14}
                                                            className="text-amber-500"
                                                        />
                                                    )}
                                                    {row.movement_type === 'adjustment' && (
                                                        <Edit3
                                                            size={14}
                                                            className="text-indigo-500"
                                                        />
                                                    )}
                                                    {getStockMovementLabel(row.movement_type)}
                                                </span>
                                            </td>
                                            <td className="p-4 font-medium text-healthcare-dark">
                                                {row.reference || '—'}
                                            </td>
                                            <td className="p-4 text-slate-600 dark:text-slate-400">
                                                {row.user_name || '—'}
                                            </td>
                                            <td className="p-4 text-slate-500 max-w-xs truncate">
                                                {row.description || '—'}
                                            </td>
                                            <td className="p-4 text-right font-bold">
                                                {row.quantity_delta != null ? (
                                                    row.quantity_delta >= 0 ? (
                                                        <span className="text-teal-600 dark:text-teal-400">
                                                            +{row.quantity_delta}
                                                        </span>
                                                    ) : (
                                                        <span className="text-rose-600 dark:text-rose-400">
                                                            {row.quantity_delta}
                                                        </span>
                                                    )
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {total === 0 && !loading && fid && (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                No movements in this period.
                            </div>
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4">
                                <span className="text-xs text-slate-500">
                                    Page {page} of {totalPages} ({total} total)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
