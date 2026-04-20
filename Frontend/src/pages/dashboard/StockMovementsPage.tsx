import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ArrowDownCircle, ArrowUpCircle, Repeat, Edit3 } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { Pagination } from '../../components/ui/Pagination';
import { TableToolbar } from '../../components/ui/table/TableToolbar';
import {
    STOCK_MOVEMENT_TYPES,
    STOCK_MOVEMENT_LABELS,
    getStockMovementLabel,
    normalizeStockMovementType,
} from '../../lib/stockMovement';
import { useTableViewState, type TableViewColumn } from '../../hooks/useTableViewState';
import { formatLocalDateTime, parseLocalDate } from '../../lib/date';

const STOCK_MOVEMENT_TABLE_COLUMNS: TableViewColumn[] = [
    { key: 'timestamp', label: 'Timestamp', hideable: false },
    { key: 'medicine', label: 'Medicine', hideable: false },
    { key: 'batch', label: 'Batch' },
    { key: 'type', label: 'Type', hideable: false },
    { key: 'quantity', label: 'Qty Change', hideable: false },
    { key: 'reference', label: 'Reference' },
    { key: 'user', label: 'User' },
    { key: 'details', label: 'Details' },
];

const STOCK_MOVEMENT_ROLE_DEFAULT_COLUMNS: Record<string, string[]> = {
    OWNER: ['timestamp', 'medicine', 'batch', 'type', 'quantity', 'reference', 'user', 'details'],
    FACILITYADMIN: [
        'timestamp',
        'medicine',
        'batch',
        'type',
        'quantity',
        'reference',
        'user',
        'details',
    ],
    STOREMANAGER: ['timestamp', 'medicine', 'batch', 'type', 'quantity', 'reference', 'user'],
    PHARMACIST: ['timestamp', 'medicine', 'batch', 'type', 'quantity', 'reference', 'details'],
    AUDITOR: ['timestamp', 'medicine', 'batch', 'type', 'quantity', 'reference', 'user', 'details'],
    CASHIER: ['timestamp', 'medicine', 'type', 'quantity', 'reference', 'details'],
};

type MovementSort = 'latest' | 'oldest' | 'qty_desc' | 'qty_asc';

const STOCK_MOVEMENTS_PREFILL = 'tangacare.stockMovements.prefillSearch';

export function StockMovementsPage() {
    const { user, facilityId } = useAuth();
    const fid = facilityId ?? user?.facility_id;
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        try {
            const pre = sessionStorage.getItem(STOCK_MOVEMENTS_PREFILL);
            if (!pre) return;
            sessionStorage.removeItem(STOCK_MOVEMENTS_PREFILL);
            setSearchTerm(pre);
        } catch {
            /* ignore */
        }
    }, []);
    const [movementTypeFilter, setMovementTypeFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [sortBy, setSortBy] = useState<MovementSort>('latest');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const movementTableRef = useRef<HTMLDivElement | null>(null);
    const [movementScrollTop, setMovementScrollTop] = useState(0);
    const [movementViewportHeight, setMovementViewportHeight] = useState(0);
    const { visibleColumnSet: movementVisibleColumnSet } = useTableViewState(
        'stock-movements-audit',
        STOCK_MOVEMENT_TABLE_COLUMNS,
        {
            role: String(user?.role || ''),
            roleDefaultColumns: STOCK_MOVEMENT_ROLE_DEFAULT_COLUMNS,
        },
    );

    useEffect(() => {
        setPage(1);
    }, [startDate, endDate, searchTerm, movementTypeFilter, userFilter, sortBy, limit]);

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
            .getStockMovements({
                facilityId: fid,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                movement_type: movementTypeFilter === 'all' ? undefined : movementTypeFilter,
                search: searchTerm || undefined,
                user_name: userFilter === 'all' ? undefined : userFilter,
                page,
                limit,
            })
            .then((res) => {
                if (!cancelled) {
                    setData(Array.isArray(res.data) ? res.data : []);
                    setTotal(res.total);
                }
            })
            .catch((err) => {
                if (!cancelled)
                    setError(err?.response?.data?.message || 'Failed to load stock movements');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [fid, startDate, endDate, searchTerm, movementTypeFilter, userFilter, page, limit]);

    const filteredData = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        const filtered = data.filter((row) => {
            const movementType = normalizeStockMovementType(
                row.movement_subtype || row.movement_type,
            );
            const rowUser = String(row.user_name || row.user?.name || '').trim();
            const medicineName = String(
                row.medicine_name || row.medicine?.name || row.entity_name || row.description || '',
            ).toLowerCase();
            const batchNumber = String(
                row.batch_number || row.batch?.batch_number || '',
            ).toLowerCase();
            const reference = String(row.reference || row.reference_number || '').toLowerCase();

            if (movementTypeFilter !== 'all' && movementType !== movementTypeFilter) return false;
            if (userFilter !== 'all' && rowUser !== userFilter) return false;
            if (!normalizedSearch) return true;

            return (
                medicineName.includes(normalizedSearch) ||
                batchNumber.includes(normalizedSearch) ||
                reference.includes(normalizedSearch)
            );
        });

        return filtered.sort((a, b) => {
            const timeA = parseLocalDate(a.created_at || 0).getTime();
            const timeB = parseLocalDate(b.created_at || 0).getTime();
            const qtyA = Number(a.quantity_delta || 0);
            const qtyB = Number(b.quantity_delta || 0);

            switch (sortBy) {
                case 'oldest':
                    return timeA - timeB;
                case 'qty_desc':
                    return Math.abs(qtyB) - Math.abs(qtyA);
                case 'qty_asc':
                    return Math.abs(qtyA) - Math.abs(qtyB);
                case 'latest':
                default:
                    return timeB - timeA;
            }
        });
    }, [data, movementTypeFilter, searchTerm, userFilter, sortBy]);

    const availableUsers = useMemo(() => {
        return Array.from(
            new Set(
                data
                    .map((row) => String(row.user_name || row.user?.name || '').trim())
                    .filter(Boolean),
            ),
        ).sort((a, b) => a.localeCompare(b));
    }, [data]);

    const visibleMovementColumnCount = useMemo(
        () =>
            STOCK_MOVEMENT_TABLE_COLUMNS.filter((column) =>
                movementVisibleColumnSet.has(column.key),
            ).length,
        [movementVisibleColumnSet],
    );

    const shouldVirtualizeMovements = filteredData.length >= 80;
    const movementRowHeight = 58;
    const movementOverscan = 6;
    const movementStartIndex = shouldVirtualizeMovements
        ? Math.max(0, Math.floor(movementScrollTop / movementRowHeight) - movementOverscan)
        : 0;
    const movementVisibleRowCount = shouldVirtualizeMovements
        ? Math.ceil((movementViewportHeight || 520) / movementRowHeight) + movementOverscan * 2
        : filteredData.length;
    const movementEndIndex = shouldVirtualizeMovements
        ? Math.min(filteredData.length, movementStartIndex + movementVisibleRowCount)
        : filteredData.length;
    const renderedMovementRows = shouldVirtualizeMovements
        ? filteredData.slice(movementStartIndex, movementEndIndex)
        : filteredData;
    const movementTopSpacerHeight = shouldVirtualizeMovements
        ? movementStartIndex * movementRowHeight
        : 0;
    const movementBottomSpacerHeight = shouldVirtualizeMovements
        ? Math.max(0, (filteredData.length - movementEndIndex) * movementRowHeight)
        : 0;

    useEffect(() => {
        const updateViewport = () => {
            if (movementTableRef.current) {
                setMovementViewportHeight(movementTableRef.current.clientHeight);
            }
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [movementTableRef]);

    useEffect(() => {
        setMovementScrollTop(0);
        if (movementTableRef.current) {
            movementTableRef.current.scrollTop = 0;
        }
    }, [page, limit, movementTypeFilter, userFilter, searchTerm, sortBy]);

    const totalPages = Math.ceil(total / limit) || 1;

    const movementIcon = (movementType: string) => {
        if (['sale', 'dispense', 'expired_removal', 'expiry', 'damage'].includes(movementType)) {
            return <ArrowDownCircle size={14} className="text-rose-500" />;
        }
        if (['purchase', 'receive', 'return'].includes(movementType)) {
            return <ArrowUpCircle size={14} className="text-emerald-500" />;
        }
        if (movementType === 'transfer') {
            return <Repeat size={14} className="text-amber-500" />;
        }
        return <Edit3 size={14} className="text-indigo-500" />;
    };

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
                        <h2 className="text-2xl font-black text-healthcare-dark dark:text-white tracking-tight">
                            Stock Movement Audit
                        </h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                            Purchases, sales, returns, transfers, adjustments and expiry removals
                        </p>
                    </div>
                    <button className="px-5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-healthcare-primary rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-2">
                        <Download size={16} /> Export
                    </button>
                </div>

                <TableToolbar
                    layout="stacked"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder="Search medicine, batch or reference"
                    onReset={() => {
                        setSearchTerm('');
                        setMovementTypeFilter('all');
                        setUserFilter('all');
                        setStartDate('');
                        setEndDate('');
                        setSortBy('latest');
                    }}
                    filters={
                        <>
                            <select
                                value={movementTypeFilter}
                                onChange={(e) => setMovementTypeFilter(e.target.value)}
                                className="h-11 sm:h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black uppercase tracking-wider"
                            >
                                <option value="all">All movement types</option>
                                {STOCK_MOVEMENT_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {STOCK_MOVEMENT_LABELS[type]}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                                className="h-11 sm:h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black uppercase tracking-wider"
                            >
                                <option value="all">All users</option>
                                {availableUsers.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-11 sm:h-10 px-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-11 sm:h-10 px-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                            />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as MovementSort)}
                                className="h-11 sm:h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black uppercase tracking-wider"
                            >
                                <option value="latest">Latest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="qty_desc">Qty high-low</option>
                                <option value="qty_asc">Qty low-high</option>
                            </select>
                        </>
                    }
                />

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {!fid && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-sm">
                        Select a facility to view stock movements.
                    </div>
                )}

                {loading ? (
                    <SkeletonTable
                        rows={10}
                        columns={visibleMovementColumnCount}
                        headers={STOCK_MOVEMENT_TABLE_COLUMNS.filter((column) =>
                            movementVisibleColumnSet.has(column.key),
                        ).map((column) => column.label)}
                        columnAligns={
                            STOCK_MOVEMENT_TABLE_COLUMNS.filter((column) =>
                                movementVisibleColumnSet.has(column.key),
                            ).map((column) => (column.key === 'quantity' ? 'right' : 'left')) as any
                        }
                        className="border-none shadow-none"
                    />
                ) : (
                    <>
                        <div
                            ref={movementTableRef}
                            onScroll={(event) =>
                                setMovementScrollTop(event.currentTarget.scrollTop)
                            }
                            className="overflow-x-auto overflow-y-auto max-h-[520px] rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                        >
                            <table className="tc-table w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        {movementVisibleColumnSet.has('timestamp') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                Timestamp
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('medicine') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                Medicine
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('batch') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                Batch
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('type') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                Type
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('quantity') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs text-right">
                                                Qty Change
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('reference') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                Reference
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('user') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                User
                                            </th>
                                        )}
                                        {movementVisibleColumnSet.has('details') && (
                                            <th className="p-4 font-black text-healthcare-dark dark:text-white uppercase text-xs">
                                                Details
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {shouldVirtualizeMovements && movementTopSpacerHeight > 0 && (
                                        <tr>
                                            <td
                                                colSpan={visibleMovementColumnCount}
                                                style={{ height: `${movementTopSpacerHeight}px` }}
                                            />
                                        </tr>
                                    )}
                                    {renderedMovementRows.map((row) => {
                                        const movementType = normalizeStockMovementType(
                                            row.movement_subtype || row.movement_type,
                                        );
                                        const medicineName =
                                            row.medicine_name ||
                                            row.medicine?.name ||
                                            row.entity_name ||
                                            '—';
                                        const batchNumber =
                                            row.batch_number ||
                                            row.batch?.batch_number ||
                                            row.batch_code ||
                                            '—';
                                        const quantityDelta = Number(row.quantity_delta || 0);

                                        return (
                                            <tr
                                                key={row.id}
                                                className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                            >
                                                {movementVisibleColumnSet.has('timestamp') && (
                                                    <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                        {row.created_at
                                                            ? formatLocalDateTime(row.created_at)
                                                            : '—'}
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('medicine') && (
                                                    <td className="p-4 font-bold text-healthcare-dark dark:text-white whitespace-nowrap">
                                                        {medicineName}
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('batch') && (
                                                    <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                        {batchNumber}
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('type') && (
                                                    <td className="p-4">
                                                        <span className="inline-flex items-center gap-1 font-bold uppercase text-xs">
                                                            {movementIcon(movementType)}
                                                            {getStockMovementLabel(movementType)}
                                                        </span>
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('quantity') && (
                                                    <td className="p-4 text-right font-bold whitespace-nowrap">
                                                        {quantityDelta >= 0 ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                                +{quantityDelta}
                                                            </span>
                                                        ) : (
                                                            <span className="text-rose-600 dark:text-rose-400">
                                                                {quantityDelta}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('reference') && (
                                                    <td className="p-4 font-medium text-healthcare-dark dark:text-white whitespace-nowrap">
                                                        {row.reference ||
                                                            row.reference_number ||
                                                            '—'}
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('user') && (
                                                    <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                        {row.user_name || row.user?.name || '—'}
                                                    </td>
                                                )}
                                                {movementVisibleColumnSet.has('details') && (
                                                    <td className="p-4 text-slate-500 max-w-sm truncate">
                                                        {row.description || '—'}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {shouldVirtualizeMovements &&
                                        movementBottomSpacerHeight > 0 && (
                                            <tr>
                                                <td
                                                    colSpan={visibleMovementColumnCount}
                                                    style={{
                                                        height: `${movementBottomSpacerHeight}px`,
                                                    }}
                                                />
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                        {filteredData.length === 0 && !loading && fid && (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                No stock movements match the current filters.
                            </div>
                        )}
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            totalItems={total}
                            pageSize={limit}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => {
                                setLimit(size);
                                setPage(1);
                            }}
                            pageSizeOptions={[25, 50, 100, 250]}
                            pageSizeLabel="Rows/Page"
                            loading={loading}
                        />
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default StockMovementsPage;
