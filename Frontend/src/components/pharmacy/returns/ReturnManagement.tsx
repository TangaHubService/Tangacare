import { useDeferredValue, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Eye,
    Hash,
    Loader2,
    RotateCcw,
    Search,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { Drawer } from '../../ui/Drawer';
import { parseLocalDate } from '../../../lib/date';
import type { CustomerReturn, ReturnStatus } from '../../../types/pharmacy';

const PAGE_SIZE = 10;
const formatMoney = (value: number | string | null | undefined) =>
    `RWF ${Math.round(Number(value || 0)).toLocaleString()}`;

export const ReturnManagement = ({ facilityId }: { facilityId: number }) => {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<ReturnStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearchTerm = useDeferredValue(searchTerm.trim());
    const [page, setPage] = useState(1);
    const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const { data: returnsData, isLoading } = useQuery({
        queryKey: ['returns', facilityId, statusFilter, deferredSearchTerm, page],
        queryFn: () =>
            pharmacyService.getReturns({
                facility_id: facilityId,
                status: statusFilter === 'all' ? undefined : statusFilter,
                sale_number: deferredSearchTerm || undefined,
                page,
                limit: PAGE_SIZE,
            }),
    });

    const selectedReturnQuery = useQuery({
        queryKey: ['return', selectedReturnId],
        queryFn: () => pharmacyService.getReturn(selectedReturnId as number),
        enabled: selectedReturnId !== null,
    });

    const selectedReturn = selectedReturnQuery.data as CustomerReturn | undefined;

    const invalidateReturns = async () => {
        await queryClient.invalidateQueries({ queryKey: ['returns'] });
        if (selectedReturnId !== null) {
            await queryClient.invalidateQueries({ queryKey: ['return', selectedReturnId] });
        }
    };

    const approveMutation = useMutation({
        mutationFn: (id: number) => pharmacyService.approveReturn(id),
        onSuccess: async () => {
            toast.success('Return approved');
            await invalidateReturns();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to approve return');
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) =>
            pharmacyService.rejectReturn(id, reason),
        onSuccess: async () => {
            toast.success('Return rejected');
            setRejectionReason('');
            await invalidateReturns();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to reject return');
        },
    });

    const processRefundMutation = useMutation({
        mutationFn: (id: number) => pharmacyService.processRefund(id),
        onSuccess: async () => {
            toast.success('Refund marked as processed');
            await invalidateReturns();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to process refund');
        },
    });

    const totalPages = Math.max(1, returnsData?.meta?.totalPages || 1);
    const isDetailMutating =
        approveMutation.isPending || rejectMutation.isPending || processRefundMutation.isPending;

    const summary = useMemo(() => {
        const rows = returnsData?.data ?? [];
        const totalValue = rows.reduce((sum, item) => sum + Number(item.total_refund_amount || 0), 0);
        const pendingCount = rows.filter((item) => item.status === 'pending').length;
        return {
            count: rows.length,
            totalValue,
            pendingCount,
        };
    }, [returnsData?.data]);

    const closeDrawer = () => {
        setSelectedReturnId(null);
        setRejectionReason('');
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Visible Returns
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {summary.count}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Refund Value
                    </p>
                        <p className="mt-2 text-2xl font-black text-healthcare-primary">
                        {formatMoney(summary.totalValue)}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Pending Review
                    </p>
                    <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-300">
                        {summary.pendingCount}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                        Customer Returns
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Review return history, inspect the original sale, and complete the approval
                        or refund step with a full audit trail.
                    </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                    <div className="relative flex-1 lg:w-72">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                        />
                        <input
                            type="text"
                            placeholder="Search sale number..."
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition focus:border-healthcare-primary focus:ring-2 focus:ring-healthcare-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-healthcare-primary focus:ring-2 focus:ring-healthcare-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as ReturnStatus | 'all');
                            setPage(1);
                        }}
                    >
                        <option value="all">All status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="tc-table w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Return
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Sale
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Processed By
                                </th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Refund
                                </th>
                                <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Date
                                </th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="p-0">
                                        <SkeletonTable
                                            rows={5}
                                            columns={7}
                                            headers={[
                                                'Return',
                                                'Sale',
                                                'Processed By',
                                                'Refund',
                                                'Status',
                                                'Date',
                                                'Actions',
                                            ]}
                                            columnAligns={[
                                                'left',
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
                            ) : returnsData?.data?.length ? (
                                returnsData.data.map((ret) => (
                                    <tr
                                        key={ret.id}
                                        className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-slate-100 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                    <Hash size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-mono text-xs font-black uppercase text-slate-900 dark:text-white">
                                                        {ret.return_number}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        {ret.items?.length || 0} item
                                                        {(ret.items?.length || 0) === 1 ? '' : 's'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-black text-healthcare-primary">
                                            {ret.sale?.sale_number || `Sale #${ret.sale_id}`}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {[
                                                ret.processedBy?.first_name,
                                                ret.processedBy?.last_name,
                                            ]
                                                .filter(Boolean)
                                                .join(' ') || 'Staff'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="font-black text-slate-900 dark:text-white">
                                                {formatMoney(ret.total_refund_amount)}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                {ret.refund_method.replace('_', ' ')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge status={ret.status} />
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {format(parseLocalDate(ret.created_at), 'MMM dd, yyyy')}
                                                </span>
                                                <span className="text-[11px] text-slate-400">
                                                    {format(parseLocalDate(ret.created_at), 'HH:mm')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {ret.status === 'pending' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => approveMutation.mutate(ret.id)}
                                                        disabled={approveMutation.isPending}
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Approve
                                                    </button>
                                                )}
                                                {ret.status === 'approved' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => processRefundMutation.mutate(ret.id)}
                                                        disabled={processRefundMutation.isPending}
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-300"
                                                    >
                                                        <DollarSign size={14} />
                                                        Refund
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedReturnId(ret.id)}
                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                                >
                                                    <Eye size={14} />
                                                    View
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <RotateCcw size={44} className="opacity-30" />
                                            <p className="font-semibold">
                                                No returns found for this filter.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        Showing page {page} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            disabled={page <= 1}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                            <ChevronLeft size={14} />
                            Prev
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            disabled={page >= totalPages}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                            Next
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <Drawer
                isOpen={selectedReturnId !== null}
                onClose={closeDrawer}
                size="xl"
                title={selectedReturn ? `Return ${selectedReturn.return_number}` : 'Return details'}
                subtitle={
                    selectedReturn?.sale?.sale_number
                        ? `Original sale ${selectedReturn.sale.sale_number}`
                        : undefined
                }
                showOverlay
            >
                {selectedReturnQuery.isLoading ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 size={16} className="animate-spin" />
                        Loading return details...
                    </div>
                ) : selectedReturn ? (
                    <div className="space-y-6 p-6">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <DetailCard
                                label="Status"
                                value={<StatusBadge status={selectedReturn.status} compact />}
                            />
                            <DetailCard
                                label="Refund Method"
                                value={selectedReturn.refund_method.replace('_', ' ')}
                            />
                            <DetailCard
                                label="Refund Amount"
                                value={formatMoney(selectedReturn.total_refund_amount)}
                            />
                            <DetailCard
                                label="Created"
                                value={format(parseLocalDate(selectedReturn.created_at), 'MMM dd, yyyy')}
                            />
                        </div>

                        <div className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
                            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                                        Return Items
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="tc-table w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900/60">
                                            <tr className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                                <th className="px-4 py-3 text-left">Medicine</th>
                                                <th className="px-4 py-3 text-left">Batch</th>
                                                <th className="px-4 py-3 text-right">Qty</th>
                                                <th className="px-4 py-3 text-left">Reason</th>
                                                <th className="px-4 py-3 text-left">Condition</th>
                                                <th className="px-4 py-3 text-right">Refund</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {(selectedReturn.items || []).map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                                        {item.medicine?.name || `Medicine #${item.medicine_id}`}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                        {item.batch?.batch_number || `Batch #${item.batch_id}`}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                                                        {item.quantity_returned}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 capitalize dark:text-slate-300">
                                                        {item.reason.replace(/_/g, ' ')}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {item.condition}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                                                        {formatMoney(item.refund_amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                                        Workflow
                                    </h3>
                                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                        <p>
                                            <span className="font-black text-slate-800 dark:text-slate-100">
                                                Submitted by:
                                            </span>{' '}
                                            {[
                                                selectedReturn.processedBy?.first_name,
                                                selectedReturn.processedBy?.last_name,
                                            ]
                                                .filter(Boolean)
                                                .join(' ') || 'Staff'}
                                        </p>
                                        <p>
                                            <span className="font-black text-slate-800 dark:text-slate-100">
                                                Approved by:
                                            </span>{' '}
                                            {selectedReturn.approvedBy
                                                ? [
                                                      selectedReturn.approvedBy.first_name,
                                                      selectedReturn.approvedBy.last_name,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' ')
                                                : 'Not approved yet'}
                                        </p>
                                        <p>
                                            <span className="font-black text-slate-800 dark:text-slate-100">
                                                Refund processed by:
                                            </span>{' '}
                                            {selectedReturn.refundProcessedBy
                                                ? [
                                                      selectedReturn.refundProcessedBy.first_name,
                                                      selectedReturn.refundProcessedBy.last_name,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' ')
                                                : 'Not processed yet'}
                                        </p>
                                        {selectedReturn.credit_note_id ? (
                                            <p>
                                                <span className="font-black text-slate-800 dark:text-slate-100">
                                                    Credit note:
                                                </span>{' '}
                                                #{selectedReturn.credit_note_id}
                                            </p>
                                        ) : null}
                                        {selectedReturn.notes ? (
                                            <div>
                                                <p className="font-black text-slate-800 dark:text-slate-100">
                                                    Notes
                                                </p>
                                                <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-900/70">
                                                    {selectedReturn.notes}
                                                </p>
                                            </div>
                                        ) : null}
                                        {selectedReturn.rejection_reason ? (
                                            <div>
                                                <p className="font-black text-rose-700 dark:text-rose-300">
                                                    Rejection reason
                                                </p>
                                                <p className="mt-1 rounded-xl bg-rose-50 p-3 text-sm leading-relaxed text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                                                    {selectedReturn.rejection_reason}
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {selectedReturn.status === 'pending' && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                                            Review Decision
                                        </h3>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Add a rejection reason if this return should not be approved..."
                                            className="mt-4 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-healthcare-primary focus:ring-2 focus:ring-healthcare-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        />
                                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                            <button
                                                type="button"
                                                onClick={() => approveMutation.mutate(selectedReturn.id)}
                                                disabled={isDetailMutating}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <CheckCircle2 size={16} />
                                                Approve Return
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!rejectionReason.trim()) {
                                                        toast.error('Rejection reason is required');
                                                        return;
                                                    }
                                                    rejectMutation.mutate({
                                                        id: selectedReturn.id,
                                                        reason: rejectionReason.trim(),
                                                    });
                                                }}
                                                disabled={isDetailMutating}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black uppercase tracking-wide text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300"
                                            >
                                                <XCircle size={16} />
                                                Reject Return
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {selectedReturn.status === 'approved' && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                                            Refund Step
                                        </h3>
                                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                            When the refund or credit note has been completed, mark it here
                                            so the return closes cleanly.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => processRefundMutation.mutate(selectedReturn.id)}
                                            disabled={isDetailMutating}
                                            className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-healthcare-primary px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <DollarSign size={16} />
                                            Mark Refund Processed
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                        Select a return to view its details.
                    </div>
                )}
            </Drawer>
        </div>
    );
};

function StatusBadge({
    status,
    compact = false,
}: {
    status: ReturnStatus;
    compact?: boolean;
}) {
    const styles: Record<ReturnStatus, string> = {
        pending:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60',
        approved:
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/60',
        rejected:
            'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/60',
        completed:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/60',
    };

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full border py-1 text-[10px] font-black uppercase tracking-[0.18em] ${compact ? 'px-2.5' : 'px-3'} ${styles[status]}`}
        >
            {status}
        </span>
    );
}

function DetailCard({
    label,
    value,
}: {
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {label}
            </p>
            <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{value}</div>
        </div>
    );
}
