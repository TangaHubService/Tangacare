import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import {
    TrendingUp,
    Calendar,
    Download,
    Activity,
    AlertTriangle,
    Package,
    DollarSign,
    RotateCcw,
    Search,
    ChevronDown,
    Receipt,
    BarChart2,
    Users,
    RefreshCw,
    SlidersHorizontal,
} from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { pharmacyService } from '../../services/pharmacy.service';
import { useAuth } from '../../context/AuthContext';
import { PerformanceChart } from '../../components/pharmacy/PerformanceChart';
import { TaxSummaryTable } from '../../components/pharmacy/TaxSummaryTable';
import { format, subDays } from 'date-fns';
import { cn } from '../../lib/utils';
import { formatLocalDate, parseLocalDate } from '../../lib/date';

import { CreateReturnModal } from '../../components/pharmacy/returns/CreateReturnModal';
import { PurchaseReport } from '../../components/pharmacy/reports/PurchaseReport';
import { FastSlowMovingReport } from '../../components/pharmacy/reports/FastSlowMovingReport';
import type { Medicine } from '../../types/pharmacy';
import { toast } from 'react-hot-toast';
import { PERMISSIONS } from '../../types/auth';
import { formatPharmacyApiError } from '../../lib/pharmacyApiErrors';

export interface ReportsPageProps {
    defaultTab?: string;
}

const VALID_REPORT_TABS = new Set([
    'sales',
    'stock',
    'purchase',
    'fast-moving',
    'performance',
    'customer',
    'tax',
]);

const REPORT_TAB_HINTS: Record<string, string> = {
    sales: 'Revenue, margins, and line-level sales for the selected date range.',
    stock: 'On-hand quantities and valuation for this branch — pair with Replenish for ordering.',
    purchase: 'Incoming purchase orders and spend — validate against draft POs from replenishment.',
    'fast-moving': 'Fast vs slow movers and ABC-style signals for promos and shelf resets.',
    performance: 'Throughput by team member where POS attribution is available.',
    customer: 'Visits and spend patterns for loyalty follow-ups.',
    tax: 'VAT and taxable sales — aligns with branch fiscal settings.',
};

const SECONDARY_REPORT_ACTIONS = [
    {
        tab: 'tax',
        to: '/app/analytics/tax',
        label: 'Tax',
        hint: 'VAT and taxable sales',
        icon: Receipt,
    },
    {
        tab: 'performance',
        to: '/app/analytics/performance',
        label: 'Staff',
        hint: 'Sales by team member',
        icon: BarChart2,
    },
    {
        tab: 'customer',
        to: '/app/analytics/loyalty',
        label: 'Customers',
        hint: 'Visits and spend',
        icon: Users,
    },
    {
        tab: '_replenish',
        to: '/app/replenish',
        label: 'Replenish',
        hint: 'Suggestions & draft POs',
        icon: RefreshCw,
    },
] as const;

const SUBTAB_ALIASES: Record<string, string> = {
    profit: 'sales',
    reorder: 'stock-analytics',
    procurement: 'purchase',
    staff: 'performance',
    loyalty: 'customer',
    operations: 'operations',
    intelligence: 'inventory-intelligence',
    compliance: 'business-compliance',
};

function normalizeSubtab(tab: string): string {
    const key = String(tab || '').trim();
    return SUBTAB_ALIASES[key] || key;
}

function resolveReportTab(defaultTab: string): string {
    const n = normalizeSubtab(defaultTab);
    if (n === 'operations') return 'sales';
    if (n === 'stock-analytics') return 'stock';
    if (n === 'inventory-intelligence') return 'fast-moving';
    if (n === 'business-compliance') return 'performance';
    if (VALID_REPORT_TABS.has(n)) return n;
    return 'sales';
}

type SalesReportView = 'general' | 'purchase-vs-sales' | 'medicine-margin';

const SALES_REPORT_VIEW_LABELS: Record<SalesReportView, string> = {
    general: 'General Sales',
    'purchase-vs-sales': 'Purchase vs Sales',
    'medicine-margin': 'Medicine Margin',
};

function getExportType(
    tab: string,
    activeSalesView: SalesReportView,
):
    | 'sales'
    | 'purchase-vs-sales'
    | 'medicine-margin'
    | 'stock'
    | 'fast-moving'
    | 'purchase'
    | 'performance'
    | 'customer'
    | 'tax'
    | null {
    if (tab === 'sales') {
        if (activeSalesView === 'purchase-vs-sales') return 'purchase-vs-sales';
        if (activeSalesView === 'medicine-margin') return 'medicine-margin';
        return 'sales';
    }
    if (tab === 'stock') return 'stock';
    if (tab === 'fast-moving') return 'fast-moving';
    if (tab === 'purchase') return 'purchase';
    if (tab === 'performance') return 'performance';
    if (tab === 'customer') return 'customer';
    if (tab === 'tax') return 'tax';
    return null;
}

export function ReportsPage({ defaultTab = 'sales' }: ReportsPageProps) {
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [salesView, setSalesView] = useState<SalesReportView>('general');
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const moreButtonRef = useRef<HTMLButtonElement | null>(null);
    const morePanelRef = useRef<HTMLDivElement | null>(null);
    const exportButtonRef = useRef<HTMLButtonElement | null>(null);
    const exportPanelRef = useRef<HTMLDivElement | null>(null);
    const [moreMenuPlacement, setMoreMenuPlacement] = useState<{
        top?: number;
        bottom?: number;
        right: number;
        width: number;
        maxHeight: number;
        placeAbove: boolean;
    } | null>(null);
    const [exportMenuPlacement, setExportMenuPlacement] = useState<{
        top?: number;
        bottom?: number;
        right: number;
        width: number;
        placeAbove: boolean;
    } | null>(null);
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;

    const resolvedTab = useMemo(() => resolveReportTab(defaultTab), [defaultTab]);

    const moreMenuActiveLabel = useMemo(() => {
        const hit = SECONDARY_REPORT_ACTIONS.find(
            (a) => a.tab !== '_replenish' && resolvedTab === a.tab,
        );
        return hit?.label ?? null;
    }, [resolvedTab]);

    useEffect(() => {
        if (resolvedTab !== 'sales') {
            setSalesView('general');
        }
    }, [resolvedTab]);

    const exportType = getExportType(resolvedTab, salesView);
    const canExport = exportType !== null;

    const syncMoreMenuPlacement = useCallback(() => {
        const el = moreButtonRef.current;
        if (!el || !moreMenuOpen) return;
        const r = el.getBoundingClientRect();
        const margin = 16;
        const maxPanelW = 18.5 * 16;
        const width = Math.min(maxPanelW, window.innerWidth - margin * 2);
        const right = Math.max(margin, window.innerWidth - r.right);
        const spaceBelow = window.innerHeight - r.bottom - margin;
        const spaceAbove = r.top - margin;
        const targetMin = 260;
        const placeAbove = spaceBelow < targetMin && spaceAbove > spaceBelow;
        if (placeAbove) {
            const maxHeight = Math.max(200, Math.min(spaceAbove - 8, window.innerHeight * 0.72));
            setMoreMenuPlacement({
                placeAbove: true,
                bottom: window.innerHeight - r.top + 8,
                right,
                width,
                maxHeight,
            });
        } else {
            const top = r.bottom + 8;
            const maxHeight = Math.max(200, window.innerHeight - top - margin);
            setMoreMenuPlacement({ placeAbove: false, top, right, width, maxHeight });
        }
    }, [moreMenuOpen]);

    const syncExportMenuPlacement = useCallback(() => {
        const el = exportButtonRef.current;
        if (!el || !exportMenuOpen || !canExport) return;
        const r = el.getBoundingClientRect();
        const margin = 16;
        const width = Math.max(12 * 16, r.width, 192);
        const right = Math.max(margin, window.innerWidth - r.right);
        const spaceBelow = window.innerHeight - r.bottom - margin;
        const spaceAbove = r.top - margin;
        const targetMin = 140;
        const placeAbove = spaceBelow < targetMin && spaceAbove > spaceBelow;
        if (placeAbove) {
            setExportMenuPlacement({
                placeAbove: true,
                bottom: window.innerHeight - r.top + 8,
                right,
                width,
            });
        } else {
            setExportMenuPlacement({ placeAbove: false, top: r.bottom + 8, right, width });
        }
    }, [exportMenuOpen, canExport]);

    useLayoutEffect(() => {
        if (!moreMenuOpen) {
            setMoreMenuPlacement(null);
            return;
        }
        syncMoreMenuPlacement();
    }, [moreMenuOpen, syncMoreMenuPlacement]);

    useLayoutEffect(() => {
        if (!exportMenuOpen || !canExport) {
            setExportMenuPlacement(null);
            return;
        }
        syncExportMenuPlacement();
    }, [exportMenuOpen, canExport, syncExportMenuPlacement]);

    useEffect(() => {
        if (!moreMenuOpen && !exportMenuOpen) return;

        const sync = () => {
            if (moreMenuOpen) syncMoreMenuPlacement();
            if (exportMenuOpen && canExport) syncExportMenuPlacement();
        };

        window.addEventListener('resize', sync);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', sync);
        const scrollEl = document.querySelector<HTMLElement>('.layout-content-panel');
        scrollEl?.addEventListener('scroll', sync, { passive: true });

        return () => {
            window.removeEventListener('resize', sync);
            vv?.removeEventListener('resize', sync);
            scrollEl?.removeEventListener('scroll', sync);
        };
    }, [
        moreMenuOpen,
        exportMenuOpen,
        canExport,
        syncMoreMenuPlacement,
        syncExportMenuPlacement,
    ]);

    useEffect(() => {
        const onDocMouseDown = (event: MouseEvent) => {
            const t = event.target as Node;
            if (exportButtonRef.current?.contains(t)) return;
            if (exportPanelRef.current?.contains(t)) return;
            if (moreButtonRef.current?.contains(t)) return;
            if (morePanelRef.current?.contains(t)) return;
            setExportMenuOpen(false);
            setMoreMenuOpen(false);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setExportMenuOpen(false);
                setMoreMenuOpen(false);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const handleExport = async (format: 'excel' | 'pdf') => {
        if (!exportType) {
            toast.error('Export is not available for this report yet.');
            return;
        }

        const params: any = { facilityId: effectiveFacilityId };
        if (
            [
                'sales',
                'purchase-vs-sales',
                'medicine-margin',
                'purchase',
                'performance',
                'tax',
            ].includes(exportType)
        ) {
            params.start_date = startDate;
            params.end_date = endDate;
        }
        if (exportType === 'fast-moving') params.days = 90;

        try {
            await pharmacyService.downloadReport(exportType, format, params);
            setExportMenuOpen(false);
            setMoreMenuOpen(false);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(formatPharmacyApiError(error));
        }
    };

    return (
        <ProtectedRoute
            requiredPermissions={[PERMISSIONS.REPORTS_READ]}
            requireFacility
        >
            <div className="w-full min-w-0 px-3 sm:px-4 py-4 sm:py-5 space-y-4 animate-in fade-in duration-500">
                <header className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900/70 shadow-sm overflow-visible">
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/90 bg-gradient-to-br from-slate-50/90 to-white dark:from-slate-900 dark:to-slate-900/80">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-healthcare-dark dark:text-white">
                                    Reports
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl leading-snug">
                                    {REPORT_TAB_HINTS[resolvedTab] ??
                                        'Use the main tabs or More for related analytics. Export is available when a dataset is loaded.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
                                <div className="relative">
                                    <button
                                        ref={moreButtonRef}
                                        type="button"
                                        aria-expanded={moreMenuOpen}
                                        aria-haspopup="menu"
                                        onClick={() => {
                                            setExportMenuOpen(false);
                                            setMoreMenuOpen((o) => !o);
                                        }}
                                        className={cn(
                                            'inline-flex items-center gap-2 min-h-[44px] pl-4 pr-3 rounded-xl text-sm font-bold transition-all border-2',
                                            moreMenuOpen || moreMenuActiveLabel
                                                ? 'border-healthcare-primary/50 bg-healthcare-primary/[0.08] dark:bg-healthcare-primary/15 text-healthcare-dark dark:text-white shadow-sm'
                                                : 'border-slate-200/90 dark:border-slate-600 bg-white/90 dark:bg-slate-800/60 text-slate-700 dark:text-slate-100 hover:border-healthcare-primary/35 hover:bg-white dark:hover:bg-slate-800',
                                        )}
                                    >
                                        <span className="flex flex-col items-start leading-none">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                More
                                            </span>
                                            <span className="mt-1 text-sm font-bold">
                                                {moreMenuActiveLabel
                                                    ? moreMenuActiveLabel
                                                    : 'Other reports'}
                                            </span>
                                        </span>
                                        <ChevronDown
                                            size={18}
                                            className={cn(
                                                'shrink-0 opacity-70 transition-transform duration-200',
                                                moreMenuOpen && 'rotate-180',
                                            )}
                                        />
                                    </button>
                                </div>

                                <div className="relative">
                                    <button
                                        ref={exportButtonRef}
                                        type="button"
                                        aria-expanded={exportMenuOpen}
                                        aria-haspopup="menu"
                                        onClick={() => {
                                            setMoreMenuOpen(false);
                                            if (canExport) setExportMenuOpen((o) => !o);
                                        }}
                                        disabled={!canExport}
                                        className={cn(
                                            'inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl text-sm font-bold transition-all',
                                            canExport
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/25'
                                                : 'bg-slate-200 text-slate-500 cursor-not-allowed',
                                        )}
                                    >
                                        <Download size={18} strokeWidth={2.25} />
                                        Export
                                        <ChevronDown
                                            size={16}
                                            className={cn(
                                                'opacity-90 transition-transform duration-200',
                                                exportMenuOpen && 'rotate-180',
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {['sales', 'tax', 'performance', 'purchase'].includes(resolvedTab) && (
                    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900/50 px-3 py-3 sm:px-4 sm:py-3 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <SlidersHorizontal
                                size={16}
                                className="text-slate-400 shrink-0"
                                aria-hidden
                            />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                Filters
                            </span>
                        </div>
                        <div
                            className={cn(
                                'flex flex-col gap-3',
                                resolvedTab === 'sales'
                                    ? 'lg:flex-row lg:items-center lg:justify-between'
                                    : 'lg:flex-row lg:items-center lg:justify-end',
                            )}
                        >
                            {resolvedTab === 'sales' ? (
                                <div
                                    className="inline-flex w-full sm:w-auto flex-wrap items-center gap-1 rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80"
                                    role="group"
                                    aria-label="Sales report type"
                                >
                                    {(Object.entries(SALES_REPORT_VIEW_LABELS) as Array<
                                        [SalesReportView, string]
                                    >).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setSalesView(value)}
                                            className={cn(
                                                'min-h-[40px] rounded-lg px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all',
                                                salesView === value
                                                    ? 'bg-white dark:bg-slate-900 text-healthcare-primary shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-healthcare-primary',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 sr-only sm:not-sr-only sm:inline">
                                    Range
                                </span>
                                <div className="flex flex-1 sm:flex-initial items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 px-3 py-2 min-w-0">
                                    <Calendar size={16} className="text-slate-400 shrink-0" />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                                    />
                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {resolvedTab === 'sales' && (
                        <SalesReports
                            facilityId={effectiveFacilityId}
                            startDate={startDate}
                            endDate={endDate}
                            view={salesView}
                        />
                    )}
                    {resolvedTab === 'stock' && (
                        <StockReports facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'fast-moving' && (
                        <FastSlowMovingReport facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'tax' && (
                        <TaxReports
                            facilityId={effectiveFacilityId}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    )}
                    {resolvedTab === 'customer' && (
                        <LoyaltyReports facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'purchase' && (
                        <PurchaseReport
                            facilityId={effectiveFacilityId}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    )}
                    {resolvedTab === 'performance' && (
                        <PerformanceReports
                            facilityId={effectiveFacilityId}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    )}
                </div>

                {moreMenuOpen &&
                    moreMenuPlacement &&
                    createPortal(
                        <div
                            ref={morePanelRef}
                            style={{
                                position: 'fixed',
                                right: moreMenuPlacement.right,
                                width: moreMenuPlacement.width,
                                maxHeight: moreMenuPlacement.maxHeight,
                                ...(moreMenuPlacement.placeAbove
                                    ? { bottom: moreMenuPlacement.bottom, top: 'auto' }
                                    : { top: moreMenuPlacement.top, bottom: 'auto' }),
                            }}
                            className={cn(
                                'z-[300] flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-600',
                                'bg-white dark:bg-slate-900 shadow-xl shadow-slate-300/25 dark:shadow-black/50',
                                'overflow-hidden',
                                moreMenuPlacement.placeAbove
                                    ? 'origin-bottom-right animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200'
                                    : 'origin-top-right animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200',
                            )}
                            role="menu"
                        >
                            <div className="shrink-0 px-3 pt-3 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Open report
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    Tax, team, customers, or replenishment
                                </p>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                                {SECONDARY_REPORT_ACTIONS.map((item) => {
                                    const Icon = item.icon;
                                    const isActive =
                                        item.tab !== '_replenish' && resolvedTab === item.tab;
                                    return (
                                        <Link
                                            key={item.tab}
                                            to={item.to as any}
                                            search={{} as any}
                                            role="menuitem"
                                            onClick={() => setMoreMenuOpen(false)}
                                            className={cn(
                                                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-healthcare-primary/40',
                                                isActive
                                                    ? 'bg-healthcare-primary/12 dark:bg-healthcare-primary/20 text-healthcare-primary'
                                                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/90',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                                    isActive
                                                        ? 'bg-healthcare-primary text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                                                )}
                                            >
                                                <Icon size={18} strokeWidth={2} />
                                            </span>
                                            <span className="min-w-0 text-left">
                                                <span className="block text-sm font-bold leading-tight">
                                                    {item.label}
                                                </span>
                                                <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
                                                    {item.hint}
                                                </span>
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>,
                        document.body,
                    )}

                {exportMenuOpen &&
                    exportMenuPlacement &&
                    canExport &&
                    createPortal(
                        <div
                            ref={exportPanelRef}
                            style={{
                                position: 'fixed',
                                right: exportMenuPlacement.right,
                                width: exportMenuPlacement.width,
                                ...(exportMenuPlacement.placeAbove
                                    ? { bottom: exportMenuPlacement.bottom, top: 'auto' }
                                    : { top: exportMenuPlacement.top, bottom: 'auto' }),
                            }}
                            className={cn(
                                'z-[300] rounded-xl border border-slate-200 dark:border-slate-600',
                                'bg-white dark:bg-slate-900 shadow-xl overflow-hidden py-1',
                                exportMenuPlacement.placeAbove
                                    ? 'origin-bottom-right animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200'
                                    : 'origin-top-right animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200',
                            )}
                            role="menu"
                        >
                            <button
                                type="button"
                                role="menuitem"
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                                onClick={() => handleExport('excel')}
                            >
                                Download Excel
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                                onClick={() => handleExport('pdf')}
                            >
                                Download PDF
                            </button>
                        </div>,
                        document.body,
                    )}
            </div>
        </ProtectedRoute>
    );
}

function PerformanceReports({
    facilityId,
    startDate,
    endDate,
}: {
    facilityId?: number;
    startDate: string;
    endDate: string;
}) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const res = await pharmacyService.getEmployeePerformanceReport(facilityId, {
                    start_date: startDate,
                    end_date: endDate,
                });
                setData(res);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, startDate, endDate]);

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={1}
                headers={null}
                className="border-none shadow-none"
            />
        );

    return (
        <div className="space-y-6">
            <PerformanceChart data={data?.performers || []} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-healthcare-dark dark:text-white uppercase text-xs tracking-widest">
                        Staff Efficiency
                    </h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="tc-table w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                <th className="px-6 py-3 font-semibold">Staff Member</th>
                                <th className="px-6 py-3 font-semibold text-right">Transactions</th>
                                <th className="px-6 py-3 font-semibold text-right">Total Sales</th>
                                <th className="px-6 py-3 font-semibold text-right">
                                    Avg Bill Value
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {data?.performers?.map((p: any) => (
                                <tr key={p.employee_id}>
                                    <td className="px-6 py-4 font-black text-healthcare-dark dark:text-white">
                                        {p.employee_name}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-500">
                                        {p.transaction_count}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-500 font-bold">
                                        RWF {p.total_sales.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-healthcare-primary">
                                        RWF {p.average_transaction_value.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function LoyaltyReports({ facilityId }: { facilityId?: number }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const res = await pharmacyService.getCustomerLoyaltyReport(facilityId);
                setData(res);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId]);

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={1}
                headers={null}
                className="border-none shadow-none"
            />
        );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-healthcare-primary/5 rounded-2xl border border-healthcare-primary/10">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
                        Total Unique Patients
                    </p>
                    <p className="text-4xl font-black text-healthcare-primary">
                        {data?.total_patients || 0}
                    </p>
                </div>
                <div className="p-6 bg-teal-500/5 rounded-2xl border border-teal-500/10">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
                        Repeat Customers
                    </p>
                    <p className="text-4xl font-black text-teal-600">
                        {data?.repeat_customers || 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        ({((data?.repeat_customers / data?.total_patients) * 100 || 0).toFixed(1)}%
                        loyalty rate)
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-healthcare-dark dark:text-white uppercase text-xs tracking-widest">
                        Top Patients
                    </h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="tc-table w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                <th className="px-6 py-3 font-semibold">Patient</th>
                                <th className="px-6 py-3 font-semibold text-right">Visits</th>
                                <th className="px-6 py-3 font-semibold text-right">Total Spent</th>
                                <th className="px-6 py-3 font-semibold text-right">Last Visit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {data?.top_patients?.map((p: any) => (
                                <tr key={p.patient_id}>
                                    <td className="px-6 py-4 font-black text-healthcare-dark dark:text-white whitespace-nowrap">
                                        {p.patient_name}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-500">
                                        {p.visit_count}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-healthcare-primary">
                                        RWF {p.total_spent.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-400 text-[10px]">
                                        {formatLocalDate(p.last_visit)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function TaxReports({
    facilityId,
    startDate,
    endDate,
}: {
    facilityId?: number;
    startDate: string;
    endDate: string;
}) {
    const [loading, setLoading] = useState(false);
    const [taxData, setTaxData] = useState<any | null>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const tax = await pharmacyService.getTaxSummary(facilityId, {
                    start_date: startDate,
                    end_date: endDate,
                });
                setTaxData(tax);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, startDate, endDate]);

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={1}
                headers={null}
                className="border-none shadow-none"
            />
        );

    return (
        <div className="space-y-8">
            <TaxSummaryTable
                data={taxData?.tax_details || []}
                totalTaxable={taxData?.total_taxable_amount || 0}
                totalVat={taxData?.total_vat_amount || 0}
            />
        </div>
    );
}

function SalesReports({
    facilityId,
    startDate,
    endDate,
    view,
}: {
    facilityId?: number;
    startDate?: string;
    endDate?: string;
    view: SalesReportView;
}) {
    const [loading, setLoading] = useState(false);
    const [sales, setSales] = useState<any | null>(null);
    const [profit, setProfit] = useState<any | null>(null);
    const [purchaseVsSales, setPurchaseVsSales] = useState<any | null>(null);
    const [medicineMargin, setMedicineMargin] = useState<any | null>(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState<any>(null);

    useEffect(() => {
        if (!facilityId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [salesResult, profitResult, purchaseVsSalesResult, medicineMarginResult] =
                    await Promise.allSettled([
                        pharmacyService.getSalesReport(facilityId, {
                            start_date: startDate,
                            end_date: endDate,
                        }),
                        pharmacyService.getProfitReport(facilityId, {
                            start_date: startDate,
                            end_date: endDate,
                        }),
                        pharmacyService.getPurchaseVsSalesReport(facilityId, {
                            start_date: startDate || '',
                            end_date: endDate || '',
                        }),
                        pharmacyService.getMedicineMarginReport(facilityId, {
                            start_date: startDate || '',
                            end_date: endDate || '',
                        }),
                    ]);

                if (salesResult.status === 'fulfilled') {
                    setSales(salesResult.value);
                } else {
                    throw salesResult.reason;
                }

                if (profitResult.status === 'fulfilled') {
                    setProfit(profitResult.value);
                } else {
                    setProfit(null);
                }

                if (purchaseVsSalesResult?.status === 'fulfilled') {
                    setPurchaseVsSales(purchaseVsSalesResult.value);
                } else {
                    setPurchaseVsSales(null);
                }

                if (medicineMarginResult?.status === 'fulfilled') {
                    setMedicineMargin(medicineMarginResult.value);
                } else {
                    setMedicineMargin(null);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [facilityId, startDate, endDate]);

    const formatReportCurrency = (value: number) =>
        `RWF ${Math.round(Number(value || 0)).toLocaleString()}`;

    const groupedSalesTransactions = useMemo(() => {
        const grouped = sales?.transactions?.reduce((acc: any, t: any) => {
            if (!acc[t.transaction_number]) {
                acc[t.transaction_number] = {
                    ...t,
                    medicines: [t.medicine_name],
                    total: t.total_amount,
                    items: [t],
                };
            } else {
                acc[t.transaction_number].medicines.push(t.medicine_name);
                acc[t.transaction_number].total += t.total_amount;
                acc[t.transaction_number].items.push(t);
            }
            return acc;
        }, {});

        return Object.values(grouped || {});
    }, [sales]);

    const purchaseVsSalesTimeline = useMemo(
        () => (Array.isArray(purchaseVsSales?.timeline) ? purchaseVsSales.timeline : []),
        [purchaseVsSales],
    );

    const purchaseVsSalesSummary = useMemo(() => {
        const purchaseAmount = Number(purchaseVsSales?.totals?.purchase_amount || 0);
        const salesAmount = Number(purchaseVsSales?.totals?.sales_amount || 0);
        const varianceAmount = Number(purchaseVsSales?.totals?.variance_amount || 0);
        const salesCoverage = purchaseAmount > 0 ? (salesAmount / purchaseAmount) * 100 : 0;

        return {
            purchaseAmount,
            salesAmount,
            varianceAmount,
            salesCoverage,
        };
    }, [purchaseVsSales]);

    const medicineMarginItems = useMemo(
        () => (Array.isArray(medicineMargin?.items) ? medicineMargin.items : []),
        [medicineMargin],
    );

    const medicineMarginSummary = useMemo(() => {
        const totalRevenue = medicineMarginItems.reduce(
            (sum: number, row: any) => sum + Number(row.revenue || 0),
            0,
        );
        const totalCogs = medicineMarginItems.reduce(
            (sum: number, row: any) => sum + Number(row.cogs || 0),
            0,
        );
        const totalProfit = totalRevenue - totalCogs;
        const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalCogs,
            totalProfit,
            averageMargin,
            itemCount: medicineMarginItems.length,
        };
    }, [medicineMarginItems]);

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={6}
                headers={['Date', 'Receipt #', 'Medicine', 'Qty', 'Total']}
                columnAligns={['left', 'left', 'left', 'right', 'right', 'right']}
                actions
                className="border-none shadow-none"
            />
        );

    return (
        <div className="space-y-4">
            {view === 'general' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <SummaryCard
                            title="Gross profit"
                            value={`RWF ${Number(profit?.profit || 0).toLocaleString()}`}
                            trend="—"
                            icon={<TrendingUp size={20} />}
                        />
                        <SummaryCard
                            title="Profit Margin"
                            value={`${(Number(profit?.profit_margin || 0) * 100).toFixed(1)}%`}
                            trend="—"
                            icon={<Activity size={20} />}
                        />
                        <SummaryCard
                            title="Total Revenue"
                            value={`RWF ${Number(profit?.revenue || 0).toLocaleString()}`}
                            trend="—"
                            icon={<DollarSign size={20} />}
                        />
                    </div>

                    <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="tc-table w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                    <th className="px-6 py-3 font-semibold">Date</th>
                                    <th className="px-6 py-3 font-semibold">Receipt #</th>
                                    <th className="px-6 py-3 font-semibold">Medicine</th>
                                    <th className="px-6 py-3 font-semibold text-right">Qty</th>
                                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {groupedSalesTransactions.map((t: any) => (
                                    <tr
                                        key={t.transaction_number}
                                        className="hover:bg-slate-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                            {formatLocalDate(t.date)}
                                        </td>
                                        <td className="px-6 py-4 font-black text-healthcare-primary text-xs tracking-tighter uppercase">
                                            {t.transaction_number}
                                        </td>
                                        <td className="px-6 py-4 font-black text-healthcare-dark dark:text-white">
                                            <div className="flex flex-col">
                                                <span>{t.medicines[0]}</span>
                                                {t.medicines.length > 1 && (
                                                    <span className="text-[10px] text-slate-400">
                                                        + {t.medicines.length - 1} more items
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-500">
                                            {t.items.reduce(
                                                (sum: number, item: any) => sum + item.quantity,
                                                0,
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-healthcare-primary">
                                            RWF {t.total.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={async () => {
                                                        if (facilityId) {
                                                            await pharmacyService.getSaleReceipt(
                                                                t.sale_id,
                                                                facilityId,
                                                            );
                                                        }
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors border border-blue-100"
                                                >
                                                    <Download size={12} /> Receipt
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const details =
                                                            await pharmacyService.getSale(t.sale_id);
                                                        setSelectedSale(details);
                                                        setIsReturnModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase hover:bg-rose-100 transition-colors border border-rose-100"
                                                >
                                                    <RotateCcw size={12} /> Return
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {view === 'purchase-vs-sales' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Purchases
                            </p>
                            <p className="mt-2 text-lg font-black text-slate-800 dark:text-slate-50">
                                {formatReportCurrency(purchaseVsSalesSummary.purchaseAmount)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Total procurement value
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Sales
                            </p>
                            <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-300">
                                {formatReportCurrency(purchaseVsSalesSummary.salesAmount)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Revenue generated
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Variance
                            </p>
                            <p
                                className={cn(
                                    'mt-2 text-lg font-black',
                                    purchaseVsSalesSummary.varianceAmount >= 0
                                        ? 'text-sky-600 dark:text-sky-300'
                                        : 'text-rose-600 dark:text-rose-300',
                                )}
                            >
                                {formatReportCurrency(purchaseVsSalesSummary.varianceAmount)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Sales minus purchases
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Sales Coverage
                            </p>
                            <p className="mt-2 text-lg font-black text-violet-600 dark:text-violet-300">
                                {purchaseVsSalesSummary.salesCoverage.toFixed(1)}%
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Revenue vs procurement cost
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl">
                        <div className="max-h-[min(560px,55vh)] overflow-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                            <table className="tc-table min-w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                                    <tr className="text-slate-400 uppercase">
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-right">Purchase</th>
                                        <th className="px-4 py-3 text-right">Sales</th>
                                        <th className="px-4 py-3 text-right">Variance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {purchaseVsSalesTimeline.length === 0 ? (
                                        <tr
                                            className="bg-white dark:bg-slate-950"
                                        >
                                            <td
                                                colSpan={4}
                                                className="px-4 py-14 text-center text-sm font-bold text-slate-500 dark:text-slate-400"
                                            >
                                                No purchase vs sales data found for this date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        purchaseVsSalesTimeline.map((row: any) => (
                                            <tr
                                                key={row.date}
                                                className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/70"
                                            >
                                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-100">
                                                    {row.date}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                    {formatReportCurrency(
                                                        Number(row.purchase_amount || 0),
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-300">
                                                    {formatReportCurrency(
                                                        Number(row.sales_amount || 0),
                                                    )}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'px-4 py-3 text-right font-black',
                                                        Number(row.variance_amount || 0) >= 0
                                                            ? 'text-sky-600 dark:text-sky-300'
                                                            : 'text-rose-600 dark:text-rose-300',
                                                    )}
                                                >
                                                    {formatReportCurrency(
                                                        Number(row.variance_amount || 0),
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {view === 'medicine-margin' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Revenue
                            </p>
                            <p className="mt-2 text-lg font-black text-slate-800 dark:text-slate-50">
                                {formatReportCurrency(medicineMarginSummary.totalRevenue)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Total medicine revenue
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                COGS
                            </p>
                            <p className="mt-2 text-lg font-black text-amber-600 dark:text-amber-300">
                                {formatReportCurrency(medicineMarginSummary.totalCogs)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Cost of goods sold
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Gross Profit
                            </p>
                            <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-300">
                                {formatReportCurrency(medicineMarginSummary.totalProfit)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Revenue minus COGS
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Avg Margin
                            </p>
                            <p className="mt-2 text-lg font-black text-violet-600 dark:text-violet-300">
                                {medicineMarginSummary.averageMargin.toFixed(1)}%
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Weighted margin rate
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl">
                        <div className="max-h-[min(680px,60vh)] overflow-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                            <table className="tc-table min-w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                                    <tr className="text-slate-400 uppercase">
                                        <th className="px-4 py-3 text-left">Medicine</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-right">Revenue</th>
                                        <th className="px-4 py-3 text-right">COGS</th>
                                        <th className="px-4 py-3 text-right">Profit</th>
                                        <th className="px-4 py-3 text-right">Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {medicineMarginItems.length === 0 ? (
                                        <tr className="bg-white dark:bg-slate-950">
                                            <td
                                                colSpan={6}
                                                className="px-4 py-14 text-center text-sm font-bold text-slate-500 dark:text-slate-400"
                                            >
                                                No medicine margin data found for this date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        medicineMarginItems.map((row: any) => {
                                            const profitValue =
                                                Number(row.revenue || 0) - Number(row.cogs || 0);
                                            const marginPercent = Number(
                                                row.profit_margin_percent || 0,
                                            );

                                            return (
                                                <tr
                                                    key={row.medicine_id}
                                                    className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/70"
                                                >
                                                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-100">
                                                        {row.medicine_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                        {Number(row.quantity_sold || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                        {formatReportCurrency(Number(row.revenue || 0))}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                        {formatReportCurrency(Number(row.cogs || 0))}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-4 py-3 text-right font-bold',
                                                            profitValue >= 0
                                                                ? 'text-emerald-600 dark:text-emerald-300'
                                                                : 'text-rose-600 dark:text-rose-300',
                                                        )}
                                                    >
                                                        {formatReportCurrency(profitValue)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span
                                                            className={cn(
                                                                'inline-flex min-w-[74px] justify-center rounded-full px-2.5 py-1 text-[10px] font-black',
                                                                marginPercent >= 25
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                    : marginPercent >= 10
                                                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                                                            )}
                                                        >
                                                            {marginPercent.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {isReturnModalOpen && selectedSale && (
                <CreateReturnModal
                    sale={selectedSale}
                    onClose={() => setIsReturnModalOpen(false)}
                    onSuccess={() => {}}
                />
            )}
        </div>
    );
}

function StockReports({ facilityId }: { facilityId?: number }) {
    type InventoryStatus = 'in_stock' | 'low_stock' | 'expiring_soon' | 'expired' | 'out_of_stock';
    type StockSummary = {
        total_medicines: number;
        low_stock_count: number;
        expiring_batches_count: number;
        total_value: number;
    };
    type SortOption = 'name_asc' | 'stock_desc' | 'stock_asc' | 'expiry_soonest' | 'value_desc';
    type DetailedInventoryRow = Medicine & {
        status: InventoryStatus;
        days_to_expiry: number | null;
        inventory_value: number;
        is_expired: boolean;
        is_low_stock: boolean;
        is_out_of_stock: boolean;
        is_expiring_soon: boolean;
    };

    const [loading, setLoading] = useState(false);
    const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [lowStockMedicineIds, setLowStockMedicineIds] = useState<number[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | InventoryStatus>('all');
    const [dosageFormFilter, setDosageFormFilter] = useState('all');
    const [expiryWindowDays, setExpiryWindowDays] = useState(90);
    const [sortBy, setSortBy] = useState<SortOption>('name_asc');
    const [rowLimit, setRowLimit] = useState(50);
    const stockTableRef = useRef<HTMLDivElement | null>(null);
    const [stockScrollTop, setStockScrollTop] = useState(0);
    const [stockViewportHeight, setStockViewportHeight] = useState(0);

    useEffect(() => {
        if (!facilityId) return;

        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const fetchAllMedicines = async (facility: number): Promise<Medicine[]> => {
                    const pageSize = 200;
                    const all: Medicine[] = [];
                    let page = 1;
                    let totalPages = 1;

                    while (page <= totalPages) {
                        const response = await pharmacyService.getMedicines({
                            facility_id: facility,
                            page,
                            limit: pageSize,
                            sort_by: 'expiry_date',
                        });
                        all.push(...(response.data || []));
                        totalPages = response.meta?.totalPages || 1;
                        page += 1;
                    }

                    return all;
                };

                const [summary, allMedicines, lowStockReport] = await Promise.all([
                    pharmacyService.getStockReport(facilityId),
                    fetchAllMedicines(facilityId),
                    pharmacyService.getLowStockReport(facilityId),
                ]);

                if (!active) return;

                const ids = Array.from(
                    new Set(
                        (lowStockReport?.items || [])
                            .map((item) => Number(item.medicine_id))
                            .filter((id) => Number.isFinite(id)),
                    ),
                );

                setStockSummary(summary);
                setMedicines(allMedicines);
                setLowStockMedicineIds(ids);
            } catch (error) {
                console.error('Failed to load stock report details:', error);
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [facilityId]);

    const lowStockIdSet = useMemo(() => new Set(lowStockMedicineIds), [lowStockMedicineIds]);

    const detailedRows = useMemo<DetailedInventoryRow[]>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return medicines.map((medicine) => {
            const stockQty = Number(medicine.stock_quantity || 0);
            const costPrice = Number(medicine.cost_price || 0);
            const inventoryValue = stockQty * costPrice;

            let daysToExpiry: number | null = null;
            if (medicine.expiry_date) {
                const expiryDate = parseLocalDate(medicine.expiry_date);
                if (!Number.isNaN(expiryDate.getTime())) {
                    expiryDate.setHours(0, 0, 0, 0);
                    daysToExpiry = Math.ceil(
                        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );
                }
            }

            const isExpired = daysToExpiry !== null && daysToExpiry < 0;
            const isOutOfStock = stockQty <= 0;
            const isLowStock = lowStockIdSet.has(medicine.id);
            const isExpiringSoon =
                daysToExpiry !== null &&
                daysToExpiry >= 0 &&
                daysToExpiry <= expiryWindowDays &&
                !isExpired;

            let status: InventoryStatus = 'in_stock';
            if (isExpired) {
                status = 'expired';
            } else if (isOutOfStock) {
                status = 'out_of_stock';
            } else if (isLowStock) {
                status = 'low_stock';
            } else if (isExpiringSoon) {
                status = 'expiring_soon';
            }

            return {
                ...medicine,
                status,
                days_to_expiry: daysToExpiry,
                inventory_value: inventoryValue,
                is_expired: isExpired,
                is_low_stock: isLowStock,
                is_out_of_stock: isOutOfStock,
                is_expiring_soon: isExpiringSoon,
            };
        });
    }, [expiryWindowDays, lowStockIdSet, medicines]);

    const dosageForms = useMemo(() => {
        return [
            'all',
            ...Array.from(
                new Set(
                    medicines
                        .map((med) => med.dosage_form?.toLowerCase())
                        .filter((value): value is string => Boolean(value)),
                ),
            ),
        ];
    }, [medicines]);

    const filteredRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const rows = detailedRows.filter((row) => {
            const matchesSearch =
                !q ||
                row.name.toLowerCase().includes(q) ||
                row.code.toLowerCase().includes(q) ||
                (row.brand_name || '').toLowerCase().includes(q);

            const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
            const matchesDosage =
                dosageFormFilter === 'all' ||
                (row.dosage_form || '').toLowerCase() === dosageFormFilter;

            return matchesSearch && matchesStatus && matchesDosage;
        });

        rows.sort((a, b) => {
            if (sortBy === 'stock_desc') {
                return Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);
            }
            if (sortBy === 'stock_asc') {
                return Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0);
            }
            if (sortBy === 'expiry_soonest') {
                const left = a.days_to_expiry ?? Number.POSITIVE_INFINITY;
                const right = b.days_to_expiry ?? Number.POSITIVE_INFINITY;
                return left - right;
            }
            if (sortBy === 'value_desc') {
                return b.inventory_value - a.inventory_value;
            }
            return a.name.localeCompare(b.name);
        });

        return rows;
    }, [detailedRows, dosageFormFilter, searchQuery, sortBy, statusFilter]);

    const visibleRows = useMemo(
        () => filteredRows.slice(0, Math.max(1, rowLimit)),
        [filteredRows, rowLimit],
    );

    const shouldVirtualizeRows = visibleRows.length >= 80;
    const stockRowHeight = 54;
    const stockOverscan = 6;
    const stockStartIndex = shouldVirtualizeRows
        ? Math.max(0, Math.floor(stockScrollTop / stockRowHeight) - stockOverscan)
        : 0;
    const stockVisibleRowCount = shouldVirtualizeRows
        ? Math.ceil((stockViewportHeight || 560) / stockRowHeight) + stockOverscan * 2
        : visibleRows.length;
    const stockEndIndex = shouldVirtualizeRows
        ? Math.min(visibleRows.length, stockStartIndex + stockVisibleRowCount)
        : visibleRows.length;
    const renderedRows = shouldVirtualizeRows
        ? visibleRows.slice(stockStartIndex, stockEndIndex)
        : visibleRows;
    const stockTopSpacerHeight = shouldVirtualizeRows ? stockStartIndex * stockRowHeight : 0;
    const stockBottomSpacerHeight = shouldVirtualizeRows
        ? Math.max(0, (visibleRows.length - stockEndIndex) * stockRowHeight)
        : 0;

    useEffect(() => {
        const updateViewport = () => {
            if (stockTableRef.current) {
                setStockViewportHeight(stockTableRef.current.clientHeight);
            }
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [stockTableRef]);

    useEffect(() => {
        setStockScrollTop(0);
        if (stockTableRef.current) {
            stockTableRef.current.scrollTop = 0;
        }
    }, [searchQuery, statusFilter, dosageFormFilter, expiryWindowDays, sortBy, rowLimit]);

    const statusCounts = useMemo(() => {
        return detailedRows.reduce<Record<InventoryStatus, number>>(
            (acc, row) => {
                acc[row.status] += 1;
                return acc;
            },
            {
                in_stock: 0,
                low_stock: 0,
                expiring_soon: 0,
                expired: 0,
                out_of_stock: 0,
            },
        );
    }, [detailedRows]);

    const filteredInventoryValue = useMemo(
        () => filteredRows.reduce((sum, row) => sum + row.inventory_value, 0),
        [filteredRows],
    );

    const statusLabel: Record<InventoryStatus, string> = {
        in_stock: 'In Stock',
        low_stock: 'Low Stock',
        expiring_soon: 'Expiring Soon',
        expired: 'Expired',
        out_of_stock: 'Out of Stock',
    };

    const statusClassName: Record<InventoryStatus, string> = {
        in_stock: 'bg-teal-50 text-teal-700 border-teal-100',
        low_stock: 'bg-amber-50 text-amber-700 border-amber-100',
        expiring_soon: 'bg-orange-50 text-orange-700 border-orange-100',
        expired: 'bg-rose-50 text-rose-700 border-rose-100',
        out_of_stock: 'bg-red-50 text-red-700 border-red-100',
    };

    if (loading) {
        return (
            <SkeletonTable
                rows={8}
                columns={10}
                headers={[
                    'Medicine',
                    'Code',
                    'Form',
                    'Stock',
                    'Cost',
                    'Value',
                    'Expiry Date',
                    'Days Left',
                    'Status',
                    'Date Added',
                ]}
                className="border-none shadow-none"
            />
        );
    }

    return (
        <div className="space-y-6">
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <SummaryCard
                            title="Total Valuation"
                            value={`RWF ${Number(stockSummary?.total_value || 0).toLocaleString()}`}
                            trend="Inventory value"
                            icon={<DollarSign size={16} />}
                        />
                        <SummaryCard
                            title="SKU Count"
                            value={`${Number(stockSummary?.total_medicines || detailedRows.length)}`}
                            trend="Tracked medicines"
                            icon={<Package size={16} />}
                            color="teal"
                        />
                        <SummaryCard
                            title="Low Stock"
                            value={`${Number(stockSummary?.low_stock_count || statusCounts.low_stock)}`}
                            trend="Reorder candidates"
                            icon={<AlertTriangle size={16} />}
                            color="amber"
                        />
                        <SummaryCard
                            title="Expiring / Expired"
                            value={`${statusCounts.expiring_soon + statusCounts.expired}`}
                            trend={`${expiryWindowDays}d window`}
                            icon={<AlertTriangle size={16} />}
                            color="rose"
                        />
                        <SummaryCard
                            title="Out of Stock"
                            value={`${statusCounts.out_of_stock}`}
                            trend="Immediate action"
                            icon={<Package size={16} />}
                            color="rose"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                            <div className="relative md:col-span-2 xl:col-span-2">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by medicine, code, brand..."
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-healthcare-primary/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as 'all' | InventoryStatus)
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="all">All Status</option>
                                <option value="in_stock">In Stock</option>
                                <option value="low_stock">Low Stock</option>
                                <option value="expiring_soon">Expiring Soon</option>
                                <option value="expired">Expired</option>
                                <option value="out_of_stock">Out of Stock</option>
                            </select>

                            <select
                                value={dosageFormFilter}
                                onChange={(e) => setDosageFormFilter(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                {dosageForms.map((form) => (
                                    <option key={form} value={form}>
                                        {form === 'all' ? 'All Forms' : form}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={String(expiryWindowDays)}
                                onChange={(e) => setExpiryWindowDays(Number(e.target.value))}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="30">Expiry Window: 30d</option>
                                <option value="60">Expiry Window: 60d</option>
                                <option value="90">Expiry Window: 90d</option>
                                <option value="180">Expiry Window: 180d</option>
                            </select>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="name_asc">Sort: Name</option>
                                <option value="stock_desc">Sort: Stock High-Low</option>
                                <option value="stock_asc">Sort: Stock Low-High</option>
                                <option value="expiry_soonest">Sort: Earliest Expiry</option>
                                <option value="value_desc">Sort: Value High-Low</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">
                                <span>
                                    Showing {visibleRows.length} / {filteredRows.length} filtered items
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>Total Inventory: {detailedRows.length}</span>
                                <span className="text-slate-300">•</span>
                                <span>
                                    Filtered Value: RWF {filteredInventoryValue.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={String(rowLimit)}
                                    onChange={(e) => setRowLimit(Number(e.target.value))}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    <option value="25">25 rows</option>
                                    <option value="50">50 rows</option>
                                    <option value="100">100 rows</option>
                                    <option value="200">200 rows</option>
                                    <option value="500">500 rows</option>
                                </select>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('all');
                                        setDosageFormFilter('all');
                                        setExpiryWindowDays(90);
                                        setSortBy('name_asc');
                                        setRowLimit(50);
                                    }}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>

                        <div
                            ref={stockTableRef}
                            onScroll={(event) => setStockScrollTop(event.currentTarget.scrollTop)}
                            className="max-h-[560px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800"
                        >
                            <table className="tc-table w-full whitespace-nowrap text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                        <th className="px-4 py-3 font-semibold">Medicine</th>
                                        <th className="px-4 py-3 font-semibold">Code</th>
                                        <th className="px-4 py-3 font-semibold">Form</th>
                                        <th className="px-4 py-3 text-right font-semibold">Stock</th>
                                        <th className="px-4 py-3 text-right font-semibold">Cost</th>
                                        <th className="px-4 py-3 text-right font-semibold">Value</th>
                                        <th className="px-4 py-3 text-center font-semibold">Expiry</th>
                                        <th className="px-4 py-3 text-center font-semibold">Days Left</th>
                                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                                        <th className="px-4 py-3 text-center font-semibold">Date Added</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {visibleRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-12 text-center">
                                                <p className="text-sm font-bold text-slate-500">
                                                    No inventory items match the selected filters.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {shouldVirtualizeRows && stockTopSpacerHeight > 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={10}
                                                        style={{ height: `${stockTopSpacerHeight}px` }}
                                                    />
                                                </tr>
                                            )}
                                            {renderedRows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="font-black text-slate-800 dark:text-white">
                                                            {row.name}
                                                        </div>
                                                        <div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                            {row.brand_name || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-600 dark:text-slate-300">
                                                        {row.code}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-600 dark:text-slate-300">
                                                        {row.dosage_form || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-black text-slate-800 dark:text-white">
                                                        {Number(row.stock_quantity || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-slate-600 dark:text-slate-300">
                                                        RWF {Number(row.cost_price || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-black text-healthcare-primary">
                                                        RWF {Number(row.inventory_value || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center font-semibold text-slate-600 dark:text-slate-300">
                                                        {row.expiry_date
                                                            ? formatLocalDate(row.expiry_date)
                                                            : 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center font-semibold">
                                                        {row.days_to_expiry === null ? (
                                                            <span className="text-slate-400">—</span>
                                                        ) : row.days_to_expiry < 0 ? (
                                                            <span className="text-rose-600">
                                                                {Math.abs(row.days_to_expiry)}d overdue
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-700 dark:text-slate-200">
                                                                {row.days_to_expiry}d
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        <span
                                                            className={cn(
                                                                'whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider',
                                                                statusClassName[row.status],
                                                            )}
                                                        >
                                                            {statusLabel[row.status]}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                        {row.created_at
                                                            ? formatLocalDate(row.created_at)
                                                            : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                            {shouldVirtualizeRows && stockBottomSpacerHeight > 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={10}
                                                        style={{ height: `${stockBottomSpacerHeight}px` }}
                                                    />
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
        </div>
    );
}

function SummaryCard({ title, value, trend, icon, color = 'teal', borderless = false }: any) {
    return (
        <div
            className={cn(
                'tc-stat-card tc-stat-card-neutral group hover:shadow-lg',
                borderless && 'border-0 shadow-sm',
            )}
        >
            <div className="tc-stat-card-header">
                <p className="tc-stat-card-title">{title}</p>
                <span
                    className={cn(
                        'tc-stat-card-icon transition-transform group-hover:scale-110',
                        color === 'teal'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                            : color === 'amber'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
                    )}
                >
                    {icon}
                </span>
            </div>
            <div className="tc-stat-card-foot">
                <h3
                    className={cn(
                        'tc-stat-card-value text-sm',
                        color === 'teal'
                            ? 'text-[#2563EB] dark:text-blue-300'
                            : color === 'amber'
                              ? 'text-[#D97706] dark:text-amber-300'
                              : 'text-[#DC2626] dark:text-rose-300',
                    )}
                >
                    {value}
                </h3>
                <p className="tc-stat-card-subtitle">{trend}</p>
            </div>
        </div>
    );
}
