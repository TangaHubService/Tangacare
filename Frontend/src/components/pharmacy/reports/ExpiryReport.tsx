import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Clock,
    AlertTriangle,
    CheckCircle,
    Search,
    FileText,
    History,
    RotateCcw,
} from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { cn } from '../../../lib/utils';
import { formatLocalDate } from '../../../lib/date';

type ExpiryRisk = 'critical' | 'warning' | 'watch' | 'expired';

interface ExpiryItem {
    batch_id: number;
    batch_number: string;
    medicine_name: string;
    expiry_date: string;
    days_until_expiry?: number;
    quantity: number;
    risk_level?: ExpiryRisk;
    recommended_action?: string;
}

interface ExpiryData {
    expiring_soon: ExpiryItem[];
    expired: ExpiryItem[];
}

interface ExpiryRow extends ExpiryItem {
    status: 'expiring_soon' | 'expired';
}

const getRiskBadge = (risk: ExpiryRisk) => {
    if (risk === 'expired') {
        return {
            label: 'Expired',
            className:
                'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/30',
        };
    }

    if (risk === 'critical') {
        return {
            label: 'Critical',
            className:
                'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/30',
        };
    }

    if (risk === 'warning') {
        return {
            label: 'Warning',
            className:
                'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30',
        };
    }

    return {
        label: 'Watch',
        className:
            'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-900/30',
    };
};

const resolveRisk = (item: ExpiryRow): ExpiryRisk => {
    if (item.status === 'expired') return 'expired';
    if (item.risk_level) return item.risk_level;

    const daysLeft = Number(item.days_until_expiry ?? 999);
    if (daysLeft <= 7) return 'critical';
    if (daysLeft <= 30) return 'warning';
    return 'watch';
};

const resolveAction = (item: ExpiryRow): string => {
    if (item.recommended_action) return item.recommended_action;

    const risk = resolveRisk(item);
    if (risk === 'expired') {
        return 'Stop dispensing now, quarantine and complete disposal/return documentation.';
    }
    if (risk === 'critical') {
        return 'Prioritize sell-through or transfer immediately.';
    }
    if (risk === 'warning') {
        return 'Plan markdown or transfer before expiry window tightens.';
    }
    return 'Monitor weekly and keep FEFO rotation active.';
};

interface ExpiryReportProps {
    facilityId?: number;
    /** Expiry window in days (controlled from Reports page toolbar). */
    selectedDays?: number;
}

export function ExpiryReport({ facilityId, selectedDays }: ExpiryReportProps) {
    const [localDays, setLocalDays] = useState(30);
    const [reloadKey, setReloadKey] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ExpiryData | null>(null);
    const [search, setSearch] = useState('');
    const [showTraceability, setShowTraceability] = useState(false);
    const [traceBatchId, setTraceBatchId] = useState('');
    const [traceResult, setTraceResult] = useState<any | null>(null);
    const [traceLoading, setTraceLoading] = useState(false);
    const days = localDays;

    useEffect(() => {
        if (selectedDays != null && selectedDays !== localDays) {
            setLocalDays(selectedDays);
        }
    }, [selectedDays, localDays]);

    useEffect(() => {
        if (!facilityId) return;
        let isCurrent = true;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const fId = Number(facilityId);
                if (isNaN(fId)) throw new Error(`Invalid Facility ID: ${facilityId}`);

                const res = await pharmacyService.getExpiryReport(fId, { days });
                if (!res || typeof res !== 'object') {
                    throw new Error('Invalid response format from server');
                }

                if (!isCurrent) return;
                setData(res);
            } catch (err: any) {
                if (!isCurrent) return;
                setError(err?.message || 'Failed to connect to reporting service');
            } finally {
                if (!isCurrent) return;
                setLoading(false);
            }
        };

        load();
        return () => {
            isCurrent = false;
        };
    }, [facilityId, days, reloadKey]);

    const handleTrace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!traceBatchId) return;

        setTraceLoading(true);
        try {
            const res = await pharmacyService.getBatchTraceability(Number(traceBatchId));
            setTraceResult(res);
        } catch {
            setTraceResult(null);
        } finally {
            setTraceLoading(false);
        }
    };

    const allRows = useMemo<ExpiryRow[]>(() => {
        const expiring = (data?.expiring_soon || []).map((item) => ({
            ...item,
            status: 'expiring_soon' as const,
        }));

        const expired = (data?.expired || []).map((item) => ({
            ...item,
            status: 'expired' as const,
            days_until_expiry: item.days_until_expiry ?? -1,
        }));

        return [...expired, ...expiring].sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === 'expired' ? -1 : 1;
            }

            const aDays = Number(a.days_until_expiry ?? 999);
            const bDays = Number(b.days_until_expiry ?? 999);
            return aDays - bDays;
        });
    }, [data]);

    const filteredItems = useMemo(
        () =>
            allRows.filter(
                (item) =>
                    item.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
                    item.batch_number.toLowerCase().includes(search.toLowerCase()),
            ),
        [allRows, search],
    );

    const expiredCount = allRows.filter((row) => row.status === 'expired').length;
    const criticalCount = allRows.filter((row) => {
        const risk = resolveRisk(row);
        return risk === 'critical' || risk === 'expired';
    }).length;

    if (facilityId === undefined || facilityId === null) {
        return (
            <div className="p-12 text-center bg-amber-50 dark:bg-amber-900/10 rounded-[32px] border border-amber-100 dark:border-amber-900/20">
                <AlertTriangle className="mx-auto text-amber-500 mb-4" size={32} />
                <h3 className="text-lg font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">
                    Detecting Facility...
                </h3>
                <p className="text-amber-700 dark:text-amber-400 text-xs font-bold mt-2 uppercase tracking-widest">
                    We are waiting for your facility authorization. If this persists, please
                    re-select your facility.
                </p>
                <div className="mt-8 pt-6 border-t border-amber-100/50">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                    >
                        Refresh Session
                    </button>
                </div>
            </div>
        );
    }

    if (loading && !data) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-8">
                    <div className="h-6 w-56 bg-slate-200 animate-pulse rounded"></div>
                </div>
                <SkeletonTable
                    rows={10}
                    columns={7}
                    headers={['Medicine', 'Batch', 'Expiry', 'Days Left', 'Qty', 'Risk', 'Action']}
                    columnAligns={['left', 'left', 'left', 'left', 'right', 'left', 'left']}
                    actions
                    className="border-none shadow-none"
                />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 text-center bg-rose-50 dark:bg-rose-900/10 rounded-[32px] border border-rose-100 dark:border-rose-900/20">
                <AlertCircle className="mx-auto text-rose-500 mb-4" size={32} />
                <h3 className="text-lg font-black text-rose-900 dark:text-rose-100 uppercase tracking-tight">
                    Report Load Failed
                </h3>
                <p className="text-rose-700 dark:text-rose-400 text-xs font-bold mt-2 uppercase">
                    {error}
                </p>
                <button
                    onClick={() => setReloadKey((prev) => prev + 1)}
                    className="mt-6 px-6 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-healthcare-dark dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Clock className="text-rose-500 shrink-0" />
                    Expiry Risk Analysis
                </h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    ({days}d window)
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#EF4444] to-[#DC2626]">
                    <div className="tc-stat-card-header">
                        <p className="tc-stat-card-title text-white/90">Expired items</p>
                        <span className="tc-stat-card-icon bg-white/20">
                            <AlertCircle size={15} />
                        </span>
                    </div>
                    <div className="tc-stat-card-foot">
                        <p className="tc-stat-card-value">{expiredCount.toLocaleString()}</p>
                        <p className="tc-stat-card-subtitle">Compliance</p>
                    </div>
                </div>

                <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#F59E0B] to-[#D97706]">
                    <div className="tc-stat-card-header">
                        <p className="tc-stat-card-title text-white/90">Critical risk</p>
                        <span className="tc-stat-card-icon bg-white/20">
                            <AlertTriangle size={15} />
                        </span>
                    </div>
                    <div className="tc-stat-card-foot">
                        <p className="tc-stat-card-value">{criticalCount.toLocaleString()}</p>
                        <p className="tc-stat-card-subtitle">Urgent</p>
                    </div>
                </div>

                <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#2563EB] to-[#1D4ED8]">
                    <div className="tc-stat-card-header">
                        <p className="tc-stat-card-title text-white/90">Total in window</p>
                        <span className="tc-stat-card-icon bg-white/20">
                            <History size={15} />
                        </span>
                    </div>
                    <div className="tc-stat-card-foot">
                        <p className="tc-stat-card-value">{allRows.length.toLocaleString()}</p>
                        <p className="tc-stat-card-subtitle">Monitoring</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                    />
                    <input
                        type="text"
                        placeholder="Search medicine or batch..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] font-bold tracking-wide outline-none focus:ring-2 focus:ring-healthcare-primary/20 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowTraceability(!showTraceability)}
                    className={cn(
                        'px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2',
                        showTraceability
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            : 'bg-healthcare-dark dark:bg-slate-800 text-white hover:bg-black',
                    )}
                >
                    <RotateCcw size={14} />{' '}
                    {showTraceability ? 'Hide Traceability' : 'Batch Traceability'}
                </button>
            </div>

            {showTraceability && (
                <div className="bg-rose-50 dark:bg-rose-900/20 p-8 rounded-[32px] border border-rose-100 dark:border-rose-800/50 animate-in zoom-in-95 duration-300">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <h4 className="text-rose-900 dark:text-rose-100 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                                <FileText size={18} /> Recall & Trace Mode
                            </h4>
                            <p className="text-rose-700 dark:text-rose-300 text-[10px] font-bold mt-1 max-w-sm">
                                Enter a Batch ID to retrieve a full list of transactions and
                                dispensed units for patient notifications.
                            </p>
                        </div>
                        <form onSubmit={handleTrace} className="flex gap-2 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="BATCH SYSTEM ID"
                                className="flex-1 md:w-64 px-5 py-3 rounded-2xl border border-rose-200 dark:border-rose-700 bg-white dark:bg-slate-800 text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-rose-500/20"
                                value={traceBatchId}
                                onChange={(e) => setTraceBatchId(e.target.value)}
                            />
                            <button className="px-8 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all">
                                START TRACE
                            </button>
                        </form>
                    </div>

                    {traceLoading ? (
                        <SkeletonTable
                            rows={3}
                            columns={4}
                            headers={null}
                            className="border-none shadow-none"
                        />
                    ) : (
                        traceResult && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                        Target Medicine
                                    </p>
                                    <p className="font-black text-sm text-rose-900 dark:text-rose-100 mt-1">
                                        {traceResult.medicine_name}
                                    </p>
                                </div>
                                <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                        Batch Reference
                                    </p>
                                    <p className="font-black text-sm text-healthcare-primary mt-1">
                                        #{traceResult.batch_number}
                                    </p>
                                </div>
                                <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                        Expiration Date
                                    </p>
                                    <p className="font-black text-sm text-rose-600 mt-1">
                                        {formatLocalDate(traceResult.expiry_date)}
                                    </p>
                                </div>
                                <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                        Units to Recall
                                    </p>
                                    <p className="font-black text-sm text-slate-800 dark:text-white mt-1">
                                        {traceResult.total_dispensed} Units
                                    </p>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}

            <div className="tc-table-surface">
                <div className="tc-table-scroll">
                    <table className="tc-table w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 whitespace-nowrap">Medicine</th>
                                <th className="px-6 py-4 whitespace-nowrap">Batch</th>
                                <th className="px-6 py-4 whitespace-nowrap">Expiry</th>
                                <th className="px-6 py-4 whitespace-nowrap">Days Left</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Quantity</th>
                                <th className="px-6 py-4 whitespace-nowrap">Supplier</th>
                                <th className="px-6 py-4 whitespace-nowrap">Risk</th>
                                <th className="px-6 py-4 whitespace-nowrap">Recommended Action</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Trace</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item) => {
                                    const risk = resolveRisk(item);
                                    const badge = getRiskBadge(risk);
                                    const daysLeft = Number(item.days_until_expiry ?? 0);

                                    return (
                                        <tr
                                            key={`${item.status}-${item.batch_id}`}
                                            className={cn(
                                                'group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-all',
                                                item.status === 'expired' &&
                                                    'bg-rose-50/30 dark:bg-rose-900/5',
                                            )}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="font-black text-healthcare-dark dark:text-white whitespace-nowrap">
                                                    {item.medicine_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                                                    #{item.batch_number}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                                    {formatLocalDate(item.expiry_date, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                    {item.status === 'expired'
                                                        ? 'Expired'
                                                        : `${Math.max(daysLeft, 0)} days left`}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="font-black text-slate-800 dark:text-slate-100">
                                                    {item.quantity.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <span className="text-xs font-bold text-slate-500">
                                                    {String(
                                                        (item as any).supplier_name ||
                                                            (item as any).supplier?.name ||
                                                            'N/A',
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span
                                                    className={cn(
                                                        'inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border',
                                                        badge.className,
                                                    )}
                                                >
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
                                                    {resolveAction(item)}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <button
                                                    onClick={() => {
                                                        setTraceBatchId(item.batch_id.toString());
                                                        setShowTraceability(true);
                                                        window.scrollTo({
                                                            top: 300,
                                                            behavior: 'smooth',
                                                        });
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center border border-slate-100 dark:border-slate-700"
                                                    title="Trace batch"
                                                >
                                                    <Search size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-8 py-20 text-center">
                                        <div className="max-w-xs mx-auto">
                                            <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6 opacity-40">
                                                <CheckCircle
                                                    size={32}
                                                    className="text-healthcare-primary"
                                                />
                                            </div>
                                            <h4 className="text-lg font-black text-healthcare-dark dark:text-white uppercase tracking-tight">
                                                Zero Risk Batches
                                            </h4>
                                            <p className="text-slate-400 text-xs font-bold mt-2 uppercase">
                                                No expiring or expired items found within the
                                                selected {days} day window.
                                            </p>
                                        </div>
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
