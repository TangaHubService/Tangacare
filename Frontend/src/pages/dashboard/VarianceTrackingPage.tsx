import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import type { StockVariance } from '../../types/pharmacy';
import { VarianceStatus } from '../../types/pharmacy';
import { format } from 'date-fns';
import { parseLocalDate } from '../../lib/date';
import {
    Scale,
    CheckCircle,
    XCircle,
    Search,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
} from 'lucide-react';
import { SkeletonTable } from '../../components/ui/SkeletonTable';

export function VarianceTrackingPage() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [variances, setVariances] = useState<StockVariance[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<VarianceStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [page] = useState(1);

    const loadVariances = async () => {
        if (!effectiveFacilityId) return;
        setLoading(true);
        try {
            const response = await pharmacyService.getVariances({
                facility_id: effectiveFacilityId,
                status: statusFilter === 'all' ? undefined : statusFilter,
                page,
                limit: 15,
            });
            setVariances(response.data);
        } catch (error) {
            console.error('Failed to load variances', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVariances();
    }, [effectiveFacilityId, statusFilter, page]);

    const handleApprove = async (id: number) => {
        if (
            !window.confirm(
                'Are you sure you want to approve this variance? This will adjust stock levels.',
            )
        )
            return;
        try {
            await pharmacyService.approveVariance(id);
            loadVariances();
        } catch (error) {
            console.error('Failed to approve variance', error);
            alert('Error approving variance');
        }
    };

    const handleReject = async (id: number) => {
        const reason = window.prompt('Please provide a reason for rejection:');
        if (reason === null) return;
        try {
            await pharmacyService.rejectVariance(id, reason);
            loadVariances();
        } catch (error) {
            console.error('Failed to reject variance', error);
            alert('Error rejecting variance');
        }
    };

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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                            <Scale className="text-healthcare-primary" /> Variance Tracking
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Monitor and approve inventory discrepancies and automated adjustments.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                size={16}
                            />
                            <input
                                type="text"
                                placeholder="Search medicine..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-healthcare-primary/20 w-full md:w-64"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                        >
                            <option value="all">All Status</option>
                            <option value={VarianceStatus.PENDING}>Pending</option>
                            <option value={VarianceStatus.APPROVED}>Approved</option>
                            <option value={VarianceStatus.REJECTED}>Rejected</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <SkeletonTable
                        rows={8}
                        columns={7}
                        headers={[
                            'Date',
                            'Medicine',
                            'Batch',
                            'System vs Physical',
                            'Variance',
                            'Status',
                        ]}
                        columnAligns={['left', 'left', 'left', 'right', 'right', 'left', 'right']}
                        actions
                        className="border-none shadow-none"
                    />
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto">
                        <table className="tc-table w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">
                                        Medicine
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">
                                        Batch
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-right">
                                        System vs Physical
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-right">
                                        Variance
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {variances.length > 0 ? (
                                    variances.map((v) => (
                                        <tr
                                            key={v.id}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900 dark:text-white">
                                                    {format(parseLocalDate(v.created_at), 'MMM d, yyyy')}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {format(parseLocalDate(v.created_at), 'p')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-healthcare-dark dark:text-white">
                                                    {v.medicine?.name}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {v.variance_type.replace(/_/g, ' ')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">
                                                {v.batch?.batch_number || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-slate-500 text-xs">
                                                    Sys: {v.system_quantity}
                                                </div>
                                                <div className="font-bold text-slate-900 dark:text-white">
                                                    Phy: {v.physical_quantity}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div
                                                    className={`inline-flex items-center gap-1 font-black ${
                                                        v.variance_quantity > 0
                                                            ? 'text-emerald-500'
                                                            : v.variance_quantity < 0
                                                              ? 'text-rose-500'
                                                              : 'text-slate-400'
                                                    }`}
                                                >
                                                    {v.variance_quantity > 0 ? (
                                                        <ArrowUpRight size={14} />
                                                    ) : v.variance_quantity < 0 ? (
                                                        <ArrowDownRight size={14} />
                                                    ) : null}
                                                    {v.variance_quantity > 0 ? '+' : ''}
                                                    {v.variance_quantity}
                                                </div>
                                                {v.variance_value && (
                                                    <div className="text-[10px] text-slate-400">
                                                        {v.variance_value.toLocaleString()} RWF
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={v.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {v.status === VarianceStatus.PENDING ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(v.id)}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                                                            title="Approve & Adjust"
                                                        >
                                                            <CheckCircle size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(v.id)}
                                                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                                            title="Reject"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">
                                                        Processed by{' '}
                                                        {v.approved_by?.first_name || 'System'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-6 py-12 text-center text-slate-400"
                                        >
                                            {loading ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Searching variances...
                                                </div>
                                            ) : (
                                                'No variances found matching your filters.'
                                            )}
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

function StatusBadge({ status }: { status: VarianceStatus }) {
    switch (status) {
        case VarianceStatus.PENDING:
            return (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-wider">
                    Pending
                </span>
            );
        case VarianceStatus.APPROVED:
            return (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-wider">
                    Approved
                </span>
            );
        case VarianceStatus.REJECTED:
            return (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-wider">
                    Rejected
                </span>
            );
    }
}
