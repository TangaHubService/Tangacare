import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import type { PhysicalCount, PhysicalCountItem } from '../../types/pharmacy';
import { format } from 'date-fns';
import { parseLocalDate } from '../../lib/date';
import {
    ClipboardCheck,
    Plus,
    Search,
    CheckCircle,
    AlertTriangle,
    ChevronRight,
} from 'lucide-react';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { ConfirmModal } from '../../components/shared/ConfirmModal';

export function PhysicalCountPage() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [counts, setCounts] = useState<PhysicalCount[]>([]);
    const [activeCount, setActiveCount] = useState<PhysicalCount | null>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'list' | 'detail' | 'create'>('list');

    useEffect(() => {
        if (effectiveFacilityId && view === 'list') {
            loadCounts();
        }
    }, [effectiveFacilityId, view]);

    const loadCounts = async () => {
        if (!effectiveFacilityId) return;
        setLoading(true);
        try {
            const data = await pharmacyService.getPhysicalCounts(effectiveFacilityId);
            setCounts(data);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCount = async () => {
        if (!effectiveFacilityId) return;
        setLoading(true);
        try {
            // For MVP, we start a full facility count. In future, allow selecting medicines/departments.
            const count = await pharmacyService.startPhysicalCount(effectiveFacilityId);
            setActiveCount(count);
            setView('detail');
        } catch (error) {
            console.error('Failed to start count', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewCount = async (countId: number) => {
        setLoading(true);
        try {
            const count = await pharmacyService.getPhysicalCount(countId);
            setActiveCount(count);
            setView('detail');
        } catch (error) {
            console.error('Failed to view count', error);
        } finally {
            setLoading(false);
        }
    };

    if (view === 'detail' && activeCount) {
        return (
            <PhysicalCountDetail
                count={activeCount}
                onBack={() => setView('list')}
                onUpdate={() => handleViewCount(activeCount.id)}
            />
        );
    }

    return (
        <ProtectedRoute
            allowedRoles={[
                'ADMIN',
                'SUPER_ADMIN',
                'FACILITY_ADMIN',
                'PHARMACIST',
                'STORE_MANAGER',
                'OWNER',
            ]}
            requireFacility
        >
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                            <ClipboardCheck className="text-healthcare-primary" /> Stocktaking
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Manage physical inventory counts and reconcile stock.
                        </p>
                    </div>
                    <button
                        onClick={handleCreateCount}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-healthcare-primary text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50"
                    >
                        {loading ? (
                            'Starting...'
                        ) : (
                            <>
                                <Plus size={18} /> New Stock Count
                            </>
                        )}
                    </button>
                </div>

                {loading && view === 'list' ? (
                    <SkeletonTable
                        rows={5}
                        columns={5}
                        headers={['Date Started', 'Status', 'Initiated By', 'Approved By']}
                        columnAligns={['left', 'left', 'left', 'left', 'right']}
                        actions
                        className="border-none shadow-none"
                    />
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="tc-table w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-500">
                                        Date Started
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-500">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-500">
                                        Initiated By
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-500">
                                        Approved By
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-500 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {counts.length > 0 ? (
                                    counts.map((count) => (
                                        <tr
                                            key={count.id}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {format(new Date(count.created_at), 'PPP')}
                                                <div className="text-xs text-slate-400">
                                                    {format(parseLocalDate(count.created_at), 'p')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={count.status} />
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                {count.counted_by?.first_name}{' '}
                                                {count.counted_by?.last_name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                {count.approved_by
                                                    ? `${count.approved_by.first_name} ${count.approved_by.last_name}`
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleViewCount(count.id)}
                                                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                                                >
                                                    {count.status === 'in_progress'
                                                        ? 'Continue'
                                                        : 'View Details'}{' '}
                                                    <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-12 text-center text-slate-400"
                                        >
                                            No stock counts found. Start a new one to reconcile
                                            inventory.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

function PhysicalCountDetail({
    count,
    onBack,
    onUpdate,
}: {
    count: PhysicalCount;
    onBack: () => void;
    onUpdate: () => void;
}) {
    const [items, setItems] = useState<PhysicalCountItem[]>(count.items || []);
    const [filter, setFilter] = useState('');
    const [saving, setSaving] = useState<number | null>(null);
    const [approving, setApproving] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [approveError, setApproveError] = useState<string | null>(null);

    const filteredItems = items.filter(
        (item) =>
            item.medicine?.name.toLowerCase().includes(filter.toLowerCase()) ||
            item.batch?.batch_number.toLowerCase().includes(filter.toLowerCase()),
    );

    const handleQuantityChange = async (itemId: number, qty: number, notes?: string) => {
        setSaving(itemId);
        try {
            // Optimistic update
            const updatedItems = items.map((i) =>
                i.id === itemId
                    ? {
                          ...i,
                          counted_quantity: qty,
                          variance: qty - i.system_quantity,
                          notes: notes ?? i.notes,
                      }
                    : i,
            );
            setItems(updatedItems);

            await pharmacyService.updatePhysicalCountItem(itemId, qty, notes);
        } catch (error) {
            console.error('Failed to update item', error);
        } finally {
            setSaving(null);
        }
    };

    const confirmApprove = async () => {
        setApproveError(null);
        setApproving(true);
        try {
            await pharmacyService.approvePhysicalCount(count.id);
            setIsApproveModalOpen(false);
            onUpdate(); // Reload to show approved status
        } catch (error) {
            console.error('Failed to approve', error);
            setApproveError('Failed to approve count. Please try again.');
        } finally {
            setApproving(false);
        }
    };

    const isEditable = count.status === 'in_progress';

    return (
        <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ChevronRight size={20} className="rotate-180 text-slate-500" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            Stock Count #{count.id}
                        </h1>
                        <StatusBadge status={count.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                        {format(new Date(count.created_at), 'PPP')} • Total Items: {items.length}
                    </p>
                </div>
                {isEditable && (
                    <button
                        onClick={() => setIsApproveModalOpen(true)}
                        disabled={approving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50"
                    >
                        {approving ? (
                            'Approving...'
                        ) : (
                            <>
                                <CheckCircle size={18} /> Complete & Approve
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur py-4 border-b border-gray-200 dark:border-gray-800 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search medicine or batch..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-healthcare-primary"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {approveError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/10 dark:text-rose-300">
                    {approveError}
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <table className="tc-table w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-500">
                                Medicine Details
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500">Batch Info</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                System Qty
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                Counted Qty
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                Variance
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500">Reason</th>
                            <th className="px-6 py-3 font-semibold text-slate-500">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredItems.map((item) => (
                            <tr
                                key={item.id}
                                className={
                                    item.variance !== 0 ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''
                                }
                            >
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                        {item.medicine?.name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                        {item.batch?.batch_number}
                                        <span className="text-slate-400 text-xs ml-1">
                                            ({item.batch?.id})
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-400">
                                    {item.system_quantity}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {isEditable ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <input
                                                type="number"
                                                className="w-20 px-2 py-1 text-right font-bold border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-healthcare-primary outline-none bg-transparent"
                                                value={item.counted_quantity}
                                                onChange={(e) =>
                                                    handleQuantityChange(
                                                        item.id,
                                                        Number(e.target.value),
                                                    )
                                                }
                                            />
                                            {saving === item.id && (
                                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-healthcare-primary border-t-transparent"></div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {item.counted_quantity}
                                        </span>
                                    )}
                                </td>
                                <td
                                    className={`px-6 py-4 text-right font-bold ${item.variance === 0 ? 'text-slate-400' : item.variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                                >
                                    {item.variance > 0 ? '+' : ''}
                                    {item.variance}
                                </td>
                                <td className="px-6 py-4">
                                    {isEditable && item.variance !== 0 ? (
                                        <select
                                            className="text-xs border border-slate-300 dark:border-slate-600 rounded bg-transparent px-1 py-0.5 outline-none focus:ring-1 focus:ring-healthcare-primary"
                                            value={item.notes || ''}
                                            onChange={(e) =>
                                                handleQuantityChange(
                                                    item.id,
                                                    item.counted_quantity,
                                                    e.target.value,
                                                )
                                            }
                                        >
                                            <option value="">Select Reason...</option>
                                            <option value="Damage">Damage</option>
                                            <option value="Theft">Theft</option>
                                            <option value="Expired">Expired</option>
                                            <option value="Data Entry Error">
                                                Data Entry Error
                                            </option>
                                            <option value="Found Stock">Found Stock</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    ) : (
                                        <span className="text-xs text-slate-500">
                                            {item.notes || '—'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {item.variance === 0 ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                            <CheckCircle size={12} /> Matched
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                            <AlertTriangle size={12} /> Deviation
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                isOpen={isApproveModalOpen}
                onClose={() => setIsApproveModalOpen(false)}
                onConfirm={confirmApprove}
                title="Approve Stock Count"
                message="Are you sure you want to approve this count? This will update stock levels."
                confirmText="Approve Count"
                cancelText="Cancel"
                loading={approving}
                variant="warning"
            />
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'in_progress':
            return (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                    In Progress
                </span>
            );
        case 'approved':
            return (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                    Approved
                </span>
            );
        case 'cancelled':
            return (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 text-xs font-bold border border-slate-100">
                    Cancelled
                </span>
            );
        default:
            return (
                <span className="px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-600 text-xs font-bold border border-gray-100">
                    {status}
                </span>
            );
    }
}
