import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    Clock,
    DollarSign,
    Filter,
    Package,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { format, formatDistanceToNow, subDays, startOfToday, endOfToday } from 'date-fns';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Alert, DashboardSummary, ReorderSuggestion, Stock } from '../../types/pharmacy';
import { ConsumptionTrendChart } from './DashboardCharts';
import { ChartSkeleton, StatCardSkeleton } from './DashboardSkeletons';
import { SkeletonTable } from '../ui/SkeletonTable';
import { cn } from '../../lib/utils';
import { CreatePurchaseOrderModal } from '../inventory/CreatePurchaseOrderModal';
import { AddStockModal } from '../inventory/AddStockModal';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';
import { subscriptionService } from '../../services/subscription.service';
import { useSocket } from '../../context/SocketContext';

interface DashboardOwnerProps {
    facilityId: number | null;
}

type DateRange = 'today' | '7days' | '30days' | 'custom';

function getKpiDateRange(
    dateRange: DateRange,
    startDate: string,
    endDate: string,
): { start: string; end: string } {
    let start = format(startOfToday(), 'yyyy-MM-dd');
    let end = format(endOfToday(), 'yyyy-MM-dd');
    if (dateRange === '7days') {
        start = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    } else if (dateRange === '30days') {
        start = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    } else if (dateRange === 'custom') {
        start = startDate;
        end = endDate;
    }
    return { start, end };
}

interface TopStockMedicine {
    id: number;
    name: string;
    category: string;
    quantity: number;
}

interface DashboardOwnerPanels {
    lowStock: ReorderSuggestion[];
    criticalAlerts: Alert[];
    topStockMedicines: TopStockMedicine[];
    topSelling: Array<{ name: string; value: number }>;
}

export const DashboardOwner: React.FC<DashboardOwnerProps> = ({ facilityId }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const [isLowStockPOModalOpen, setIsLowStockPOModalOpen] = useState(false);
    const [isLowStockAddStockOpen, setIsLowStockAddStockOpen] = useState(false);
    const [selectedLowStockItem, setSelectedLowStockItem] = useState<{
        medicine_id: number;
        medicine_name: string;
        quantity: number;
    } | null>(null);

    const [dateRange, setDateRange] = useState<DateRange>('7days');
    const [startDate, setStartDate] = useState<string>(format(startOfToday(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(endOfToday(), 'yyyy-MM-dd'));
    const [alertsLastUpdatedAt, setAlertsLastUpdatedAt] = useState<Date | null>(null);

    const { data: expirationWarning = null } = useQuery({
        queryKey: ['subscription-expiration-warning'],
        queryFn: async () => {
            try {
                return await subscriptionService.getExpirationWarning();
            } catch {
                return null;
            }
        },
        staleTime: 60_000,
    });

    const { data: panelsData, isLoading: panelLoading } = useQuery({
        queryKey: ['dashboard-owner-panels', facilityId],
        queryFn: async (): Promise<DashboardOwnerPanels> => {
            try {
                const [reorderData, alertsData, topSellingRows, stockData] = await Promise.all([
                    pharmacyService.getReorderSuggestions(facilityId),
                    pharmacyService.getAlerts({
                        facility_id: facilityId || undefined,
                        status: 'active',
                        limit: 25,
                    }),
                    pharmacyService.getTopSellingMedicines('DESC'),
                    pharmacyService.getStock({
                        ...(facilityId ? { facility_id: facilityId } : {}),
                        page: 1,
                        limit: 200,
                    }),
                ]);

                const lowStockRows = Array.isArray(reorderData) ? reorderData.slice(0, 5) : [];

                const alerts = Array.isArray(alertsData.data) ? alertsData.data : [];
                const criticalRows = alerts
                    .filter(
                        (item) =>
                            item.severity === 'critical' ||
                            item.severity === 'out_of_stock' ||
                            item.type === 'expired' ||
                            item.type === 'low_stock',
                    )
                    .slice(0, 5);

                const stockRows = Array.isArray(stockData.data) ? (stockData.data as Stock[]) : [];
                const grouped = new Map<number, TopStockMedicine>();
                for (const row of stockRows) {
                    const medicineId = row.medicine_id ?? row.medicine?.id;
                    if (!medicineId) continue;

                    const quantity = Number(row.quantity || 0);
                    const existing = grouped.get(medicineId);
                    if (existing) {
                        existing.quantity += quantity;
                    } else {
                        grouped.set(medicineId, {
                            id: medicineId,
                            name: row.medicine?.name || `Medicine #${medicineId}`,
                            category: row.medicine?.category?.name || 'Uncategorized',
                            quantity,
                        });
                    }
                }

                return {
                    lowStock: lowStockRows,
                    criticalAlerts:
                        criticalRows.length > 0 ? criticalRows : alerts.slice(0, 5),
                    topStockMedicines: Array.from(grouped.values())
                        .sort((a, b) => b.quantity - a.quantity)
                        .slice(0, 5),
                    topSelling: Array.isArray(topSellingRows) ? topSellingRows.slice(0, 5) : [],
                };
            } catch (error) {
                console.error('Failed to load dashboard panels:', error);
                return {
                    lowStock: [],
                    criticalAlerts: [],
                    topStockMedicines: [],
                    topSelling: [],
                };
            }
        },
    });

    const lowStock = panelsData?.lowStock ?? [];
    const criticalAlerts = panelsData?.criticalAlerts ?? [];
    const topStockMedicines = panelsData?.topStockMedicines ?? [];
    const topSelling = panelsData?.topSelling ?? [];

    const { data: summary, isLoading: kpiLoading } = useQuery({
        queryKey: ['dashboard-owner-kpis', facilityId, dateRange, startDate, endDate],
        queryFn: async (): Promise<DashboardSummary | null> => {
            const { start, end } = getKpiDateRange(dateRange, startDate, endDate);
            try {
                const [kpis, summaryData] = await Promise.all([
                    pharmacyService.getComprehensiveKPIs(facilityId, {
                        start_date: start,
                        end_date: end,
                    }),
                    pharmacyService.getDashboardSummary(facilityId),
                ]);
                return {
                    ...summaryData,
                    today: kpis,
                };
            } catch (error) {
                console.error('Failed to load KPI summary:', error);
                return null;
            }
        },
    });

    const kpis = summary?.today;

    const refreshLowStock = () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard-owner-panels', facilityId] });
    };

    useEffect(() => {
        if (panelsData) {
            setAlertsLastUpdatedAt(new Date());
        }
    }, [panelsData]);

    useEffect(() => {
        if (!socket) return;
        const refreshPanels = () => {
            void queryClient.invalidateQueries({ queryKey: ['dashboard-owner-panels', facilityId] });
        };

        const refreshKpis = () => {
            void queryClient.invalidateQueries({ queryKey: ['dashboard-owner-kpis'] });
        };

        socket.on('alert:new', refreshPanels);
        socket.on('alert:updated', refreshPanels);
        socket.on('alert:resolved', refreshPanels);
        socket.on('notification:new', refreshPanels);
        socket.on('stock:updated', refreshPanels);
        socket.on('inventory:changed', refreshPanels);
        socket.on('sale:created', refreshKpis);
        socket.on('sale:completed', refreshKpis);

        return () => {
            socket.off('alert:new', refreshPanels);
            socket.off('alert:updated', refreshPanels);
            socket.off('alert:resolved', refreshPanels);
            socket.off('notification:new', refreshPanels);
            socket.off('stock:updated', refreshPanels);
            socket.off('inventory:changed', refreshPanels);
            socket.off('sale:created', refreshKpis);
            socket.off('sale:completed', refreshKpis);
        };
    }, [socket, queryClient, facilityId]);

    return (
        <div className="space-y-6 p-4 min-h-screen bg-[#F8FAFC] text-[#111827] dark:bg-slate-950 dark:text-slate-100">
            {(expirationWarning?.isExpiringSoon || expirationWarning?.isExpired) && (
                <div
                    className={cn(
                        'rounded-2xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3',
                        expirationWarning?.isExpired
                            ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
                            : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
                    )}
                >
                    <div>
                        <p className="text-sm font-black">
                            {expirationWarning?.isExpired ? 'Subscription expired' : 'Subscription expiring soon'}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {expirationWarning?.planName || 'Current plan'}{' '}
                            {expirationWarning?.isExpired
                                ? 'has expired. Renew now to restore full access.'
                                : `expires in ${expirationWarning?.daysLeft} day(s).`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            navigate({
                                to: '/checkout' as any,
                                search: { mode: 'renew' } as any,
                            } as any)
                        }
                        className="px-4 py-2.5 rounded-xl bg-healthcare-primary text-white font-bold text-sm"
                    >
                        Renew now
                    </button>
                </div>
            )}

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#FFFFFF] dark:bg-slate-900 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#DBEAFE] dark:bg-blue-900/40 rounded-xl">
                        <Filter className="text-[#2563EB] dark:text-blue-300" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#111827] dark:text-slate-100 leading-tight">
                            Dashboard
                        </h2>
                        <p className="text-xs text-[#6B7280] dark:text-slate-400 font-semibold">
                            Pharmacy inventory overview
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="flex p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-xl border border-[#E5E7EB] dark:border-slate-700">
                        {(['today', '7days', '30days', 'custom'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setDateRange(r)}
                                className={cn(
                                    'px-4 py-2 text-xs font-semibold rounded-lg transition-colors',
                                    dateRange === r
                                        ? 'bg-[#2563EB] text-white'
                                        : 'text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-slate-100',
                                )}
                            >
                                {r === '7days' ? '7 Days' : r === '30days' ? '30 Days' : r}
                            </button>
                        ))}
                    </div>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#111827] dark:text-slate-100"
                            />
                            <span className="text-[#6B7280] dark:text-slate-400 font-bold">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#111827] dark:text-slate-100"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800">
                        <Building2 size={14} className="text-[#2563EB] dark:text-blue-300" />
                        <span className="text-xs font-semibold text-[#111827] dark:text-slate-100">
                            {facilityId === null ? 'All Branches' : 'Main Branch'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiLoading ? (
                    Array(4)
                        .fill(0)
                        .map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCard
                            title="Sales"
                            value={kpis?.financial.total_revenue || 0}
                            isCurrency
                            trend={summary?.month.operational.sales_growth_rate}
                            icon={<DollarSign size={15} />}
                            gradient="from-[#10B981] to-[#059669]"
                            onClick={() =>
                                navigate({ to: '/app/analytics/sales' as any, search: {} as any })
                            }
                        />
                        <StatCard
                            title="Medicines"
                            value={kpis?.inventory.total_items || 0}
                            icon={<Package size={15} />}
                            gradient="from-[#2563EB] to-[#1D4ED8]"
                            onClick={() =>
                                navigate({ to: '/app/inventory' as any, search: {} as any })
                            }
                        />
                        <StatCard
                            title="Low stock"
                            value={kpis?.inventory.low_stock_items || 0}
                            icon={<AlertTriangle size={15} />}
                            gradient="from-[#F59E0B] to-[#D97706]"
                            actionLabel="View Details"
                            onClick={() =>
                                navigate({
                                    to: '/app/analytics/low-stock' as any,
                                    search: {} as any,
                                })
                            }
                        />
                        <StatCard
                            title="Expiring soon"
                            value={kpis?.inventory.expiring_soon_items || 0}
                            icon={<Clock size={15} />}
                            gradient="from-[#EF4444] to-[#DC2626]"
                            actionLabel="View Details"
                            onClick={() =>
                                navigate({ to: '/app/analytics/recall' as any, search: {} as any })
                            }
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-[#FFFFFF] dark:bg-slate-900 rounded-2xl border border-[#E5E7EB] dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-slate-700 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#111827] dark:text-slate-100">
                            Sales trend
                        </h3>
                        <button
                            onClick={() =>
                                navigate({ to: '/app/analytics/sales' as any, search: {} as any })
                            }
                            className="text-xs font-semibold text-[#2563EB] dark:text-blue-300 hover:underline inline-flex items-center gap-1"
                        >
                            View Report <ArrowRight size={13} />
                        </button>
                    </div>
                    <div className="p-5">
                        {kpiLoading ? (
                            <ChartSkeleton />
                        ) : (
                            <div className="h-[250px]">
                                <ConsumptionTrendChart
                                    data={
                                        summary?.sales_trend?.map((d) => ({
                                            date: d.date,
                                            dispensed: d.sales,
                                            received: 0,
                                        })) || []
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>

                <CriticalAlertsCard
                    loading={panelLoading}
                    rows={criticalAlerts}
                    lastUpdatedAt={alertsLastUpdatedAt}
                    onViewAll={() => navigate({ to: '/app/alerts' as any, search: {} as any })}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                    <LowStockCard
                        loading={panelLoading}
                        rows={lowStock}
                        onCreatePO={(item) => {
                            setSelectedLowStockItem({
                                medicine_id: item.medicine_id,
                                medicine_name: item.medicine_name,
                                quantity: item.suggested_quantity,
                            });
                            setIsLowStockPOModalOpen(true);
                        }}
                        onAddStock={(item) => {
                            setSelectedLowStockItem({
                                medicine_id: item.medicine_id,
                                medicine_name: item.medicine_name,
                                quantity: item.suggested_quantity,
                            });
                            setIsLowStockAddStockOpen(true);
                        }}
                    />
                </div>
                <TopStockMedicinesCard loading={panelLoading} rows={topStockMedicines} />
            </div>

            <TopSellingMedicinesCard loading={panelLoading} rows={topSelling} />

            <CreatePurchaseOrderModal
                isOpen={isLowStockPOModalOpen}
                onClose={() => {
                    setIsLowStockPOModalOpen(false);
                    setSelectedLowStockItem(null);
                }}
                onSuccess={() => {
                    setIsLowStockPOModalOpen(false);
                    refreshLowStock();
                }}
                initialItem={selectedLowStockItem}
            />

            <AddStockModal
                isOpen={isLowStockAddStockOpen}
                onClose={() => {
                    setIsLowStockAddStockOpen(false);
                    setSelectedLowStockItem(null);
                }}
                onSuccess={() => {
                    setIsLowStockAddStockOpen(false);
                    refreshLowStock();
                }}
                initialMedicineId={selectedLowStockItem?.medicine_id || null}
            />
        </div>
    );
};

const StatCard: React.FC<{
    title: string;
    value: number;
    isCurrency?: boolean;
    trend?: number;
    icon: React.ReactNode;
    gradient: string;
    actionLabel?: string;
    onClick: () => void;
}> = ({ title, value, isCurrency, trend, icon, gradient, actionLabel, onClick }) => {
    const { formatMoney } = useRuntimeConfig();
    return (
        <button
            onClick={onClick}
            className={cn(
                'tc-stat-card tc-stat-card-gradient group bg-gradient-to-br text-left text-white hover:-translate-y-0.5',
                gradient,
            )}
        >
            <div className="absolute -bottom-8 -right-8 h-16 w-16 rounded-full bg-white/10" />
            <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="tc-stat-card-header">
                    <h3 className="tc-stat-card-title text-white/90">{title}</h3>
                    <span className="tc-stat-card-icon bg-white/20">{icon}</span>
                </div>
                <div className="tc-stat-card-foot">
                    <div className="min-w-0 flex items-center gap-1.5">
                        <span className="tc-stat-card-value">
                            {isCurrency ? formatMoney(value) : value.toLocaleString()}
                        </span>
                        {trend !== undefined && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">
                                {trend >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                {Math.abs(trend).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    {actionLabel && (
                        <span className="shrink-0 rounded-full bg-black/15 px-2 py-0.5 text-[9px] font-semibold">
                            {actionLabel}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

const LowStockCard: React.FC<{
    loading?: boolean;
    rows: ReorderSuggestion[];
    onCreatePO: (item: ReorderSuggestion) => void;
    onAddStock: (item: ReorderSuggestion) => void;
}> = ({ loading, rows, onCreatePO, onAddStock }) => {
    return (
        <div className="tc-table-surface">
            <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-[#111827] dark:text-slate-100">
                        Top 5 low stock medicines
                    </h3>
                    <p className="text-sm text-[#6B7280] dark:text-slate-400 mt-0.5">
                        Items below reorder threshold
                    </p>
                </div>
                <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-semibold text-[#1D4ED8] dark:bg-blue-900/40 dark:text-blue-300">
                    Immediate actions
                </span>
            </div>

            {loading ? (
                <SkeletonTable
                    rows={5}
                    columns={3}
                    headers={null}
                    className="border-none shadow-none"
                />
            ) : rows.length > 0 ? (
                <div className="divide-y divide-[#E5E7EB] dark:divide-slate-700">
                    {rows.slice(0, 5).map((item) => (
                        <div
                            key={item.medicine_id}
                            className="px-5 py-4 flex items-center justify-between gap-3"
                        >
                            <div>
                                <p className="text-sm font-semibold text-[#111827] dark:text-slate-100">
                                    {item.medicine_name}
                                </p>
                                <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                                    Current: {item.current_quantity} | Reorder: {item.reorder_point}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onAddStock(item)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EFF6FF] dark:bg-blue-900/40 text-[#1D4ED8] dark:text-blue-300 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/60"
                                >
                                    Add Stock
                                </button>
                                <button
                                    onClick={() => onCreatePO(item)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981] text-white hover:bg-[#059669]"
                                >
                                    Create PO
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-5 py-10 text-center text-sm text-[#6B7280] dark:text-slate-400">
                    No low stock items
                </div>
            )}
        </div>
    );
};

const CriticalAlertsCard: React.FC<{
    loading?: boolean;
    rows: Alert[];
    lastUpdatedAt?: Date | null;
    onViewAll: () => void;
}> = ({ loading, rows, lastUpdatedAt, onViewAll }) => {
    return (
        <div className="bg-[#FFFFFF] dark:bg-slate-900 rounded-2xl border border-[#E5E7EB] dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-slate-700">
                <h3 className="text-lg font-semibold text-[#111827] dark:text-slate-100">
                    Critical alerts
                </h3>
                {lastUpdatedAt && (
                    <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1">
                        Last updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}
                    </p>
                )}
            </div>

            {loading ? (
                <SkeletonTable
                    rows={5}
                    columns={2}
                    headers={null}
                    className="border-none shadow-none"
                />
            ) : rows.length > 0 ? (
                <div className="divide-y divide-[#E5E7EB] dark:divide-slate-700">
                    {rows.slice(0, 5).map((alert) => (
                        <div
                            key={alert.id}
                            className="px-5 py-4 flex items-start justify-between gap-3"
                        >
                            <div>
                                <p className="text-sm font-semibold text-[#111827] dark:text-slate-100 line-clamp-1">
                                    {alert.title || alert.message}
                                </p>
                                <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5 line-clamp-1">
                                    {alert.medicine?.name || alert.message}
                                </p>
                            </div>
                            <span
                                className={cn(
                                    'shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold',
                                    alert.severity === 'critical' || alert.type === 'expired'
                                        ? 'bg-[#FEE2E2] text-[#991B1B]'
                                        : 'bg-[#FEF3C7] text-[#92400E]',
                                )}
                            >
                                {alert.severity}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-5 py-10 text-center text-sm text-[#6B7280] dark:text-slate-400">
                    No active alerts
                </div>
            )}

            <button
                onClick={onViewAll}
                className="w-full border-t border-[#E5E7EB] dark:border-slate-700 px-5 py-3 text-center text-sm font-semibold text-[#2563EB] dark:text-blue-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
            >
                View All Alerts
            </button>
        </div>
    );
};

const TopStockMedicinesCard: React.FC<{
    loading?: boolean;
    rows: TopStockMedicine[];
}> = ({ loading, rows }) => {
    return (
        <div className="bg-[#FFFFFF] dark:bg-slate-900 rounded-2xl border border-[#E5E7EB] dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-[#E5E7EB] dark:border-slate-700">
                <h3 className="text-lg font-semibold text-[#111827] dark:text-slate-100">
                    Top stock medicines
                </h3>
            </div>

            {loading ? (
                <SkeletonTable
                    rows={5}
                    columns={3}
                    headers={null}
                    className="border-none shadow-none"
                />
            ) : (
                <div className="divide-y divide-[#E5E7EB] dark:divide-slate-700">
                    <div className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2 px-4 py-3 text-xs font-semibold text-[#6B7280] dark:text-slate-400">
                        <span>Medicine</span>
                        <span>Category</span>
                        <span className="text-right">Stock</span>
                    </div>
                    {rows.length > 0 ? (
                        rows.slice(0, 5).map((row) => (
                            <div
                                key={row.id}
                                className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2 px-4 py-3 text-sm"
                            >
                                <span className="font-semibold text-[#111827] dark:text-slate-100 truncate">
                                    {row.name}
                                </span>
                                <span className="text-[#6B7280] dark:text-slate-400 truncate">
                                    {row.category}
                                </span>
                                <span className="text-right font-semibold text-[#2563EB] dark:text-blue-300">
                                    {row.quantity.toLocaleString()}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-8 text-center text-sm text-[#6B7280] dark:text-slate-400">
                            No stock data
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const TopSellingMedicinesCard: React.FC<{
    loading?: boolean;
    rows: Array<{ name: string; value: number }>;
}> = ({ loading, rows }) => {
    return (
        <div className="bg-[#FFFFFF] dark:bg-slate-900 rounded-2xl border border-[#E5E7EB] dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[#111827] dark:text-slate-100">
                    Top selling medicines
                </h3>
            </div>

            {loading ? (
                <SkeletonTable
                    rows={5}
                    columns={2}
                    headers={null}
                    className="border-none shadow-none"
                />
            ) : (
                <div className="divide-y divide-[#E5E7EB] dark:divide-slate-700">
                    <div className="grid grid-cols-[1.5fr_0.8fr] gap-2 px-5 py-3 text-xs font-semibold text-[#6B7280] dark:text-slate-400">
                        <span>Medicine</span>
                        <span className="text-right">Units sold</span>
                    </div>
                    {rows.length > 0 ? (
                        rows.slice(0, 5).map((item, index) => (
                            <div
                                key={`${item.name}-${index}`}
                                className="grid grid-cols-[1.5fr_0.8fr] gap-2 px-5 py-3 text-sm"
                            >
                                <span className="font-semibold text-[#111827] dark:text-slate-100 truncate">
                                    {item.name}
                                </span>
                                <span className="text-right font-semibold text-[#10B981] dark:text-emerald-300">
                                    {Number(item.value || 0).toLocaleString()}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="px-5 py-8 text-center text-sm text-[#6B7280] dark:text-slate-400">
                            No selling data
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
