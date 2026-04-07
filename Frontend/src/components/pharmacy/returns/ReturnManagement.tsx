import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    RotateCcw,
    Search,
    CheckCircle2,
    Eye,
    MoreVertical,
    DollarSign,
    ArrowRightLeft,
    Hash,
} from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { format } from 'date-fns';
import { parseLocalDate } from '../../../lib/date';
import type { CustomerReturn, ReturnStatus } from '../../../types/pharmacy';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

export const ReturnManagement = ({ facilityId }: { facilityId: number }) => {
    const { formatMoney } = useRuntimeConfig();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<ReturnStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: returnsData, isLoading } = useQuery({
        queryKey: ['returns', facilityId, statusFilter, searchTerm],
        queryFn: () =>
            pharmacyService.getReturns({
                facility_id: facilityId,
                status: statusFilter === 'all' ? undefined : statusFilter,
                sale_number: searchTerm || undefined,
            }),
    });

    const approveMutation = useMutation({
        mutationFn: (id: number) => pharmacyService.approveReturn(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['returns'] });
        },
    });

    const processRefundMutation = useMutation({
        mutationFn: (id: number) => pharmacyService.processRefund(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['returns'] });
        },
    });

    const getStatusBadge = (status: ReturnStatus) => {
        const styles = {
            pending:
                'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
            approved:
                'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
            rejected:
                'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
            completed:
                'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        };
        return (
            <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[status]}`}
            >
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <RotateCcw size={20} className="text-healthcare-primary" />
                        Customer Returns
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                        Manage and process medicine returns & refunds
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                        />
                        <input
                            type="text"
                            placeholder="Search sale number..."
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none font-bold text-slate-600"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="tc-table w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                                    Return Info
                                </th>
                                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                                    Sale Reference
                                </th>
                                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">
                                    Refund Amount
                                </th>
                                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">
                                    Status
                                </th>
                                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                                    Date
                                </th>
                                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-0">
                                        <SkeletonTable
                                            rows={5}
                                            columns={6}
                                            headers={[
                                                'Return Info',
                                                'Sale Reference',
                                                'Refund Amount',
                                                'Status',
                                                'Date',
                                            ]}
                                            columnAligns={[
                                                'left',
                                                'left',
                                                'right',
                                                'center',
                                                'left',
                                                'right',
                                            ]}
                                            actions
                                            className="border-none shadow-none"
                                        />
                                    </td>
                                </tr>
                            ) : returnsData?.data && returnsData.data.length > 0 ? (
                                returnsData.data.map((ret: CustomerReturn) => (
                                    <tr
                                        key={ret.id}
                                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                                                    <Hash size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-mono text-xs font-black text-slate-900 dark:text-white">
                                                        {ret.return_number}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-medium">
                                                        By ID:{' '}
                                                        {ret.processedBy?.first_name || 'Staff'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <ArrowRightLeft
                                                    size={14}
                                                    className="text-slate-300"
                                                />
                                                <span className="font-black text-healthcare-primary text-xs uppercase tracking-tight">
                                                    {ret.sale?.sale_number ||
                                                        `Sale #${ret.sale_id}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="font-black text-slate-900 dark:text-white">
                                                {formatMoney(ret.total_refund_amount)}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                {ret.refund_method.replace('_', ' ')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(ret.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                    {format(
                                                        parseLocalDate(ret.created_at),
                                                        'MMM dd, yyyy',
                                                    )}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {format(parseLocalDate(ret.created_at), 'HH:mm')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 outline-none">
                                                {ret.status === 'pending' && (
                                                    <button
                                                        onClick={() =>
                                                            approveMutation.mutate(ret.id)
                                                        }
                                                        disabled={approveMutation.isPending}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                                        title="Approve Return"
                                                    >
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                )}
                                                {ret.status === 'approved' && (
                                                    <button
                                                        onClick={() =>
                                                            processRefundMutation.mutate(ret.id)
                                                        }
                                                        disabled={processRefundMutation.isPending}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-healthcare-primary text-white rounded-lg text-xs font-black hover:bg-teal-700 transition-colors shadow-sm"
                                                    >
                                                        <DollarSign size={14} /> Refund
                                                    </button>
                                                )}
                                                <button className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                                    <Eye size={18} />
                                                </button>
                                                <button className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 uppercase font-black text-[10px]">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-300">
                                            <RotateCcw size={48} className="opacity-10" />
                                            <p className="font-medium">
                                                No returns found matching your criteria
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {returnsData?.meta && (
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>
                            Showing {returnsData.data.length} of {returnsData.meta.total} returns
                        </span>
                        <div className="flex gap-2">
                            {/* Pagination would go here */}
                            <button className="px-3 py-1 bg-white border border-slate-200 rounded-md opacity-50 cursor-not-allowed">
                                Prev
                            </button>
                            <button className="px-3 py-1 bg-white border border-slate-200 rounded-md opacity-50 cursor-not-allowed">
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
