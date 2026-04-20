import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Search,
    AlertCircle,
    Package,
    ShoppingCart,
    ArrowRightLeft,
    SlidersHorizontal,
    History,
    Trash2,
    Truck,
    MoreVertical,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../types/auth';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Batch, Medicine, OperationalBatchRow, OperationalBatchStatus } from '../../types/pharmacy';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatLocalDate, formatLocalDateTime, parseLocalDate } from '../../lib/date';
import { StockAdjustmentModal } from '../../components/inventory/StockAdjustmentModal';
import { StockTransferModal } from '../../components/inventory/StockTransferModal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const STOCK_MOVEMENTS_PREFILL = 'tangacare.stockMovements.prefillSearch';
const POS_BATCH_PREFILL = 'tangacare.pos.prefillDispenseBatch';
const BATCH_ACTIONS_MENU_WIDTH = 224;

function statusBadgeClass(s: OperationalBatchStatus): string {
    switch (s) {
        case 'EXPIRED':
            return 'bg-rose-100 text-rose-800 border-rose-200';
        case 'EXPIRING_SOON':
            return 'bg-amber-100 text-amber-900 border-amber-200';
        case 'OUT_OF_STOCK':
            return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'BLOCKED':
            return 'bg-violet-100 text-violet-900 border-violet-200';
        case 'LOW_BATCH_STOCK':
            return 'bg-orange-50 text-orange-900 border-orange-200';
        default:
            return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
}

function toAdjustmentBatch(row: OperationalBatchRow): Batch {
    return {
        id: row.batchId,
        medicine_id: row.medicineId,
        batch_number: row.batchNumber,
        expiry_date: row.expiryDate,
        manufacturing_date: row.expiryDate,
        initial_quantity: row.availableQty,
        current_quantity: row.availableQty,
        unit_cost: row.unitCost ?? 0,
        status: row.isExpired ? 'expired' : 'active',
    };
}

export function BatchStockPage() {
    const navigate = useNavigate();
    const { user, facilityId, can } = useAuth();
    const { formatMoney } = useRuntimeConfig();
    const fid = facilityId ?? user?.facility_id ?? null;

    const [serverRows, setServerRows] = useState<OperationalBatchRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [medicineFilter, setMedicineFilter] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring_soon' | 'zero_stock' | 'blocked'>(
        'all',
    );
    const [sortBy, setSortBy] = useState<
        'expiry_asc' | 'expiry_desc' | 'available_desc' | 'available_asc' | 'sellable_desc' | 'movement_desc'
    >('expiry_asc');

    const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
    const [adjustInitialType, setAdjustInitialType] = useState<'decrease' | 'expired' | undefined>(undefined);
    const [transferCtx, setTransferCtx] = useState<{ medicine: Medicine; batchId: number } | null>(null);
    const [transferLoading, setTransferLoading] = useState(false);
    const [openMenuRow, setOpenMenuRow] = useState<OperationalBatchRow | null>(null);
    const [menuPlacement, setMenuPlacement] = useState<{
        top: number;
        left: number;
        maxHeight: number;
    } | null>(null);
    const [markExpiredRow, setMarkExpiredRow] = useState<OperationalBatchRow | null>(null);

    useLayoutEffect(() => {
        if (!openMenuRow) {
            setMenuPlacement(null);
            return;
        }
        const compute = () => {
            const el = document.querySelector(
                `[data-batch-actions-trigger="${openMenuRow.batchId}"]`,
            ) as HTMLElement | null;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const gap = 6;
            const pad = 8;
            let left = r.right - BATCH_ACTIONS_MENU_WIDTH;
            left = Math.max(pad, Math.min(left, window.innerWidth - BATCH_ACTIONS_MENU_WIDTH - pad));
            const belowTop = r.bottom + gap;
            const spaceBelow = window.innerHeight - belowTop - pad;
            const spaceAbove = r.top - pad;
            const maxPrefer = 360;
            if (spaceBelow >= 140 || spaceBelow >= spaceAbove) {
                setMenuPlacement({
                    top: belowTop,
                    left,
                    maxHeight: Math.min(maxPrefer, Math.max(120, spaceBelow)),
                });
            } else {
                const maxH = Math.min(maxPrefer, Math.max(120, spaceAbove - gap * 2));
                setMenuPlacement({
                    top: Math.max(pad, r.top - maxH - gap),
                    left,
                    maxHeight: maxH,
                });
            }
        };
        compute();
        const el = document.querySelector(`[data-batch-actions-trigger="${openMenuRow.batchId}"]`);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null;
        if (el && ro) ro.observe(el);
        window.addEventListener('scroll', compute, true);
        window.addEventListener('resize', compute);
        return () => {
            ro?.disconnect();
            window.removeEventListener('scroll', compute, true);
            window.removeEventListener('resize', compute);
        };
    }, [openMenuRow]);

    useEffect(() => {
        if (!openMenuRow) return;
        const onDocMouseDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (t.closest('[data-batch-actions-portal]')) return;
            const root = document.querySelector(`[data-batch-actions-root="${openMenuRow.batchId}"]`);
            if (root?.contains(t)) return;
            setOpenMenuRow(null);
            setMenuPlacement(null);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [openMenuRow]);

    useEffect(() => {
        if (!openMenuRow) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpenMenuRow(null);
                setMenuPlacement(null);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [openMenuRow]);

    const load = useCallback(async () => {
        if (!fid) {
            setServerRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await pharmacyService.getOperationalBatches({
                facility_id: fid,
                medicine: medicineFilter.trim() || undefined,
                batch: batchFilter.trim() || undefined,
                status: statusFilter,
                sort: sortBy,
            });
            setServerRows(data);
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(msg || 'Failed to load batches');
            toast.error(msg || 'Failed to load batches');
        } finally {
            setLoading(false);
        }
    }, [fid, medicineFilter, batchFilter, statusFilter, sortBy]);

    useEffect(() => {
        void load();
    }, [load]);

    const canAdjust = can(PERMISSIONS.INVENTORY_WRITE);
    const canDispense = can(PERMISSIONS.DISPENSING_WRITE);

    const closeActionsMenu = () => {
        setOpenMenuRow(null);
        setMenuPlacement(null);
    };

    const openDispense = (row: OperationalBatchRow) => {
        closeActionsMenu();
        if (!canDispense) {
            toast.error('You do not have permission to dispense');
            return;
        }
        if (row.sellableQty <= 0 || row.isExpired) {
            toast.error('This batch cannot be sold (expired or no sellable quantity)');
            return;
        }
        try {
            sessionStorage.setItem(
                POS_BATCH_PREFILL,
                JSON.stringify({ medicineId: row.medicineId, batchId: row.batchId }),
            );
        } catch {
            /* ignore */
        }
        navigate({ to: '/app/sell', search: {} as never });
    };

    const openAdjust = (row: OperationalBatchRow, initial?: 'decrease' | 'expired') => {
        closeActionsMenu();
        setAdjustInitialType(initial);
        setAdjustBatch(toAdjustmentBatch(row));
    };

    const openTransfer = async (row: OperationalBatchRow) => {
        closeActionsMenu();
        if (!fid) return;
        setTransferLoading(true);
        try {
            const med = await pharmacyService.getMedicine(row.medicineId);
            setTransferCtx({ medicine: med, batchId: row.batchId });
        } catch {
            toast.error('Could not load medicine for transfer');
        } finally {
            setTransferLoading(false);
        }
    };

    const openMovements = (row: OperationalBatchRow) => {
        closeActionsMenu();
        try {
            sessionStorage.setItem(STOCK_MOVEMENTS_PREFILL, row.batchNumber);
        } catch {
            /* ignore */
        }
        navigate({ to: '/app/stock-movements', search: {} as never });
    };

    const openReturns = () => {
        closeActionsMenu();
        navigate({ to: '/app/analytics/returns', search: {} as never });
    };

    const requestMarkExpired = (row: OperationalBatchRow) => {
        closeActionsMenu();
        setMarkExpiredRow(row);
    };

    const confirmMarkExpired = () => {
        if (!markExpiredRow) return;
        const row = markExpiredRow;
        setMarkExpiredRow(null);
        openAdjust(row, 'expired');
    };

    const rows = useMemo(() => {
        const loc = locationFilter.trim().toLowerCase();
        if (!loc) return serverRows;
        return serverRows.filter((r) => (r.locationName || '').toLowerCase().includes(loc));
    }, [serverRows, locationFilter]);

    const summary = useMemo(() => {
        const expired = rows.filter((r) => r.isExpired).length;
        const fefo = rows.filter((r) => r.isFefoCandidate).length;
        return { total: rows.length, expired, fefo };
    }, [rows]);

    return (
        <ProtectedRoute
            allowedRoles={[
                'super_admin',
                'facility_admin',
                'store_manager',
                'pharmacist',
                'auditor',
                'admin',
                'owner',
            ]}
            requireFacility
        >
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-black text-healthcare-dark dark:text-white tracking-tight">
                            Batch stock (execution)
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-bold mt-0.5 text-xs uppercase tracking-wider">
                            FEFO, expiry, sellable vs reserved — medicine totals stay on inventory
                        </p>
                        {!loading && !error && (
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-2">
                                {summary.total} batch rows · {summary.expired} expired · {summary.fefo} FEFO head
                                batches
                            </p>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                        {error}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row flex-wrap gap-4 items-stretch lg:items-end">
                    <div className="relative flex-1 min-w-[180px] max-w-md">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Medicine name…"
                            value={medicineFilter}
                            onChange={(e) => setMedicineFilter(e.target.value)}
                            className="w-full h-11 sm:h-10 pl-11 pr-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[180px] max-w-md">
                        <Package
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Batch number…"
                            value={batchFilter}
                            onChange={(e) => setBatchFilter(e.target.value)}
                            className="w-full h-11 sm:h-10 pl-11 pr-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[180px] max-w-md">
                        <input
                            type="text"
                            placeholder="Location contains…"
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="w-full h-11 sm:h-10 px-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <SlidersHorizontal size={18} className="text-slate-400 shrink-0 hidden sm:block" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                                className="h-11 sm:h-10 min-w-[10.5rem] px-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-healthcare-primary shadow-sm"
                            >
                            <option value="all">All statuses</option>
                            <option value="expired">Expired</option>
                            <option value="expiring_soon">Expiring soon</option>
                            <option value="zero_stock">Zero / no sellable</option>
                            <option value="blocked">Blocked / non-saleable</option>
                        </select>
                        </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="h-11 sm:h-10 min-w-[12rem] px-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-healthcare-primary shadow-sm"
                    >
                        <option value="expiry_asc">Expiry · soonest first</option>
                        <option value="expiry_desc">Expiry · latest first</option>
                        <option value="available_desc">Available qty · high</option>
                        <option value="available_asc">Available qty · low</option>
                        <option value="sellable_desc">Sellable qty · high</option>
                        <option value="movement_desc">Last movement · recent</option>
                    </select>
                    </div>
                </div>

                {loading ? (
                    <SkeletonTable
                        rows={6}
                        columns={8}
                        headers={[
                            'Medicine',
                            'Batch',
                            'Expiry',
                            'Available',
                            'Reserved',
                            'Sellable',
                            'Status',
                            'Actions',
                        ]}
                        columnAligns={['left', 'left', 'left', 'right', 'right', 'right', 'left', 'left']}
                        className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                    />
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="tc-table w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        Medicine
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        Batch
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        Expiry
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                        Avail.
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                        Res.
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                        Sellable
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        Location
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        Last move
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                        Cost / price
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap w-[1%]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                                            <AlertCircle className="inline mr-2 align-text-bottom" size={18} />
                                            No batch rows for this facility / filters.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => {
                                        const expiryLine =
                                            row.daysToExpiry == null
                                                ? '—'
                                                : row.isExpired
                                                  ? `Expired (${Math.abs(row.daysToExpiry)}d ago)`
                                                  : `Expires in ${row.daysToExpiry}d`;
                                        const rowTone =
                                            row.isExpired
                                                ? 'bg-rose-50/70 dark:bg-rose-950/20'
                                                : row.batchStatus === 'EXPIRING_SOON'
                                                  ? 'bg-amber-50/60 dark:bg-amber-950/15'
                                                  : '';

                                        return (
                                            <tr key={row.batchId} className={cn('align-top', rowTone)}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                        {row.medicineName}
                                                    </div>
                                                    {row.controlledDrug && (
                                                        <span className="text-[10px] text-rose-700 dark:text-rose-400">
                                                            Controlled
                                                        </span>
                                                    )}
                                                    {row.isFefoCandidate && (
                                                        <span className="ml-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                                            FEFO pick
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{row.batchNumber}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-800 dark:text-slate-100">
                                                        {expiryLine}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatLocalDate(parseLocalDate(row.expiryDate))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums">
                                                    {row.availableQty.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-slate-600">
                                                    {row.reservedQty.toLocaleString()}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'px-6 py-4 text-right tabular-nums font-medium',
                                                        row.sellableQty <= 0
                                                            ? 'text-rose-700 dark:text-rose-400'
                                                            : 'text-slate-900 dark:text-slate-100',
                                                    )}
                                                >
                                                    {row.sellableQty.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-600 max-w-[180px]">
                                                    {row.locationName || '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={cn(
                                                            'inline-flex px-2 py-0.5 rounded text-[10px] font-medium border',
                                                            statusBadgeClass(row.batchStatus),
                                                        )}
                                                    >
                                                        {row.batchStatus.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                                                    {row.lastMovementAt
                                                        ? formatLocalDateTime(new Date(row.lastMovementAt))
                                                        : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-xs text-slate-600 whitespace-nowrap">
                                                    {row.unitCost != null && row.unitCost > 0
                                                        ? formatMoney(row.unitCost)
                                                        : '—'}
                                                    <span className="text-slate-400"> · </span>
                                                    {row.unitPrice != null && row.unitPrice > 0
                                                        ? formatMoney(row.unitPrice)
                                                        : '—'}
                                                </td>
                                                <td
                                                    className="px-6 py-4 text-right"
                                                    data-batch-actions-root={row.batchId}
                                                >
                                                    <div className="relative inline-flex justify-end">
                                                        <button
                                                            type="button"
                                                            data-batch-actions-trigger={row.batchId}
                                                            aria-haspopup="menu"
                                                            aria-expanded={openMenuRow?.batchId === row.batchId}
                                                            title="Batch actions"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenMenuRow((cur) =>
                                                                    cur?.batchId === row.batchId ? null : row,
                                                                );
                                                            }}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                        >
                                                            <MoreVertical size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {adjustBatch && (
                    <StockAdjustmentModal
                        batch={adjustBatch}
                        initialAdjustmentType={adjustInitialType}
                        onClose={() => {
                            setAdjustBatch(null);
                            setAdjustInitialType(undefined);
                        }}
                        onSuccess={() => {
                            setAdjustBatch(null);
                            setAdjustInitialType(undefined);
                            void load();
                        }}
                    />
                )}

                {transferCtx && fid && (
                    <StockTransferModal
                        medicine={transferCtx.medicine}
                        facilityId={fid}
                        initialBatchId={transferCtx.batchId}
                        onClose={() => setTransferCtx(null)}
                        onSuccess={() => {
                            setTransferCtx(null);
                            void load();
                        }}
                    />
                )}

                {openMenuRow &&
                    menuPlacement &&
                    createPortal(
                        <div
                            data-batch-actions-portal
                            role="menu"
                            className="fixed z-[200] flex flex-col overflow-y-auto rounded-xl border-2 border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                            style={{
                                top: menuPlacement.top,
                                left: menuPlacement.left,
                                width: BATCH_ACTIONS_MENU_WIDTH,
                                maxHeight: menuPlacement.maxHeight,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                role="menuitem"
                                disabled={
                                    !canDispense ||
                                    openMenuRow.sellableQty <= 0 ||
                                    openMenuRow.isExpired
                                }
                                title={
                                    openMenuRow.isExpired || openMenuRow.sellableQty <= 0
                                        ? 'Not sellable'
                                        : 'Open POS with this batch'
                                }
                                onClick={() => openDispense(openMenuRow)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                                <ShoppingCart size={16} className="shrink-0" />
                                Dispense this batch
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={!canAdjust}
                                onClick={() => openAdjust(openMenuRow, 'decrease')}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                                <SlidersHorizontal size={16} className="shrink-0" />
                                Adjust stock
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={!canAdjust || transferLoading}
                                onClick={() => void openTransfer(openMenuRow)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                                <ArrowRightLeft size={16} className="shrink-0" />
                                Transfer
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={!canAdjust}
                                title="Opens supplier returns workspace"
                                onClick={openReturns}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                                <Truck size={16} className="shrink-0" />
                                Return to supplier
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={!canAdjust || openMenuRow.isExpired}
                                onClick={() => requestMarkExpired(openMenuRow)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                                <Trash2 size={16} className="shrink-0" />
                                Mark expired / remove
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => openMovements(openMenuRow)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                                <History size={16} className="shrink-0" />
                                View batch history
                            </button>
                        </div>,
                        document.body,
                    )}

                <ConfirmModal
                    isOpen={!!markExpiredRow}
                    onClose={() => setMarkExpiredRow(null)}
                    onConfirm={confirmMarkExpired}
                    title="Mark batch as expired?"
                    message={
                        markExpiredRow
                            ? `Batch ${markExpiredRow.batchNumber} · ${markExpiredRow.medicineName}. This opens a stock adjustment to write off expired stock — use only when you are actually removing or destroying that stock.`
                            : ''
                    }
                    confirmText="Continue to adjustment"
                    cancelText="Cancel"
                    variant="warning"
                />
            </div>
        </ProtectedRoute>
    );
}
