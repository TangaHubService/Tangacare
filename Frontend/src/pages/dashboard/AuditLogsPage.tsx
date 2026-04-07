import { useState, useEffect } from 'react';
import { Clock, User, Download, Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { PERMISSIONS } from '../../types/auth';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { useSearch } from '@tanstack/react-router';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { formatLocalDate, parseLocalDate } from '../../lib/date';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
    facility: 'Facilities',
    department: 'Departments',
    medicine: 'Medicines',
    batch: 'Batches',
    stock: 'Stock',
    supplier: 'Suppliers',
    purchase_order: 'Procurement',
    dispense_transaction: 'Dispensing',
    stock_transfer: 'Transfers',
    alert: 'Alerts',
    user: 'Users',
};

function formatImpact(action: string): 'Low' | 'Medium' | 'High' {
    const high = ['create', 'delete', 'update'];
    const medium = ['transfer', 'adjustment', 'receive'];
    if (high.includes(action?.toLowerCase())) return 'High';
    if (medium.includes(action?.toLowerCase())) return 'Medium';
    return 'Low';
}

export function AuditLogsPage() {
    const { user, facilityId } = useAuth();
    const searchParams = useSearch({ strict: false }) as any;
    const [searchQuery, setSearchQuery] = useState(searchParams.search || '');
    const [entityType, setEntityType] = useState<string>('');
    const [action, setAction] = useState<string>('');
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [logs, setLogs] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fid = facilityId ?? user?.facility_id ?? undefined;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        pharmacyService
            .getAuditLogs({
                facilityId: fid,
                entityType: entityType || undefined,
                action: action || undefined,
                page,
                limit,
            })
            .then((res) => {
                if (!cancelled) {
                    setLogs(res.data);
                    setTotal(res.total);
                }
            })
            .catch((err) => {
                if (!cancelled)
                    setError(err?.response?.data?.message || 'Failed to load audit logs');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [fid, entityType, action, page, limit]);

    const filteredLogs = logs.filter((log) => {
        if (!searchQuery) return true;
        const userLabel = log.user
            ? `${(log.user as any).first_name || ''} ${(log.user as any).last_name || ''}`.trim() ||
              (log.user as any).email ||
              ''
            : '';
        const details = log.description || log.entity_name || '';
        return (
            userLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
            details.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.action || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return (
        <ProtectedRoute requiredPermissions={[PERMISSIONS.AUDIT_READ]} requireFacility>
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-healthcare-dark tracking-tight">
                            Audit Trails & Activity Logs
                        </h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                            Immutable Governance & Compliance History
                        </p>
                    </div>
                    <button className="px-5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-healthcare-primary rounded-xl font-black text-xs transition-all shadow-sm active:scale-[0.98] flex items-center gap-2">
                        <Download size={16} /> Export CSV Report
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between flex-wrap">
                    <div className="relative flex-1 max-w-lg">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search by user, action or details..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:border-healthcare-primary transition-all text-sm font-bold shadow-sm"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <select
                            value={entityType}
                            onChange={(e) => setEntityType(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold"
                        >
                            <option value="">All modules</option>
                            {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                        <select
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold"
                        >
                            <option value="">All actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="dispense">Dispense</option>
                            <option value="receive">Receive</option>
                            <option value="transfer">Transfer</option>
                            <option value="adjustment">Adjustment</option>
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <SkeletonTable
                        rows={limit}
                        columns={6}
                        headers={['Date', 'User', 'Action', 'Module', 'Details', 'Impact']}
                    />
                ) : (
                    <>
                        <div className="glass-card bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="tc-table w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Timestamp
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                User
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Action / Method
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Module
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Details
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                                                Impact
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredLogs.map((log) => {
                                            const userLabel = log.user
                                                ? `${(log.user as any).first_name || ''} ${(log.user as any).last_name || ''}`.trim() ||
                                                  (log.user as any).email ||
                                                  '—'
                                                : '—';
                                            const roleLabel = (log.user as any)?.role
                                                ? String((log.user as any).role || '').replace(
                                                      /_/g,
                                                      ' ',
                                                  )
                                                : '—';
                                            const moduleLabel =
                                                ENTITY_TYPE_LABELS[log.entity_type] ||
                                                log.entity_type ||
                                                '—';
                                            const impact = formatImpact(log.action);
                                            return (
                                                <tr
                                                    key={log.id}
                                                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 text-slate-500">
                                                            <Clock
                                                                size={14}
                                                                className="text-slate-400"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-healthcare-dark">
                                                                    {log.created_at
                                                                        ? formatLocalDate(log.created_at)
                                                                        : '—'}
                                                                </span>
                                                                <span className="text-[10px] font-medium text-slate-400">
                                                                    {log.created_at
                                                                        ? parseLocalDate(log.created_at).toLocaleTimeString()
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                                                <User size={16} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-healthcare-dark">
                                                                    {userLabel}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    {roleLabel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-black text-healthcare-primary uppercase">
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className={cn(
                                                                    'w-2 h-2 rounded-full',
                                                                    moduleLabel === 'Facilities'
                                                                        ? 'bg-blue-500'
                                                                        : moduleLabel ===
                                                                            'Dispensing'
                                                                          ? 'bg-teal-500'
                                                                          : moduleLabel === 'Stock'
                                                                            ? 'bg-indigo-500'
                                                                            : moduleLabel ===
                                                                                'Procurement'
                                                                              ? 'bg-amber-500'
                                                                              : 'bg-rose-500',
                                                                )}
                                                            />
                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                                {moduleLabel}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p
                                                            className="text-xs text-slate-500 font-medium max-w-xs truncate"
                                                            title={
                                                                log.description || log.entity_name
                                                            }
                                                        >
                                                            {log.description ||
                                                                log.entity_name ||
                                                                `Entity #${log.entity_id}`}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span
                                                            className={cn(
                                                                'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                                                                impact === 'High'
                                                                    ? 'bg-rose-50 text-rose-600'
                                                                    : impact === 'Medium'
                                                                      ? 'bg-amber-50 text-amber-600'
                                                                      : 'bg-teal-50 text-teal-600',
                                                            )}
                                                        >
                                                            {impact}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-healthcare-primary transition-colors">
                                                            <Eye size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {total === 0 && !loading && (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                No audit logs found. {!fid && 'Select a facility to see logs.'}
                            </div>
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4">
                                <span className="text-xs text-slate-500 font-bold">
                                    Displaying {filteredLogs.length} of {total} entries
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        className="p-2 rounded-xl border-2 border-slate-100 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="flex items-center gap-1 mx-2">
                                        <span className="text-xs font-black text-healthcare-dark">
                                            {page}
                                        </span>
                                        <span className="text-xs text-slate-400">/</span>
                                        <span className="text-xs font-bold text-slate-500">
                                            {totalPages}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className="p-2 rounded-xl border-2 border-slate-100 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                    >
                                        <ChevronRight size={16} />
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
