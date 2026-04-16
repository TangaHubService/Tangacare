import React, { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Truck,
    RefreshCw,
    Bell,
    FileText,
    ArrowRight,
    AlertTriangle,
    BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { userHasPermission } from '../../lib/rolePermissions';
import { PERMISSIONS } from '../../types/auth';
import { isSuperAdmin } from '../../types/auth';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';
import type { Alert, DashboardSummary } from '../../types/pharmacy';
import { cn } from '../../lib/utils';

const MANAGEMENT_ROLES = [
    'OWNER',
    'ADMIN',
    'FACILITY_ADMIN',
    'FACILITY ADMIN',
    'STORE_MANAGER',
    'STORE MANAGER',
    'SUPER_ADMIN',
    'SUPER ADMIN',
    'Admin',
    'Super Admin',
];

function matchesRole(userRole: string | undefined, candidates: string[]): boolean {
    const u = (userRole || '').toString().toUpperCase();
    const uNorm = u.replace(/[\s_]+/g, ' ');
    return candidates.some((c) => {
        const cU = c.toUpperCase();
        const cNorm = cU.replace(/[\s_]+/g, ' ');
        return cU === u || cNorm === uNorm;
    });
}

export function OperationsTodayPage() {
    const { user, facilityId } = useAuth();
    const { formatMoney } = useRuntimeConfig();
    const effectiveFacilityId = facilityId ?? user?.facility_id ?? undefined;
    const showManagementOverview =
        matchesRole(user?.role, MANAGEMENT_ROLES) || isSuperAdmin(user?.role);

    const canReadAlerts = userHasPermission(user, PERMISSIONS.ALERTS_READ);
    const canReadReports = userHasPermission(user, PERMISSIONS.REPORTS_READ);

    const { data: alertSummaryResponse, isLoading: alertSummaryLoading } = useQuery({
        queryKey: ['operations-today-alert-summary', effectiveFacilityId],
        queryFn: () => pharmacyService.getAlertSummary(effectiveFacilityId ?? null),
        enabled: !!user && canReadAlerts && (!!effectiveFacilityId || isSuperAdmin(user?.role)),
        staleTime: 60_000,
    });

    const { data: dashboardSummary, isLoading: summaryLoading } = useQuery({
        queryKey: ['operations-today-dashboard', effectiveFacilityId],
        queryFn: (): Promise<DashboardSummary> =>
            pharmacyService.getDashboardSummary(effectiveFacilityId ?? null),
        enabled:
            !!user &&
            canReadReports &&
            (!!effectiveFacilityId || isSuperAdmin(user?.role)),
        staleTime: 120_000,
    });

    const { data: topAlerts = [], isLoading: alertsLoading } = useQuery({
        queryKey: ['operations-today-alerts', effectiveFacilityId],
        queryFn: async (): Promise<Alert[]> => {
            const res = await pharmacyService.getAlerts({
                facility_id: effectiveFacilityId || undefined,
                status: 'active',
                limit: 8,
            });
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: !!user && canReadAlerts && (!!effectiveFacilityId || isSuperAdmin(user?.role)),
        staleTime: 45_000,
    });

    const summary = alertSummaryResponse?.data;

    const prioritizedAlerts = useMemo(() => {
        const rank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
        return [...topAlerts].sort((a, b) => rank(a.severity || '') - rank(b.severity || ''));
    }, [topAlerts]);

    const todayFinancial = dashboardSummary?.today?.financial;

    const quickActions = [
        {
            to: '/app/sell',
            label: 'Sell',
            description: 'POS — scan, cart, payment',
            icon: ShoppingCart,
            accent: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        },
        {
            to: '/app/inventory',
            label: 'Medicines',
            description: 'Catalog & stock overview',
            icon: Package,
            accent: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        },
        {
            to: '/app/stock',
            label: 'Batches',
            description: 'Shelf-ready batch inventory',
            icon: Package,
            accent: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
        },
        {
            to: '/app/order-receive',
            label: 'Order & receive',
            description: 'Purchase orders & receiving',
            icon: Truck,
            accent: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
        },
        {
            to: '/app/replenish',
            label: 'Replenish',
            description: 'What to order & draft POs',
            icon: RefreshCw,
            accent: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
        },
        {
            to: '/app/alerts',
            label: 'Alerts',
            description: 'Low stock, expiry, reorder',
            icon: Bell,
            accent: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
        },
        {
            to: '/app/analytics/sales',
            label: 'Reports',
            description: 'Sales, top sellers, stock & expiry, exports',
            icon: FileText,
            accent: 'bg-slate-500/10 text-slate-700 dark:text-slate-200',
        },
    ];

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Operations
                    </p>
                    <h1 className="text-2xl font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                        <LayoutDashboard className="text-healthcare-primary" size={28} />
                        Today
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-xl">
                        Start here for daily pharmacy work: selling, stock health, purchasing, and
                        exceptions that need attention.
                    </p>
                </div>
                {showManagementOverview && (
                    <Link
                        to="/app/overview"
                        search={{} as any}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <BarChart3 size={18} className="text-healthcare-primary" />
                        Management overview
                        <ArrowRight size={16} />
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {canReadReports && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Today revenue
                        </p>
                        <p className="text-2xl font-black text-healthcare-dark dark:text-white mt-1">
                            {summaryLoading
                                ? '—'
                                : formatMoney(Number(todayFinancial?.total_revenue ?? 0))}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                            {summaryLoading
                                ? 'Loading…'
                                : `${todayFinancial?.total_transactions ?? 0} transactions`}
                        </p>
                    </div>
                )}
                {canReadAlerts && (
                    <>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Low stock
                            </p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                {alertSummaryLoading ? '—' : summary?.low_stock ?? '—'}
                            </p>
                            <Link
                                to="/app/alerts"
                                search={{ type: 'low_stock' } as any}
                                className="text-xs font-bold text-healthcare-primary mt-2 inline-flex items-center gap-1"
                            >
                                View alerts <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Expiring / expired
                            </p>
                            <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">
                                {alertSummaryLoading
                                    ? '—'
                                    : Number(summary?.expiry_soon ?? 0) +
                                      Number(summary?.expired ?? 0)}
                            </p>
                            <Link
                                to="/app/alerts"
                                search={{ type: 'expiry' } as any}
                                className="text-xs font-bold text-healthcare-primary mt-2 inline-flex items-center gap-1"
                            >
                                Review <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-300">
                                Expired units
                            </p>
                            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                                {alertSummaryLoading ? '—' : summary?.expired ?? '—'}
                            </p>
                            <Link
                                to="/app/recalls"
                                search={{} as any}
                                className="text-xs font-bold text-red-700 dark:text-red-300 mt-2 inline-flex items-center gap-1"
                            >
                                Expiry workspace <ArrowRight size={12} />
                            </Link>
                        </div>
                    </>
                )}
            </div>

            <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                    Quick actions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {quickActions.map((action) => (
                        <Link
                            key={action.to}
                            to={action.to as any}
                            search={{} as any}
                            className="group flex gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 hover:border-healthcare-primary/40 hover:shadow-md transition-all"
                        >
                            <div
                                className={cn(
                                    'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
                                    action.accent,
                                )}
                            >
                                <action.icon size={22} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-healthcare-dark dark:text-white group-hover:text-healthcare-primary transition-colors">
                                    {action.label}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
                            </div>
                            <ArrowRight
                                size={18}
                                className="ml-auto text-slate-300 group-hover:text-healthcare-primary transition-colors shrink-0"
                            />
                        </Link>
                    ))}
                </div>
            </div>

            {canReadAlerts && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500" />
                            Needs attention
                        </h2>
                        <Link
                            to="/app/alerts"
                            search={{} as any}
                            className="text-xs font-bold text-healthcare-primary"
                        >
                            All alerts
                        </Link>
                    </div>
                    {alertsLoading ? (
                        <div className="p-6 text-sm text-slate-400 font-bold">Loading alerts…</div>
                    ) : prioritizedAlerts.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500 font-medium">
                            No active alerts right now.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {prioritizedAlerts.slice(0, 6).map((a) => (
                                <li key={a.id}>
                                    <Link
                                        to="/app/alerts"
                                        search={{ alertId: String(a.id) } as any}
                                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                    >
                                        <span
                                            className={cn(
                                                'mt-0.5 text-[10px] font-black uppercase px-2 py-0.5 rounded-md',
                                                a.severity === 'critical'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                    : a.severity === 'warning'
                                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                                            )}
                                        >
                                            {a.severity || 'info'}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-healthcare-dark dark:text-white truncate">
                                                {a.title || a.type?.replace(/_/g, ' ') || 'Alert'}
                                            </p>
                                            {a.message && (
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                                    {a.message}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
