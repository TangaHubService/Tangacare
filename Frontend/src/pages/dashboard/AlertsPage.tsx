import { useState, useEffect, useRef } from 'react';
import {
    AlertTriangle,
    Bell,
    Clock,
    AlertCircle,
    Database,
    Search,
    Filter,
    X,
    Check,
} from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Alert } from '../../types/pharmacy';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../context/AuthContext';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { formatLocalDateTime } from '../../lib/date';
import { Drawer } from '../../components/ui/Drawer';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ACTIONS_BY_ALERT_TYPE: Record<string, string[]> = {
    low_stock: ['Restocked', 'PO Created', 'Transferred', 'Adjusted Count', 'False Alarm'],
    expiry_soon: [
        'Discounted',
        'Transferred',
        'Returned to Supplier',
        'Quarantined',
        'False Alarm',
    ],
    expired: ['Disposed', 'Returned to Supplier', 'Quarantined', 'False Alarm'],
    controlled_drug_threshold: ['Investigated', 'Adjusted Count', 'Escalated', 'False Alarm'],
    reorder_suggestion: ['PO Created', 'Transferred', 'Deferred', 'False Alarm'],
};

const normalizeAlertType = (type: string | undefined): string => {
    if (!type) return 'low_stock';
    if (type === 'expiry') return 'expiry_soon';
    return type;
};

// Modal Component
function ResolveAlertModal({
    alert,
    onClose,
    onResolve,
}: {
    alert: Alert;
    onClose: () => void;
    onResolve: (id: number, data: { action_taken: string; action_reason: string }) => Promise<void>;
}) {
    const alertType = normalizeAlertType(alert.type);
    const actionOptions = ACTIONS_BY_ALERT_TYPE[alertType] || ACTIONS_BY_ALERT_TYPE.low_stock;

    const [actionTaken, setActionTaken] = useState(actionOptions[0] || '');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        setActionTaken(actionOptions[0] || '');
        setFormError('');
    }, [alert.id, alertType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedReason = reason.trim();
        if (!actionTaken) {
            setFormError('Action is required.');
            return;
        }
        if (normalizedReason.length < 10) {
            setFormError('Reason must be at least 10 characters.');
            return;
        }

        setIsSubmitting(true);
        setFormError('');
        try {
            await onResolve(alert.id, {
                action_taken: actionTaken,
                action_reason: normalizedReason,
            });
            onClose();
        } catch (error: any) {
            setFormError(error?.response?.data?.message || 'Failed to resolve alert.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="md"
            title="Resolve Alert"
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-3">
                            <AlertCircle size={18} className="text-slate-500 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm text-healthcare-dark dark:text-white">
                                    {alert.title || 'System Alert'}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1">{alert.message}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">
                            Action Taken
                        </label>
                        <select
                            required
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            className="w-full p-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-medium text-sm focus:border-healthcare-primary outline-none"
                        >
                            {actionOptions.map((action) => (
                                <option key={action} value={action}>
                                    {action}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-500">
                            Suggested: <span className="font-semibold">{actionOptions[0]}</span>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">
                            Reason / Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required
                            minLength={10}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe existing conditions or specific details..."
                            className="w-full p-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-medium text-sm focus:border-healthcare-primary outline-none min-h-[100px]"
                        />
                    </div>

                    {formError && (
                        <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                            {formError}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-healthcare-primary text-white font-bold rounded-xl hover:bg-healthcare-primary/90 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                'Resolving...'
                            ) : (
                                <>
                                    <Check size={18} /> Resolve
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Drawer>
    );
}

export function AlertsPage() {
    const { user } = useAuth();
    const navigate = useNavigate({ from: '/app/alerts' });
    // @ts-ignore - Route validation is added in router.tsx but TS might not pick it up instantly without codegen run
    const searchParams = useSearch({ from: '/app/alerts' });

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(searchParams.search || '');
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'expiry'>(
        searchParams.type || 'all',
    );
    const [statusFilter, setStatusFilter] = useState<'active' | 'resolved'>(
        searchParams.status || 'active',
    );
    const alertRefs = useRef<Record<number, HTMLDivElement | null>>({});

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            // Pass statusFilter to backend
            const response = await pharmacyService.getAlerts({ status: statusFilter });
            setAlerts(response.data);
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    // Sync state to URL
    useEffect(() => {
        navigate({
            search: {
                search: searchQuery || undefined,
                type: filterType === 'all' ? undefined : filterType,
                status: statusFilter === 'active' ? undefined : statusFilter,
                alertId: searchParams.alertId || undefined,
            },
            replace: true,
        });
    }, [searchQuery, filterType, statusFilter, navigate, searchParams.alertId]);

    useEffect(() => {
        const targetAlertId = Number(searchParams.alertId);
        if (!targetAlertId || Number.isNaN(targetAlertId) || loading) return;

        const node = alertRefs.current[targetAlertId];
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchParams.alertId, alerts, loading]);

    const handleResolve = async (
        id: number,
        data: { action_taken: string; action_reason: string },
    ) => {
        await pharmacyService.resolveAlert(id, data);
        await fetchAlerts(); // Refresh list
    };

    const filteredAlerts = alerts.filter((alert) => {
        const matchesSearch =
            alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (alert.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType =
            filterType === 'all'
                ? true
                : filterType === 'low_stock'
                  ? alert.type === 'low_stock'
                  : (alert.type || '').includes('expiry') || alert.type === 'expired';

        // Additional status check (though currently backend only returns active)
        const matchesStatus = alert.status === statusFilter;
        // Since backend currently returns ONLY active, checking for 'resolved' will likely yield empty list unless I update backend.
        // I will display a message if filtered list is empty.

        return matchesSearch && matchesType && matchesStatus;
    });

    return (
        <ProtectedRoute
            allowedRoles={[
                'Super Admin',
                'SUPER_ADMIN',
                'Facility Admin',
                'FACILITY_ADMIN',
                'Pharmacist',
                'PHARMACIST',
                'Store Manager',
                'STORE_MANAGER',
                'Auditor',
                'AUDITOR',
                'ADMIN',
                'OWNER',
            ]}
            requireFacility
        >
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-healthcare-dark tracking-tight flex items-center gap-3">
                            <Bell className="text-rose-500" />
                            System Alerts & Notifications
                        </h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                            Critical Stock & Expiry Monitoring
                        </p>
                    </div>
                    {/* Status Toggles */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex">
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={cn(
                                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                                statusFilter === 'active'
                                    ? 'bg-white dark:bg-slate-700 text-healthcare-primary shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700',
                            )}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setStatusFilter('resolved')}
                            className={cn(
                                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                                statusFilter === 'resolved'
                                    ? 'bg-white dark:bg-slate-700 text-healthcare-primary shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700',
                            )}
                        >
                            History
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={cn(
                                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border',
                                filterType === 'all'
                                    ? 'bg-healthcare-primary text-white border-healthcare-primary shadow-md shadow-healthcare-primary/20'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-healthcare-primary/30',
                            )}
                        >
                            All Types
                        </button>
                        <button
                            onClick={() => setFilterType('low_stock')}
                            className={cn(
                                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2',
                                filterType === 'low_stock'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-amber-500/30',
                            )}
                        >
                            <Database size={14} /> Low Stock
                        </button>
                        <button
                            onClick={() => setFilterType('expiry')}
                            className={cn(
                                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2',
                                filterType === 'expiry'
                                    ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-rose-500/30',
                            )}
                        >
                            <AlertTriangle size={14} /> Expiry Risk
                        </button>
                    </div>
                    <div className="relative flex-1 max-w-sm w-full">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Filter alerts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:border-healthcare-primary transition-all text-sm font-bold shadow-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button className="p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 hover:text-healthcare-primary transition-colors">
                        <Filter size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <SkeletonTable
                            rows={4}
                            columns={1}
                            headers={null}
                            animate
                            className="border-none shadow-none"
                        />
                    ) : filteredAlerts.length > 0 ? (
                        filteredAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                ref={(node) => {
                                    alertRefs.current[alert.id] = node;
                                }}
                                className={cn(
                                    'glass-card p-5 rounded-2xl border-l-4 flex flex-col md:flex-row gap-4 md:items-center transition-all hover:shadow-md group bg-white dark:bg-slate-900',
                                    alert.severity === 'out_of_stock'
                                        ? 'border-l-rose-700 border-y-slate-100 border-r-slate-100'
                                        : alert.severity === 'critical'
                                          ? 'border-l-rose-500 border-y-slate-100 border-r-slate-100'
                                          : alert.severity === 'warning'
                                            ? 'border-l-amber-500 border-y-slate-100 border-r-slate-100'
                                            : 'border-l-blue-400 border-y-slate-100 border-r-slate-100',
                                    Number(searchParams.alertId) === alert.id &&
                                        'ring-2 ring-healthcare-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
                                )}
                            >
                                <div
                                    className={cn(
                                        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm',
                                        alert.severity === 'out_of_stock' ||
                                            alert.severity === 'critical'
                                            ? 'bg-rose-50 text-rose-500'
                                            : alert.severity === 'warning'
                                              ? 'bg-amber-50 text-amber-500'
                                              : 'bg-blue-50 text-blue-500',
                                    )}
                                >
                                    {(alert.type || '').includes('expiry') ||
                                    alert.type === 'expired' ? (
                                        <AlertTriangle size={24} />
                                    ) : alert.type === 'low_stock' ? (
                                        <Database size={24} />
                                    ) : (
                                        <Bell size={24} />
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-black text-healthcare-dark text-sm uppercase italic tracking-tight">
                                            {alert.title || (alert.type || '').replace('_', ' ')}
                                        </h4>
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Clock size={12} />
                                            <span className="text-[10px] font-bold uppercase">
                                                {formatLocalDateTime(alert.created_at)}
                                            </span>

                                            {alert.status === 'resolved' && (
                                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">
                                                    Resolved
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                                        {alert.message}
                                    </p>
                                    <div className="flex gap-4 mt-2">
                                        {alert.current_value !== undefined && (
                                            <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                Current: {alert.current_value}
                                            </div>
                                        )}
                                        {alert.threshold_value !== undefined &&
                                            alert.threshold_value > 0 && (
                                                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                    Threshold: {alert.threshold_value}
                                                </div>
                                            )}
                                    </div>
                                    {alert.status === 'resolved' && alert.action_taken && (
                                        <div className="mt-2 text-[11px]">
                                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
                                                Resolved: {alert.action_taken}
                                            </span>
                                            {alert.action_reason && (
                                                <p className="mt-1 text-slate-500 font-medium">
                                                    {alert.action_reason}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 self-end md:self-center">
                                    {alert.status === 'active' &&
                                        user?.role?.toString()?.toLowerCase() !== 'auditor' && (
                                            <button
                                                onClick={() => setSelectedAlert(alert)}
                                                className="px-4 py-2 bg-healthcare-primary/10 text-healthcare-primary hover:bg-healthcare-primary hover:text-white rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="glass-card bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                                <Search size={32} />
                            </div>
                            <h3 className="font-black text-healthcare-dark">No Alerts Found</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase">
                                {statusFilter === 'active'
                                    ? "You're all caught up! No active alerts matching criteria."
                                    : 'No resolved alerts found in history matching criteria.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {selectedAlert && (
                <ResolveAlertModal
                    alert={selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                    onResolve={handleResolve}
                />
            )}
        </ProtectedRoute>
    );
}
