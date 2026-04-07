import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, FileText, PackageCheck, RefreshCw, Truck, User } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { pharmacyService } from '../../services/pharmacy.service';
import type { GoodsReceipt } from '../../types/pharmacy';
import { Pagination } from '../../components/ui/Pagination';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { TableToolbar } from '../../components/ui/table/TableToolbar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatLocalDateTime } from '../../lib/date';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const formatRwf = (value: number): string =>
    `RWF ${Math.round(Number(value || 0)).toLocaleString()}`;

export function GoodsReceiptsPage() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<GoodsReceipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchReceipts = async () => {
        setLoading(true);
        try {
            const response = await pharmacyService.getGoodsReceipts({ page, limit });
            setRows(Array.isArray(response.data) ? response.data : []);
            setTotalPages(response.meta?.totalPages || 1);
            setTotalItems(response.meta?.total || 0);
        } catch (error) {
            console.error('Failed to fetch goods receipts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReceipts();
    }, [page, limit]);

    const visibleRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => {
            const receiptNo = String(row.receipt_number || '').toLowerCase();
            const poNumber = String(
                row.purchase_order?.order_number || row.purchase_order_id || '',
            ).toLowerCase();
            const supplier = String(row.purchase_order?.supplier?.name || '').toLowerCase();
            return receiptNo.includes(term) || poNumber.includes(term) || supplier.includes(term);
        });
    }, [rows, searchTerm]);

    const stats = useMemo(() => {
        const totalUnits = rows.reduce(
            (sum, row) =>
                sum +
                (row.items || []).reduce(
                    (itemSum, item) => itemSum + Number(item.quantity_received || 0),
                    0,
                ),
            0,
        );
        const totalValue = rows.reduce(
            (sum, row) =>
                sum +
                (row.items || []).reduce(
                    (itemSum, item) =>
                        itemSum + Number(item.quantity_received || 0) * Number(item.unit_cost || 0),
                    0,
                ),
            0,
        );
        return { totalUnits, totalValue };
    }, [rows]);

    return (
        <ProtectedRoute
            allowedRoles={[
                'Super Admin',
                'SUPER_ADMIN',
                'Facility Admin',
                'FACILITY_ADMIN',
                'Store Manager',
                'STORE_MANAGER',
                'Auditor',
                'AUDITOR',
                'ADMIN',
            ]}
            requireFacility
        >
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-healthcare-dark dark:text-white tracking-tight">
                                Goods Receipts
                            </h2>
                            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <button
                                    onClick={() =>
                                        navigate({
                                            to: '/app/procurement/orders' as any,
                                            search: {} as any,
                                        })
                                    }
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-slate-500 hover:text-healthcare-primary"
                                >
                                    Purchase orders
                                </button>
                                <button
                                    onClick={() =>
                                        navigate({
                                            to: '/app/procurement/suppliers' as any,
                                            search: {} as any,
                                        })
                                    }
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-slate-500 hover:text-healthcare-primary"
                                >
                                    Suppliers
                                </button>
                                <button
                                    onClick={() =>
                                        navigate({
                                            to: '/app/procurement/receiving' as any,
                                            search: {} as any,
                                        })
                                    }
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-slate-500 hover:text-healthcare-primary"
                                >
                                    Receiving
                                </button>
                                <button
                                    onClick={() =>
                                        navigate({
                                            to: '/app/procurement/receipts' as any,
                                            search: {} as any,
                                        })
                                    }
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all bg-healthcare-primary text-white shadow-lg shadow-teal-500/20"
                                >
                                    Receipts
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={fetchReceipts}
                            className="h-11 px-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-500 rounded-xl font-black text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-[0.98] inline-flex items-center gap-2"
                        >
                            <RefreshCw size={15} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#2563EB] to-[#1D4ED8]">
                        <div className="tc-stat-card-header">
                            <p className="tc-stat-card-title text-white/90">Total receipts</p>
                            <span className="tc-stat-card-icon bg-white/20">
                                <FileText size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <p className="tc-stat-card-value">{totalItems.toLocaleString()}</p>
                            <p className="tc-stat-card-subtitle">All records</p>
                        </div>
                    </div>
                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#10B981] to-[#059669]">
                        <div className="tc-stat-card-header">
                            <p className="tc-stat-card-title text-white/90">Units</p>
                            <span className="tc-stat-card-icon bg-white/20">
                                <PackageCheck size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <p className="tc-stat-card-value">
                                {stats.totalUnits.toLocaleString()}
                            </p>
                            <p className="tc-stat-card-subtitle">Current page</p>
                        </div>
                    </div>
                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#F59E0B] to-[#D97706]">
                        <div className="tc-stat-card-header">
                            <p className="tc-stat-card-title text-white/90">Receipt value</p>
                            <span className="tc-stat-card-icon bg-white/20">
                                <Truck size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <p className="tc-stat-card-value">{formatRwf(stats.totalValue)}</p>
                            <p className="tc-stat-card-subtitle">Current page</p>
                        </div>
                    </div>
                </div>

                <TableToolbar
                    layout="stacked"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder="Search receipt#, PO#, supplier..."
                    onReset={() => setSearchTerm('')}
                />

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <SkeletonTable
                                rows={6}
                                columns={8}
                                headers={[
                                    'Receipt #',
                                    'Received Date',
                                    'PO #',
                                    'Supplier',
                                    'Items',
                                    'Units',
                                    'Receiver',
                                    'Actions',
                                ]}
                            />
                        ) : (
                            <table className="tc-table w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Receipt #
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Received Date
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            PO #
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Supplier
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                                            Items
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                                            Units
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Receiver
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {visibleRows.length > 0 ? (
                                        visibleRows.map((row) => {
                                            const totalUnits = (row.items || []).reduce(
                                                (sum, item) =>
                                                    sum + Number(item.quantity_received || 0),
                                                0,
                                            );
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <PackageCheck
                                                                size={14}
                                                                className="text-emerald-500"
                                                            />
                                                            <span className="text-sm font-black text-healthcare-dark dark:text-white">
                                                                {row.receipt_number ||
                                                                    `GR-${row.id}`}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                                                        {row.received_date
                                                            ? formatLocalDateTime(row.received_date)
                                                            : 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                            <FileText size={13} />
                                                            {row.purchase_order?.order_number ||
                                                                `PO-${row.purchase_order_id}`}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                            <Truck size={13} />
                                                            {row.purchase_order?.supplier?.name ||
                                                                'N/A'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-xs font-black text-slate-500">
                                                        {(row.items || []).length}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-sm font-black text-healthcare-dark dark:text-white">
                                                        {totalUnits.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                            <User size={13} />
                                                            {row.received_by?.first_name ||
                                                                row.received_by?.email ||
                                                                `User #${row.received_by_id}`}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() =>
                                                                navigate({
                                                                    to: `/app/procurement/receipts/${row.id}`,
                                                                })
                                                            }
                                                            className={cn(
                                                                'h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400',
                                                                'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-healthcare-primary',
                                                            )}
                                                            title="View Goods Receipt"
                                                        >
                                                            <ArrowUpRight size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center">
                                                <span className="text-slate-500 font-bold italic">
                                                    No goods receipts found
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <Pagination
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={limit}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setLimit(size);
                        setPage(1);
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    pageSizeLabel="Rows/Page"
                    loading={loading}
                />
            </div>
        </ProtectedRoute>
    );
}
