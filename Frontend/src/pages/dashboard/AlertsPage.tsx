import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    Bell,
    Check,
    Clock,
    Database,
    LifeBuoy,
    Package,
    Scale,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { Drawer } from '../../components/ui/Drawer';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { formatLocalDateTime } from '../../lib/date';
import {
    type AlertScope,
    getAlertAccentTone,
    getAlertActionTarget,
    getAlertReferenceText,
    getAlertScope,
    getAlertSeverityLabel,
    getAlertSeverityTone,
    getAlertSortWeight,
    getAlertTypeLabel,
    isExpiryAlertType,
    isOperationalAlertType,
} from '../../lib/alertUi';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Alert } from '../../types/pharmacy';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';
type AlertStatusFilter = 'active' | 'acknowledged' | 'resolved';
type BackendAlertType = Alert['type'] | 'expiry';
type TypeFilterOption = {
    label: string;
    value?: BackendAlertType;
    description: string;
};

const ACTIONS_BY_ALERT_TYPE: Record<string, string[]> = {
    low_stock: ['Restocked', 'PO Created', 'Transferred', 'Adjusted Count', 'False Alarm'],
    expiry_soon: ['Discounted', 'Transferred', 'Returned to Supplier', 'Quarantined', 'False Alarm'],
    expired: ['Disposed', 'Returned to Supplier', 'Quarantined', 'False Alarm'],
    controlled_drug_threshold: ['Investigated', 'Adjusted Count', 'Escalated', 'False Alarm'],
    reorder_suggestion: ['PO Created', 'Transferred', 'Deferred', 'False Alarm'],
    batch_recall: ['Quarantined', 'Recovered', 'Disposed', 'Supplier Notified', 'False Alarm'],
    stock_variance: ['Adjusted Count', 'Investigated', 'Approved Variance', 'Rejected Variance', 'False Alarm'],
    cold_chain_excursion: ['Quarantined', 'Temperature Restored', 'Disposed', 'Escalated', 'False Alarm'],
};

const DIRECT_BACKEND_TYPES = new Set([
    'low_stock',
    'controlled_drug_threshold',
    'reorder_suggestion',
    'batch_recall',
    'stock_variance',
    'cold_chain_excursion',
    'expiry_soon',
    'expired',
    'expiry',
]);

const ALERT_TYPE_OPTIONS: Record<AlertScope, TypeFilterOption[]> = {
    all: [
        { label: 'Low Stock', value: 'low_stock', description: 'Medicines below expected stock threshold.' },
        { label: 'Controlled Threshold', value: 'controlled_drug_threshold', description: 'Controlled medicines that need immediate review.' },
        { label: 'Expiring Soon', value: 'expiry_soon', description: 'Batches approaching expiry that need action planning.' },
        { label: 'Expired', value: 'expired', description: 'Batches already expired and no longer sellable.' },
        { label: 'Reorder', value: 'reorder_suggestion', description: 'Suggested replenishment actions based on stockout risk.' },
        { label: 'Variances', value: 'stock_variance', description: 'Count mismatches or variance approvals waiting for follow-up.' },
        { label: 'Recalls', value: 'batch_recall', description: 'Recall workflows affecting specific medicine batches.' },
        { label: 'Cold Chain', value: 'cold_chain_excursion', description: 'Storage excursions that may have compromised stock.' },
    ],
    inventory: [
        { label: 'Low Stock', value: 'low_stock', description: 'Medicines below expected stock threshold.' },
        { label: 'Controlled Threshold', value: 'controlled_drug_threshold', description: 'Controlled medicines that need immediate review.' },
    ],
    expiry: [
        { label: 'Expiring Soon', value: 'expiry_soon', description: 'Batches approaching expiry that need action planning.' },
        { label: 'Expired', value: 'expired', description: 'Batches already expired and no longer sellable.' },
    ],
    operations: [
        { label: 'Reorder', value: 'reorder_suggestion', description: 'Suggested replenishment actions based on stockout risk.' },
        { label: 'Variances', value: 'stock_variance', description: 'Count mismatches or variance approvals waiting for follow-up.' },
        { label: 'Recalls', value: 'batch_recall', description: 'Recall workflows affecting specific medicine batches.' },
        { label: 'Cold Chain', value: 'cold_chain_excursion', description: 'Storage excursions that may have compromised stock.' },
    ],
};

function normalizeAlertType(type: string | undefined): string {
    if (!type) return 'low_stock';
    if (type === 'expiry') return 'expiry_soon';
    return type;
}

function deriveInitialScope(type: string | undefined): AlertScope {
    const scope = getAlertScope(type);
    return scope === 'all' ? 'all' : scope;
}

function deriveInitialSeverity(type: string | undefined): SeverityFilter {
    if (type === 'low_stock') return 'critical';
    return 'all';
}

function getScopeIcon(scope: AlertScope) {
    if (scope === 'expiry') return AlertTriangle;
    if (scope === 'operations') return LifeBuoy;
    if (scope === 'inventory') return Database;
    return Bell;
}

function getScopeLabel(scope: AlertScope) {
    if (scope === 'expiry') return 'Expiry';
    if (scope === 'operations') return 'Operations';
    if (scope === 'inventory') return 'Inventory';
    return 'All alerts';
}

function getAlertIcon(alert: Alert) {
    if (alert.type === 'stock_variance') return Scale;
    if (alert.type === 'batch_recall') return ShieldAlert;
    if (alert.type === 'reorder_suggestion') return Package;
    if (isExpiryAlertType(alert.type)) return AlertTriangle;
    return Database;
}

function getNextStepText(alert: Alert): string {
    const actionTarget = getAlertActionTarget(alert);
    if (actionTarget) {
        return actionTarget.description;
    }

    if (alert.type === 'cold_chain_excursion') {
        return 'Investigate the affected storage location and close the alert from the alert center after documenting the action taken.';
    }

    return 'Review the alert details, confirm the situation, and record the action taken when you resolve it.';
}

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
    }, [alert.id, alertType, actionOptions]);

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
        <Drawer isOpen onClose={onClose} size="md" title="Resolve Alert" showOverlay>
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
                        <label className="text-xs font-bold uppercase text-slate-500">Action Taken</label>
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
                            placeholder="Describe what was verified and what action was taken..."
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
                            {isSubmitting ? 'Resolving...' : <><Check size={18} /> Resolve</>}
                        </button>
                    </div>
                </form>
            </div>
        </Drawer>
    );
}

export function AlertsPage() {
    const { user, can } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate({ from: '/app/alerts' });
    // @ts-ignore TanStack route search is validated in router.tsx
    const searchParams = useSearch({ from: '/app/alerts' });

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(searchParams.search || '');
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [scopeFilter, setScopeFilter] = useState<AlertScope>(deriveInitialScope(searchParams.type));
    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(deriveInitialSeverity(searchParams.type));
    const [requestedType, setRequestedType] = useState<BackendAlertType | undefined>(
        typeof searchParams.type === 'string' && DIRECT_BACKEND_TYPES.has(searchParams.type)
            ? (searchParams.type as BackendAlertType)
            : undefined,
    );
    const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>(searchParams.status || 'active');
    const alertRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const canManageAlerts = can('alerts:write') && user?.role?.toString()?.toLowerCase() !== 'auditor';

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await pharmacyService.getAlerts({
                status: statusFilter,
                type: requestedType,
                limit: 150,
            });
            setAlerts(response.data);
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    }, [requestedType, statusFilter]);

    useEffect(() => {
        void fetchAlerts();
    }, [fetchAlerts]);

    useEffect(() => {
        setSearchQuery(searchParams.search || '');

        const nextRequestedType: BackendAlertType | undefined =
            typeof searchParams.type === 'string' && DIRECT_BACKEND_TYPES.has(searchParams.type)
                ? (searchParams.type as BackendAlertType)
                : undefined;
        setRequestedType(nextRequestedType);
        setScopeFilter(deriveInitialScope(searchParams.type));
        setSeverityFilter(deriveInitialSeverity(searchParams.type));
    }, [searchParams.search, searchParams.type]);

    useEffect(() => {
        if (!searchParams.status) {
            setStatusFilter('active');
            return;
        }

        if (
            searchParams.status === 'active' ||
            searchParams.status === 'acknowledged' ||
            searchParams.status === 'resolved'
        ) {
            setStatusFilter(searchParams.status);
        }
    }, [searchParams.status]);

    useEffect(() => {
        if (!socket) return;

        const refresh = () => {
            void fetchAlerts();
        };

        socket.on('alert:new', refresh);
        socket.on('alert:updated', refresh);
        socket.on('alert:resolved', refresh);

        return () => {
            socket.off('alert:new', refresh);
            socket.off('alert:updated', refresh);
            socket.off('alert:resolved', refresh);
        };
    }, [fetchAlerts, socket]);

    useEffect(() => {
        navigate({
            search: {
                search: searchQuery || undefined,
                type: requestedType || undefined,
                status: statusFilter === 'active' ? undefined : statusFilter,
                alertId: searchParams.alertId || undefined,
            },
            replace: true,
        });
    }, [searchQuery, requestedType, statusFilter, navigate, searchParams.alertId]);

    useEffect(() => {
        const targetAlertId = Number(searchParams.alertId);
        if (!targetAlertId || Number.isNaN(targetAlertId) || loading) return;

        const node = alertRefs.current[targetAlertId];
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchParams.alertId, alerts, loading]);

    const handleResolve = async (id: number, data: { action_taken: string; action_reason: string }) => {
        await pharmacyService.resolveAlert(id, data);
        await fetchAlerts();
    };

    const handleAcknowledge = async (id: number) => {
        await pharmacyService.acknowledgeAlert(id);
        await fetchAlerts();
    };

    const handleOpenAction = (alert: Alert) => {
        const actionTarget = getAlertActionTarget(alert);
        if (!actionTarget) return;

        navigate({
            to: actionTarget.to as any,
            search: (actionTarget.search || {}) as any,
        });
    };

    const visibleAlerts = useMemo(() => {
        return alerts
            .filter((alert) => {
                const searchStack = [
                    alert.title,
                    alert.message,
                    getAlertTypeLabel(alert.type),
                    getAlertReferenceText(alert),
                    alert.batch?.batch_number,
                    alert.medicine?.name,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                const matchesSearch = searchStack.includes(searchQuery.trim().toLowerCase());
                const matchesScope = scopeFilter === 'all' ? true : getAlertScope(alert.type) === scopeFilter;
                const matchesSeverity =
                    severityFilter === 'all'
                        ? true
                        : severityFilter === 'critical'
                            ? alert.severity === 'critical' || alert.severity === 'out_of_stock'
                            : alert.severity === severityFilter;

                return matchesSearch && matchesScope && matchesSeverity;
            })
            .sort((a, b) => {
                const severityDiff = getAlertSortWeight(a) - getAlertSortWeight(b);
                if (severityDiff !== 0) return severityDiff;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
    }, [alerts, scopeFilter, searchQuery, severityFilter]);

    const summary = useMemo(() => {
        const source = visibleAlerts;
        return {
            total: source.length,
            critical: source.filter((alert) => alert.severity === 'critical' || alert.severity === 'out_of_stock').length,
            expiry: source.filter((alert) => isExpiryAlertType(alert.type)).length,
            operations: source.filter((alert) => isOperationalAlertType(alert.type)).length,
            acknowledged: alerts.filter((alert) => alert.status === 'acknowledged').length,
        };
    }, [alerts, visibleAlerts]);

    const availableTypeFilters = useMemo(() => {
        const options = ALERT_TYPE_OPTIONS[scopeFilter];
        const counts = visibleAlerts.reduce<Record<string, number>>((acc, alert) => {
            if (!alert.type) return acc;
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
        }, {});

        return options.map((option) => ({
            ...option,
            count: counts[option.value || ''] || 0,
        }));
    }, [scopeFilter, visibleAlerts]);

    const sections = useMemo(() => {
        return [
            {
                key: 'immediate',
                title: statusFilter === 'resolved' ? 'Resolved Critical Items' : 'Immediate Action',
                description:
                    statusFilter === 'resolved'
                        ? 'Critical issues that were already closed and should remain traceable.'
                        : 'Out-of-stock and critical items that need the fastest response.',
                alerts: visibleAlerts.filter(
                    (alert) => alert.severity === 'out_of_stock' || alert.severity === 'critical',
                ),
            },
            {
                key: 'attention',
                title: statusFilter === 'resolved' ? 'Resolved Warnings' : 'Needs Attention',
                description:
                    statusFilter === 'resolved'
                        ? 'Warning-level items that were resolved and remain in history.'
                        : 'Warnings and monitored items that still need planned follow-up.',
                alerts: visibleAlerts.filter((alert) => alert.severity === 'warning'),
            },
            {
                key: 'monitor',
                title: statusFilter === 'resolved' ? 'Resolved Informational Alerts' : 'Monitor',
                description:
                    statusFilter === 'resolved'
                        ? 'Informational alerts already handled and kept for audit trail.'
                        : 'Lower-severity alerts that should stay visible without crowding urgent work.',
                alerts: visibleAlerts.filter((alert) => alert.severity === 'info'),
            },
        ].filter((section) => section.alerts.length > 0);
    }, [statusFilter, visibleAlerts]);

    return (
        <ProtectedRoute
            allowedRoles={[
                'Super Admin',
                'SUPER_ADMIN',
                'Facility Admin',
                'FACILITY_ADMIN',
                'Pharmacist',
                'PHARMACIST',
                'Store Keeper',
                'STORE_KEEPER',
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
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-healthcare-dark tracking-tight flex items-center gap-3">
                            <Bell className="text-rose-500" />
                            Alert Center
                        </h2>
                        <p className="text-slate-500 font-medium max-w-3xl text-sm">
                            Triage inventory risk, expiry pressure, and operational exceptions from one queue. Each alert now shows its severity, context, and the best next workspace to open.
                        </p>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex flex-wrap">
                        {(['active', 'acknowledged', 'resolved'] as AlertStatusFilter[]).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                                    statusFilter === status
                                        ? 'bg-white dark:bg-slate-700 text-healthcare-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700',
                                )}
                            >
                                {status === 'resolved' ? 'History' : status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">In View</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{summary.total}</p>
                        <p className="mt-1 text-xs text-slate-500">Alerts matching the current queue filters.</p>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 dark:bg-rose-950/20 dark:border-rose-900/30">
                        <p className="text-[11px] font-black uppercase tracking-widest text-rose-500">Critical</p>
                        <p className="mt-2 text-2xl font-black text-rose-700 dark:text-rose-300">{summary.critical}</p>
                        <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-300/80">Out-of-stock and critical risk items.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:bg-amber-950/20 dark:border-amber-900/30">
                        <p className="text-[11px] font-black uppercase tracking-widest text-amber-600">Expiry</p>
                        <p className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-300">{summary.expiry}</p>
                        <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">Near-expiry and expired stock alerts.</p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:bg-sky-950/20 dark:border-sky-900/30">
                        <p className="text-[11px] font-black uppercase tracking-widest text-sky-600">Operations</p>
                        <p className="mt-2 text-2xl font-black text-sky-700 dark:text-sky-300">{summary.operations}</p>
                        <p className="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">Recalls, variances, reorder, and cold-chain alerts.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Acknowledged</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{summary.acknowledged}</p>
                        <p className="mt-1 text-xs text-slate-500">Items already owned by someone but not yet closed.</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'inventory', 'expiry', 'operations'] as AlertScope[]).map((scope) => {
                                const ScopeIcon = getScopeIcon(scope);
                                return (
                                    <button
                                        key={scope}
                                        onClick={() => {
                                            setScopeFilter(scope);
                                            if (requestedType) {
                                                setRequestedType(undefined);
                                            }
                                        }}
                                        className={cn(
                                            'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2',
                                            scopeFilter === scope
                                                ? 'bg-healthcare-primary text-white border-healthcare-primary shadow-md shadow-healthcare-primary/15'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-healthcare-primary/30 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300',
                                        )}
                                    >
                                        <ScopeIcon size={14} />
                                        {getScopeLabel(scope)}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap gap-2 xl:ml-auto">
                            {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((severity) => (
                                <button
                                    key={severity}
                                    onClick={() => setSeverityFilter(severity)}
                                    className={cn(
                                        'px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border',
                                        severityFilter === severity
                                            ? getAlertSeverityTone(severity === 'critical' ? 'critical' : severity)
                                            : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300',
                                    )}
                                >
                                    {severity === 'all' ? 'All Severity' : severity}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by message, medicine, batch, or alert type..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-healthcare-primary transition-all text-sm font-medium"
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

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-300 lg:min-w-[260px]">
                            <span className="font-black uppercase tracking-wider text-slate-400">Queue Focus</span>
                            <p className="mt-1 leading-relaxed">
                                {scopeFilter === 'operations'
                                    ? 'Operational alerts point to recall, variance, reorder, and exception workflows.'
                                    : scopeFilter === 'expiry'
                                        ? 'Expiry alerts route to the stock-side expiry workspace for action planning.'
                                        : scopeFilter === 'inventory'
                                            ? 'Inventory alerts focus on medicine stock context and replenishment decisions.'
                                            : 'All alert domains are visible together in one triage queue.'}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:bg-slate-800/40 dark:border-slate-800">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                    Queue Lanes
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Narrow the queue to a specific operational lane when one team needs to focus on a single kind of alert.
                                </p>
                            </div>
                            {requestedType && (
                                <button
                                    onClick={() => setRequestedType(undefined)}
                                    className="px-3 py-2 rounded-xl bg-white text-slate-600 border border-slate-200 text-xs font-black uppercase tracking-wider hover:border-healthcare-primary/30 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Clear Type Focus
                                </button>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => setRequestedType(undefined)}
                                className={cn(
                                    'px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border',
                                    !requestedType
                                        ? 'bg-healthcare-primary text-white border-healthcare-primary shadow-md shadow-healthcare-primary/15'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-healthcare-primary/30 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300',
                                )}
                            >
                                All {scopeFilter === 'all' ? 'Types' : getScopeLabel(scopeFilter)}
                            </button>

                            {availableTypeFilters.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setRequestedType(option.value);
                                        if (option.value) {
                                            setScopeFilter(getAlertScope(option.value));
                                        }
                                    }}
                                    className={cn(
                                        'px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border',
                                        requestedType === option.value
                                            ? 'bg-white text-healthcare-primary border-healthcare-primary shadow-sm dark:bg-slate-900'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-healthcare-primary/30 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300',
                                    )}
                                    title={option.description}
                                >
                                    {option.label} <span className="text-[10px] opacity-70">({option.count})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <SkeletonTable
                        rows={5}
                        columns={1}
                        headers={null}
                        animate
                        className="border-none shadow-none"
                    />
                ) : sections.length > 0 ? (
                    <div className="space-y-6">
                        {sections.map((section) => (
                            <section key={section.key} className="space-y-3">
                                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">
                                            {section.title}
                                        </h3>
                                        <p className="text-sm text-slate-500">{section.description}</p>
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        {section.alerts.length} item{section.alerts.length === 1 ? '' : 's'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {section.alerts.map((alert) => {
                                        const AlertIcon = getAlertIcon(alert);
                                        const actionTarget = getAlertActionTarget(alert);
                                        const referenceText = getAlertReferenceText(alert);
                                        const scope = getAlertScope(alert.type);

                                        return (
                                            <div
                                                key={alert.id}
                                                ref={(node) => {
                                                    alertRefs.current[alert.id] = node;
                                                }}
                                                className={cn(
                                                    'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800 border-l-4',
                                                    getAlertAccentTone(alert.severity),
                                                    Number(searchParams.alertId) === alert.id &&
                                                        'ring-2 ring-healthcare-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
                                                )}
                                            >
                                                <div className="flex flex-col xl:flex-row gap-4">
                                                    <div
                                                        className={cn(
                                                            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
                                                            alert.severity === 'critical' || alert.severity === 'out_of_stock'
                                                                ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-300'
                                                                : alert.severity === 'warning'
                                                                    ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:text-amber-300'
                                                                    : 'bg-sky-50 text-sky-500 dark:bg-sky-950/30 dark:text-sky-300',
                                                        )}
                                                    >
                                                        <AlertIcon size={22} />
                                                    </div>

                                                    <div className="flex-1 space-y-3 min-w-0">
                                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                                            <div className="space-y-2 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <h4 className="text-base font-black text-healthcare-dark dark:text-white break-words">
                                                                        {alert.title || getAlertTypeLabel(alert.type)}
                                                                    </h4>
                                                                    <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider', getAlertSeverityTone(alert.severity))}>
                                                                        {getAlertSeverityLabel(alert.severity)}
                                                                    </span>
                                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                        {getAlertTypeLabel(alert.type)}
                                                                    </span>
                                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-healthcare-primary/10 text-healthcare-primary">
                                                                        {getScopeLabel(scope)}
                                                                    </span>
                                                                </div>

                                                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                                    {alert.message}
                                                                </p>

                                                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <Clock size={12} />
                                                                        {formatLocalDateTime(alert.created_at)}
                                                                    </span>
                                                                    {referenceText && (
                                                                        <span className="inline-flex items-center gap-1.5">
                                                                            <Package size={12} />
                                                                            {referenceText}
                                                                        </span>
                                                                    )}
                                                                    {alert.reference_type && alert.reference_id && (
                                                                        <span className="inline-flex items-center gap-1.5">
                                                                            <ShieldAlert size={12} />
                                                                            {alert.reference_type.replace(/_/g, ' ')} #{alert.reference_id}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {alert.status === 'acknowledged' && (
                                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40">
                                                                        Acknowledged
                                                                    </span>
                                                                )}
                                                                {alert.status === 'resolved' && (
                                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/40">
                                                                        Resolved
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
                                                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 dark:bg-slate-800/40 dark:border-slate-800">
                                                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Next Best Step</p>
                                                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                                    {getNextStepText(alert)}
                                                                </p>

                                                                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                                                    {alert.current_value !== undefined && alert.current_value !== null && (
                                                                        <span className="px-2.5 py-1 rounded-full bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700">
                                                                            Current: {alert.current_value}
                                                                        </span>
                                                                    )}
                                                                    {alert.threshold_value !== undefined &&
                                                                        alert.threshold_value !== null &&
                                                                        alert.threshold_value > 0 && (
                                                                            <span className="px-2.5 py-1 rounded-full bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700">
                                                                                Threshold: {alert.threshold_value}
                                                                            </span>
                                                                        )}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap xl:flex-col gap-2 xl:min-w-[220px]">
                                                                {actionTarget && (
                                                                    <button
                                                                        onClick={() => handleOpenAction(alert)}
                                                                        className="px-4 py-2.5 rounded-xl bg-healthcare-primary text-white text-xs font-black uppercase tracking-wider hover:bg-healthcare-primary/90 transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        {actionTarget.label}
                                                                        <ArrowRight size={14} />
                                                                    </button>
                                                                )}

                                                                {alert.status === 'active' && canManageAlerts && (
                                                                    <button
                                                                        onClick={() => void handleAcknowledge(alert.id)}
                                                                        className="px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                                                                    >
                                                                        <Check size={14} />
                                                                        Acknowledge
                                                                    </button>
                                                                )}

                                                                {(alert.status === 'active' || alert.status === 'acknowledged') && canManageAlerts && (
                                                                    <button
                                                                        onClick={() => setSelectedAlert(alert)}
                                                                        className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-colors dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                                                    >
                                                                        Resolve Alert
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {alert.status === 'resolved' && alert.action_taken && (
                                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                                                                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                                                                    Resolution Recorded
                                                                </p>
                                                                <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                                                                    {alert.action_taken}
                                                                </p>
                                                                {alert.action_reason && (
                                                                    <p className="mt-1 text-sm text-emerald-700/90 dark:text-emerald-200/80">
                                                                        {alert.action_reason}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:bg-slate-900 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                            <Search size={30} />
                        </div>
                        <h3 className="mt-4 font-black text-healthcare-dark dark:text-white">No Alerts Found</h3>
                        <p className="mt-2 text-sm text-slate-500">
                            {statusFilter === 'active'
                                ? "You're all caught up. No open alerts match the current filters."
                                : statusFilter === 'acknowledged'
                                    ? 'No acknowledged alerts match the current filters.'
                                    : 'No resolved alerts match the current filters.'}
                        </p>
                    </div>
                )}
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
