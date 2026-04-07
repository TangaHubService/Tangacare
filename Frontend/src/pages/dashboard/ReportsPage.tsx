import { useEffect, useMemo, useRef, useState } from 'react';
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

import { ReorderSuggestions } from '../../components/pharmacy/reports/ReorderSuggestions';
import { ExpiryReport } from '../../components/pharmacy/reports/ExpiryReport';
import { CreateReturnModal } from '../../components/pharmacy/returns/CreateReturnModal';
import { ABCAnalysisReport } from '../../components/pharmacy/reports/ABCAnalysisReport';
import { PurchaseReport } from '../../components/pharmacy/reports/PurchaseReport';
import { FastSlowMovingReport } from '../../components/pharmacy/reports/FastSlowMovingReport';
import { DemandForecastReport } from '../../components/pharmacy/reports/DemandForecastReport';
import { NearExpiryActionsReport } from '../../components/pharmacy/reports/NearExpiryActionsReport';
import { ForecastReorderReport } from '../../components/pharmacy/reports/ForecastReorderReport';
import { ParReplenishmentReport } from '../../components/pharmacy/reports/ParReplenishmentReport';
import { StockMovementsPage } from './StockMovementsPage';
import type { Medicine } from '../../types/pharmacy';
import { toast } from 'react-hot-toast';

export interface ReportsPageProps {
    defaultTab?: string;
}

const VALID_REPORT_TABS = new Set([
    'sales',
    'stock',
    'low-stock',
    'movement',
    'purchase',
    'expiry',
    'near-expiry-actions',
    'fast-moving',
    'demand-forecast',
    'forecast-reorder',
    'par',
    'performance',
    'customer',
    'tax',
]);

const SUBTAB_ALIASES: Record<string, string> = {
    returns: 'sales',
    profit: 'sales',
    reorder: 'low-stock',
    recall: 'expiry',
    'stock-movement': 'movement',
    'stock-movements-history': 'movement',
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
    if (n === 'inventory-intelligence') return 'expiry';
    if (n === 'business-compliance') return 'performance';
    if (VALID_REPORT_TABS.has(n)) return n;
    return 'sales';
}

const EXPIRY_WINDOW_PRESETS = [30, 60, 90, 120, 180] as const;
const NEAR_EXPIRY_HORIZON_PRESETS = [30, 45, 60, 90, 100, 110, 120, 180, 365] as const;

export function ReportsPage({ defaultTab = 'sales' }: ReportsPageProps) {
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;

    const SUBTAB_LABELS: Record<string, string> = {
        sales: 'Sales',
        stock: 'Stock',
        'low-stock': 'Low Stock',
        expiry: 'Expiry',
        movement: 'Movements',
        'fast-moving': 'Fast/Slow',
        'demand-forecast': 'Demand Forecast',
        'forecast-reorder': 'Forecast Reorder',
        'near-expiry-actions': 'Near-Expiry Actions',
        par: 'PAR Replenishment',
        purchase: 'Purchase',
        performance: 'Performance',
        customer: 'Customers',
        tax: 'Tax',
    };

    const resolvedTab = useMemo(() => resolveReportTab(defaultTab), [defaultTab]);

    const [expiryDays, setExpiryDays] = useState(30);
    const [nearExpiryActionDays, setNearExpiryActionDays] = useState(90);

    const expiryWindowSelectOptions = useMemo(() => {
        const merged = new Set<number>([...EXPIRY_WINDOW_PRESETS, expiryDays]);
        return Array.from(merged).sort((a, b) => a - b);
    }, [expiryDays]);

    const nearExpiryHorizonSelectOptions = useMemo(() => {
        const merged = new Set<number>([...NEAR_EXPIRY_HORIZON_PRESETS, nearExpiryActionDays]);
        return Array.from(merged).sort((a, b) => a - b);
    }, [nearExpiryActionDays]);

    const getExportType = (
        tab: string,
    ):
        | 'sales'
        | 'stock'
        | 'low-stock'
        | 'expiry'
        | 'movement'
        | 'fast-moving'
        | 'demand-forecast'
        | 'forecast-reorder'
        | 'near-expiry-actions'
        | 'par'
        | 'purchase'
        | 'performance'
        | 'customer'
        | 'tax'
        | null => {
        if (tab === 'sales') return 'sales';
        if (tab === 'stock') return 'stock';
        if (tab === 'low-stock') return 'low-stock';
        if (tab === 'expiry') return 'expiry';
        if (tab === 'movement') return 'movement';
        if (tab === 'fast-moving') return 'fast-moving';
        if (tab === 'demand-forecast') return 'demand-forecast';
        if (tab === 'forecast-reorder') return 'forecast-reorder';
        if (tab === 'near-expiry-actions') return 'near-expiry-actions';
        if (tab === 'par') return 'par';
        if (tab === 'purchase') return 'purchase';
        if (tab === 'performance') return 'performance';
        if (tab === 'customer') return 'customer';
        if (tab === 'tax') return 'tax';
        return null;
    };

    const exportType = getExportType(resolvedTab);
    const canExport = exportType !== null;

    const handleExport = async (format: 'excel' | 'pdf') => {
        if (!exportType) {
            toast.error('Export is not available for this report yet.');
            return;
        }

        const params: any = { facilityId: effectiveFacilityId };
        if (['sales', 'purchase', 'performance', 'tax'].includes(exportType)) {
            params.start_date = startDate;
            params.end_date = endDate;
        }
        if (exportType === 'expiry') params.days = expiryDays;
        if (exportType === 'fast-moving') params.days = 90;
        if (exportType === 'demand-forecast') {
            params.horizon_days = 30;
            params.history_days = 180;
        }
        if (exportType === 'forecast-reorder') {
            params.horizon_days = 30;
        }
        if (exportType === 'near-expiry-actions') {
            params.horizon_days = nearExpiryActionDays;
        }
        if (exportType === 'par') {
            params.status = 'pending';
        }

        try {
            await pharmacyService.downloadReport(exportType, format, params);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export report.');
        }
    };

    return (
        <ProtectedRoute
            allowedRoles={[
                'ADMIN',
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'OWNER',
                'STORE_MANAGER',
                'STORE MANAGER',
                'AUDITOR',
            ]}
            requireFacility
        >
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <h1 className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-black uppercase tracking-tight text-healthcare-dark dark:text-white">
                            <span>Reports</span>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <span className="text-healthcare-primary dark:text-blue-300">
                                {SUBTAB_LABELS[resolvedTab] || resolvedTab}
                            </span>
                        </h1>
                        {resolvedTab === 'expiry' && (
                            <label className="flex shrink-0 items-center gap-2">
                                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    Near days
                                </span>
                                <select
                                    value={String(expiryDays)}
                                    onChange={(e) => {
                                        const raw = parseInt(e.target.value, 10);
                                        const n = Number.isFinite(raw)
                                            ? Math.min(730, Math.max(1, raw))
                                            : 30;
                                        setExpiryDays(n);
                                    }}
                                    className="h-[42px] min-w-[120px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wider text-slate-700 focus:outline-none focus:ring-2 focus:ring-healthcare-primary/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    {expiryWindowSelectOptions.map((d) => (
                                        <option key={d} value={d}>
                                            {d} days
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        {resolvedTab === 'near-expiry-actions' && (
                            <label className="flex shrink-0 items-center gap-2">
                                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    Near days
                                </span>
                                <select
                                    value={String(nearExpiryActionDays)}
                                    onChange={(e) => {
                                        const raw = parseInt(e.target.value, 10);
                                        const n = Number.isFinite(raw)
                                            ? Math.min(730, Math.max(1, raw))
                                            : 90;
                                        setNearExpiryActionDays(n);
                                    }}
                                    className="h-[42px] min-w-[120px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wider text-slate-700 focus:outline-none focus:ring-2 focus:ring-healthcare-primary/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    {nearExpiryHorizonSelectOptions.map((d) => (
                                        <option key={d} value={d}>
                                            {d} days
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <div className="ml-auto flex shrink-0 gap-2">
                        <button
                            onClick={() => handleExport('excel')}
                            disabled={!canExport}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md',
                                canExport
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20'
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-slate-200/20',
                            )}
                        >
                            <Download size={14} /> Excel
                        </button>
                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={!canExport}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md',
                                canExport
                                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/20'
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-slate-200/20',
                            )}
                        >
                            <Download size={14} /> PDF
                        </button>
                    </div>
                </div>

                {/* Date / day pickers (conditionally shown) */}
                {['sales', 'tax', 'performance', 'purchase'].includes(resolvedTab) && (
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm w-fit">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
                        />
                        <span className="text-slate-300 px-1">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
                        />
                    </div>
                )}

                <div className="glass-card p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 min-h-[400px]">
                    {resolvedTab === 'sales' && (
                        <SalesReports
                            facilityId={effectiveFacilityId}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    )}
                    {resolvedTab === 'stock' && <StockReports facilityId={effectiveFacilityId} />}
                    {resolvedTab === 'low-stock' && (
                        <div className="w-full">
                            <ReorderSuggestions />
                        </div>
                    )}
                    {resolvedTab === 'fast-moving' && (
                        <FastSlowMovingReport facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'demand-forecast' && (
                        <DemandForecastReport facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'near-expiry-actions' && (
                        <NearExpiryActionsReport
                            facilityId={effectiveFacilityId}
                            horizonDays={nearExpiryActionDays}
                        />
                    )}
                    {resolvedTab === 'forecast-reorder' && (
                        <ForecastReorderReport facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'par' && (
                        <ParReplenishmentReport facilityId={effectiveFacilityId} />
                    )}
                    {resolvedTab === 'expiry' && (
                        <ExpiryReport facilityId={effectiveFacilityId} selectedDays={expiryDays} />
                    )}
                    {resolvedTab === 'movement' && (
                        <div className="-mx-6 -my-6">
                            <StockMovementsPage />
                        </div>
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
}: {
    facilityId?: number;
    startDate?: string;
    endDate?: string;
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
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                            Purchase vs Sales
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() =>
                                    pharmacyService.downloadReport('purchase-vs-sales', 'excel', {
                                        start_date: startDate,
                                        end_date: endDate,
                                    })
                                }
                                className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            >
                                Excel
                            </button>
                            <button
                                onClick={() =>
                                    pharmacyService.downloadReport('purchase-vs-sales', 'pdf', {
                                        start_date: startDate,
                                        end_date: endDate,
                                    })
                                }
                                className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-rose-100 text-rose-700 hover:bg-rose-200"
                            >
                                PDF
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-[10px] font-black uppercase text-slate-400">
                                Purchases
                            </p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-100">
                                RWF{' '}
                                {Number(
                                    purchaseVsSales?.totals?.purchase_amount || 0,
                                ).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-[10px] font-black uppercase text-slate-400">Sales</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-100">
                                RWF{' '}
                                {Number(
                                    purchaseVsSales?.totals?.sales_amount || 0,
                                ).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-[10px] font-black uppercase text-slate-400">
                                Variance
                            </p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-100">
                                RWF{' '}
                                {Number(
                                    purchaseVsSales?.totals?.variance_amount || 0,
                                ).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="tc-table w-full text-xs">
                            <thead className="bg-white dark:bg-slate-900 sticky top-0">
                                <tr className="text-slate-400 uppercase">
                                    <th className="px-3 py-2 text-left">Date</th>
                                    <th className="px-3 py-2 text-right">Purchase</th>
                                    <th className="px-3 py-2 text-right">Sales</th>
                                    <th className="px-3 py-2 text-right">Variance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(purchaseVsSales?.timeline || []).slice(0, 20).map((row: any) => (
                                    <tr
                                        key={row.date}
                                        className="border-t border-slate-100 dark:border-slate-800"
                                    >
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-200">
                                            {row.date}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-200">
                                            {Number(row.purchase_amount || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-200">
                                            {Number(row.sales_amount || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-100">
                                            {Number(row.variance_amount || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                            Medicine Margin
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() =>
                                    pharmacyService.downloadReport('medicine-margin', 'excel', {
                                        start_date: startDate,
                                        end_date: endDate,
                                    })
                                }
                                className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            >
                                Excel
                            </button>
                            <button
                                onClick={() =>
                                    pharmacyService.downloadReport('medicine-margin', 'pdf', {
                                        start_date: startDate,
                                        end_date: endDate,
                                    })
                                }
                                className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-rose-100 text-rose-700 hover:bg-rose-200"
                            >
                                PDF
                            </button>
                        </div>
                    </div>
                    <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="tc-table w-full text-xs">
                            <thead className="bg-white dark:bg-slate-900 sticky top-0">
                                <tr className="text-slate-400 uppercase">
                                    <th className="px-3 py-2 text-left">Medicine</th>
                                    <th className="px-3 py-2 text-right">Qty</th>
                                    <th className="px-3 py-2 text-right">Revenue</th>
                                    <th className="px-3 py-2 text-right">COGS</th>
                                    <th className="px-3 py-2 text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(medicineMargin?.items || []).slice(0, 20).map((row: any) => (
                                    <tr
                                        key={row.medicine_id}
                                        className="border-t border-slate-100 dark:border-slate-800"
                                    >
                                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-100">
                                            {row.medicine_name}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-200">
                                            {Number(row.quantity_sold || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-200">
                                            {Number(row.revenue || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-200">
                                            {Number(row.cogs || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-100">
                                            {Number(row.profit_margin_percent || 0).toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
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
                        {(() => {
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

                            return Object.values(grouped || {}).map((t: any) => (
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
                                                    const details = await pharmacyService.getSale(
                                                        t.sale_id,
                                                    );
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
                            ));
                        })()}
                    </tbody>
                </table>
            </div>
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
    const [inventoryAging, setInventoryAging] = useState<any | null>(null);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [lowStockMedicineIds, setLowStockMedicineIds] = useState<number[]>([]);
    const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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

                const [summary, allMedicines, lowStockReport, agingReport] = await Promise.all([
                    pharmacyService.getStockReport(facilityId),
                    fetchAllMedicines(facilityId),
                    pharmacyService.getLowStockReport(facilityId),
                    pharmacyService.getInventoryAgingReport(facilityId, { as_of_date: asOfDate }),
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
                setInventoryAging(agingReport);
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
    }, [facilityId, asOfDate]);

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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
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

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        Inventory Aging
                    </h3>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                            className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        />
                        <button
                            onClick={() =>
                                pharmacyService.downloadReport('inventory-aging', 'excel', {
                                    as_of_date: asOfDate,
                                })
                            }
                            className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        >
                            Excel
                        </button>
                        <button
                            onClick={() =>
                                pharmacyService.downloadReport('inventory-aging', 'pdf', {
                                    as_of_date: asOfDate,
                                })
                            }
                            className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-rose-100 text-rose-700 hover:bg-rose-200"
                        >
                            PDF
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(inventoryAging?.buckets || []).map((bucket: any) => (
                        <div
                            key={bucket.bucket}
                            className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3"
                        >
                            <p className="text-[10px] font-black uppercase text-slate-400">
                                {bucket.bucket} days
                            </p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-100">
                                {Number(bucket.quantity || 0).toLocaleString()} units
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">
                                RWF {Number(bucket.value || 0).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                    <div className="relative md:col-span-2 xl:col-span-2">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by medicine, code, brand..."
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-healthcare-primary/30"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | InventoryStatus)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
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
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
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
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                        <option value="30">Expiry Window: 30d</option>
                        <option value="60">Expiry Window: 60d</option>
                        <option value="90">Expiry Window: 90d</option>
                        <option value="180">Expiry Window: 180d</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                        <option value="name_asc">Sort: Name</option>
                        <option value="stock_desc">Sort: Stock High-Low</option>
                        <option value="stock_asc">Sort: Stock Low-High</option>
                        <option value="expiry_soonest">Sort: Earliest Expiry</option>
                        <option value="value_desc">Sort: Value High-Low</option>
                    </select>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        <span>
                            Showing {visibleRows.length} / {filteredRows.length} filtered items
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>Total Inventory: {detailedRows.length}</span>
                        <span className="text-slate-300">•</span>
                        <span>Filtered Value: RWF {filteredInventoryValue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={String(rowLimit)}
                            onChange={(e) => setRowLimit(Number(e.target.value))}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider"
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
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>

                <div
                    ref={stockTableRef}
                    onScroll={(event) => setStockScrollTop(event.currentTarget.scrollTop)}
                    className="overflow-x-auto overflow-y-auto max-h-[560px] border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                    <table className="tc-table w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">
                                    Medicine
                                </th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Code</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Form</th>
                                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                                    Stock
                                </th>
                                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                                    Cost
                                </th>
                                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                                    Value
                                </th>
                                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                                    Expiry
                                </th>
                                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                                    Days Left
                                </th>
                                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                                    Status
                                </th>
                                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                                    Date Added
                                </th>
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
                                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                                    {row.brand_name || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {row.code}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                                {row.dosage_form || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-white whitespace-nowrap">
                                                {Number(row.stock_quantity || 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                                RWF {Number(row.cost_price || 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-healthcare-primary whitespace-nowrap">
                                                RWF{' '}
                                                {Number(row.inventory_value || 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                                {row.expiry_date
                                                    ? formatLocalDate(row.expiry_date)
                                                    : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold whitespace-nowrap">
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
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span
                                                    className={cn(
                                                        'px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider whitespace-nowrap',
                                                        statusClassName[row.status],
                                                    )}
                                                >
                                                    {statusLabel[row.status]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold whitespace-nowrap">
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

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            Stock Analysis
                        </h3>
                        <p className="text-slate-500 text-sm font-medium">
                            ABC Classification based on consumption value
                        </p>
                    </div>
                </div>
                <ABCAnalysisReport />
            </div>
        </div>
    );
}

function SummaryCard({ title, value, trend, icon, color = 'teal' }: any) {
    return (
        <div className="tc-stat-card tc-stat-card-neutral group hover:shadow-lg">
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
