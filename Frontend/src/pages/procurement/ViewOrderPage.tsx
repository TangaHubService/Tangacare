import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import {
    FileText,
    Download,
    Printer,
    Truck,
    User,
    Hash,
    ArrowLeft,
    ChevronDown,
    CheckCircle2,
    XCircle,
    Clock,
    TrendingUp,
    Info,
} from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import { procurementService } from '../../services/procurement.service';
import type { ProcurementOrder } from '../../types/pharmacy';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import tangaLogo from '../../assets/tanga-logo.png';
import { formatLocalDate, formatLocalDateTime } from '../../lib/date';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PriceSuggestion {
    medicine_id: number;
    last_quoted_price?: number;
    last_accepted_price?: number;
    last_selling_price?: number;
    last_order_date?: string;
    last_margin_percent?: number;
}

function getStatusBadgeClass(status: string) {
    const s = status.toUpperCase();
    if (s === 'RECEIVED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    if (['ACCEPTED', 'APPROVED', 'CONFIRMED', 'ORDERED'].includes(s))
        return 'bg-teal-50 text-teal-600 border border-teal-100';
    if (['PARTIALLY_ACCEPTED', 'PARTIALLY_RECEIVED', 'PARTIAL', 'BACKORDERED'].includes(s))
        return 'bg-indigo-50 text-indigo-600 border border-indigo-100';
    if (s === 'SUBMITTED') return 'bg-blue-50 text-blue-600 border border-blue-100';
    if (['QUOTED', 'PARTIALLY_QUOTED'].includes(s))
        return 'bg-violet-50 text-violet-600 border border-violet-100';
    if (s === 'DRAFT') return 'bg-slate-100 text-slate-500 border border-slate-200';
    if (['REJECTED', 'CANCELLED'].includes(s))
        return 'bg-red-50 text-red-600 border border-red-100';
    return 'bg-amber-50 text-amber-600 border border-amber-100';
}

export function ViewOrderPage() {
    const { orderId } = useParams({ from: '/app/procurement/orders/$orderId' });
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [order, setOrder] = useState<ProcurementOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState(false);
    const [reviewData, setReviewData] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
    const [priceSuggestions, setPriceSuggestions] = useState<Record<number, PriceSuggestion>>({});

    const toggleActivityExpand = (activityId: number) => {
        const newExpanded = new Set(expandedActivities);
        if (newExpanded.has(activityId)) {
            newExpanded.delete(activityId);
        } else {
            newExpanded.add(activityId);
        }
        setExpandedActivities(newExpanded);
    };

    const fetchOrder = useCallback(async () => {
        try {
            const data = await pharmacyService.getProcurementOrder(Number(orderId));
            setOrder(data);

            if (data.items) {
                setReviewData(
                    data.items.map((item: any) => ({
                        medicine_id: item.medicine_id,
                        accepted_unit_price:
                            item.accepted_unit_price || item.quoted_unit_price || item.unit_price,
                        selling_price: item.selling_price || 0,
                        status: item.status === 'rejected' ? 'rejected' : 'accepted',
                    })),
                );
            }
        } catch (error) {
            console.error('Failed to fetch order details', error);
            toast.error('Failed to load order details');
            navigate({ to: '/app/procurement' as any, search: {} as any });
        } finally {
            setLoading(false);
        }
    }, [orderId, navigate]);

    const fetchPriceSuggestions = useCallback(async (ord: ProcurementOrder) => {
        if (!ord.items || !ord.supplier_id) return;
        try {
            const suggestions: Record<number, PriceSuggestion> = {};
            await Promise.all(
                ord.items.map(async (item) => {
                    try {
                        const res = await procurementService.getPriceSuggestions(
                            ord.supplier_id,
                            item.medicine_id,
                        );
                        if (res)
                            suggestions[item.medicine_id] = {
                                medicine_id: item.medicine_id,
                                ...res,
                            };
                    } catch {
                        // silently ignore per-item failures
                    }
                }),
            );
            setPriceSuggestions(suggestions);
        } catch {
            // non-critical
        }
    }, []);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    useEffect(() => {
        if (!socket) return;

        const handlePOUpdate = (data: { orderId: number; action: string }) => {
            if (data.orderId === Number(orderId)) {
                toast.success(`Order updated: ${data.action}`);
                fetchOrder();
            }
        };

        socket.on('po_updated', handlePOUpdate);

        return () => {
            socket.off('po_updated', handlePOUpdate);
        };
    }, [socket, orderId, fetchOrder]);

    // Load price suggestions when entering review mode
    useEffect(() => {
        if (reviewing && order) {
            fetchPriceSuggestions(order);
        }
    }, [reviewing, order, fetchPriceSuggestions]);

    const handleReviewSubmit = async () => {
        // Validate: every accepted item must have a selling price
        const missingSellingPrice = reviewData.filter(
            (item) =>
                item.status === 'accepted' && (!item.selling_price || item.selling_price <= 0),
        );
        if (missingSellingPrice.length > 0) {
            toast.error('Please set a selling price for all accepted items before confirming.');
            return;
        }
        setActionLoading(true);
        try {
            await procurementService.reviewQuotation(Number(orderId), reviewData);
            const acceptedCount = reviewData.filter((i) => i.status === 'accepted').length;
            const rejectedCount = reviewData.filter((i) => i.status === 'rejected').length;
            toast.success(
                acceptedCount === reviewData.length
                    ? 'All items accepted — order confirmed!'
                    : rejectedCount === reviewData.length
                      ? 'Order rejected.'
                      : `${acceptedCount} item(s) accepted, ${rejectedCount} rejected.`,
            );
            setReviewing(false);
            fetchOrder();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to submit review');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReviewChange = (medicineId: number, field: string, value: any) => {
        setReviewData((prev) =>
            prev.map((item) =>
                item.medicine_id === medicineId ? { ...item, [field]: value } : item,
            ),
        );
    };

    const handleAcceptAll = () => {
        setReviewData((prev) => prev.map((item) => ({ ...item, status: 'accepted' })));
    };

    const handleRejectAll = () => {
        setReviewData((prev) => prev.map((item) => ({ ...item, status: 'rejected' })));
    };

    const getMargin = (cost: number, selling: number) => {
        if (!cost || !selling || selling <= 0) return null;
        return (((selling - cost) / selling) * 100).toFixed(1);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin mb-4" />
                    <p className="text-slate-500 font-bold animate-pulse">
                        Loading order details...
                    </p>
                </div>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
            {/* sticky header with back link, title and actions */}
            <div className="top-0 z-20 bg-transiparnt  dark:bg-transiparnt print:hidden">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 md:p-6 border-b">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/app/procurement"
                            search={{}}
                            className="inline-flex items-center gap-2 text-slate-500 hover:text-healthcare-primary font-bold transition-colors"
                        >
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-healthcare-primary/20">
                                <ArrowLeft size={18} />
                            </div>
                            Back
                        </Link>
                        <h2 className="text-xl font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                            <FileText size={20} className="text-healthcare-primary" />
                            PO-{order.id.toString().padStart(4, '0')}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {['QUOTED', 'PARTIALLY_QUOTED', 'SUBMITTED'].includes(
                            order.status.toUpperCase(),
                        ) && (
                            <button
                                onClick={() => setReviewing(!reviewing)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors shadow-sm',
                                    reviewing
                                        ? 'bg-red-500 text-white'
                                        : 'bg-teal-600 text-white hover:bg-teal-700',
                                )}
                            >
                                <FileText size={18} />
                                {reviewing ? 'Cancel Review' : 'Review Quotation'}
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                            title="Print or save as PDF"
                        >
                            <Printer size={18} />
                            Print / PDF
                        </button>
                        <button
                            onClick={() => pharmacyService.exportProcurementOrder(order.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 transition-colors shadow-md shadow-teal-500/10"
                            title="Export Excel"
                        >
                            <Download size={18} />
                            Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* main content card */}
            <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 print:shadow-none print:rounded-none">
                {/* header removed - it's now part of sticky bar above */}

                <div className="flex-1 p-6 md:p-8 print:p-0">
                    {/* two‑column layout: left = order details, right = activity history */}
                    <div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-2">
                                        <img
                                            src={tangaLogo}
                                            alt="TangaCare logo"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-black text-healthcare-dark tracking-tight uppercase">
                                            TangaCare
                                        </h1>
                                        <p className="text-[10px] font-black uppercase text-healthcare-primary tracking-widest leading-none">
                                            Pharmacy & Healthcare
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-healthcare-dark dark:text-white">
                                        {order.facility?.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium max-w-xs">
                                        {order.facility?.address}
                                    </p>
                                    <p className="text-sm text-slate-500 font-medium">
                                        Tel: {order.facility?.phone}
                                    </p>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {order.facility?.email}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-5xl font-black text-slate-100 dark:text-slate-700 mb-6 uppercase tracking-tighter italic">
                                    Purchase Order
                                </h2>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-shadow whitespace-nowrap">
                                    <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-left">
                                        <span className="text-xs font-semibold text-slate-500">
                                            Order No.
                                        </span>
                                        <span className="text-sm font-black text-healthcare-dark dark:text-white tracking-tight">
                                            PO-{order.id.toString().padStart(4, '0')}
                                        </span>

                                        <span className="text-xs font-semibold text-slate-500">
                                            Date
                                        </span>
                                        <span className="text-sm font-bold text-healthcare-dark dark:text-white">
                                            {formatLocalDate(order.order_date)}
                                        </span>

                                        <span className="text-xs font-semibold text-slate-500">
                                            Status
                                        </span>
                                        <span
                                            className={cn(
                                                'text-[10px] font-black uppercase px-2.5 py-1 rounded-lg w-fit',
                                                getStatusBadgeClass(order.status),
                                            )}
                                        >
                                            {(order.status || '').replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <Truck size={14} className="text-slate-400" />
                                    <h4 className="text-sm font-bold text-healthcare-dark dark:text-white">
                                        Supplier Details
                                    </h4>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-base font-bold text-healthcare-dark dark:text-white">
                                        {order.supplier?.name}
                                    </p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                <Hash size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1">
                                                    Tax ID
                                                </p>
                                                <p className="text-sm font-bold text-slate-600">
                                                    {order.supplier?.tax_id || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1">
                                                    Contact Person
                                                </p>
                                                <p className="text-sm font-bold text-slate-600">
                                                    {order.supplier?.contact_person}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                <FileText size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1">
                                                    Email Address
                                                </p>
                                                <p className="text-sm font-bold text-slate-600 underline underline-offset-2 decoration-slate-200">
                                                    {order.supplier?.email}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <FileText size={14} className="text-slate-400" />
                                    <h4 className="text-sm font-bold text-healthcare-dark dark:text-white">
                                        Pricing Summary
                                    </h4>
                                </div>
                                <div className="bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-2xl space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 font-medium text-xs">
                                            Subtotal
                                        </span>
                                        <span className="font-bold text-healthcare-dark dark:text-white">
                                            RWF {Number(order.subtotal_amount).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 font-medium text-xs">
                                            Discount ({order.discount_percent}%)
                                        </span>
                                        <span className="font-bold text-red-500">
                                            - RWF {Number(order.discount_amount).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 font-medium text-xs">
                                            VAT ({order.vat_rate}%)
                                        </span>
                                        <span className="font-bold text-healthcare-dark dark:text-white">
                                            RWF {Number(order.vat_amount).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700 mt-2">
                                        <span className="text-sm font-bold text-healthcare-dark dark:text-white">
                                            Total
                                        </span>
                                        <span className="text-2xl font-black text-healthcare-primary">
                                            RWF {Number(order.total_amount).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h4 className="text-sm font-bold text-healthcare-dark dark:text-white">
                                    {reviewing
                                        ? 'Review Items — Accept / Reject Each Line'
                                        : 'Order Items'}
                                </h4>
                                {reviewing && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAcceptAll}
                                            className="px-3 py-1 text-[10px] font-black uppercase rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50 transition-colors"
                                        >
                                            Accept All
                                        </button>
                                        <button
                                            onClick={handleRejectAll}
                                            className="px-3 py-1 text-[10px] font-black uppercase rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            Reject All
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm shadow-slate-100/50">
                                <table className="tc-table w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-bold text-healthcare-dark dark:text-white">
                                                Item / Medicine
                                            </th>
                                            <th className="px-6 py-3 text-xs font-bold text-healthcare-dark dark:text-white text-right">
                                                Qty
                                            </th>
                                            <th className="px-6 py-3 text-xs font-bold text-healthcare-dark dark:text-white text-right">
                                                Pricing
                                            </th>
                                            {!reviewing && (
                                                <th className="px-6 py-3 text-xs font-bold text-healthcare-dark dark:text-white text-right">
                                                    Total
                                                </th>
                                            )}
                                            {!reviewing && (
                                                <th className="px-6 py-3 text-xs font-bold text-healthcare-dark dark:text-white text-center">
                                                    Status
                                                </th>
                                            )}
                                            {reviewing && (
                                                <th className="px-6 py-3 text-xs font-bold text-violet-700 dark:text-violet-400 text-right">
                                                    Review Decision
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {order.items?.map((item) => {
                                            const reviewItem = reviewData.find(
                                                (r) => r.medicine_id === item.medicine_id,
                                            );
                                            const suggestion = priceSuggestions[item.medicine_id];
                                            const margin = reviewItem
                                                ? getMargin(
                                                      reviewItem.accepted_unit_price,
                                                      reviewItem.selling_price,
                                                  )
                                                : null;
                                            const isRejected = reviewing
                                                ? reviewItem?.status === 'rejected'
                                                : item.status === 'rejected';
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={cn(
                                                        'transition-colors',
                                                        isRejected
                                                            ? 'bg-red-50/40 dark:bg-red-950/20 opacity-60'
                                                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30',
                                                    )}
                                                >
                                                    <td className="px-6 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-healthcare-dark dark:text-white text-sm">
                                                                {item.medicine?.name}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                                                {(item.medicine as any)?.strength} •{' '}
                                                                {
                                                                    (item.medicine as any)
                                                                        ?.dosage_form
                                                                }
                                                            </span>
                                                            {item.notes && (
                                                                <span className="mt-1 text-xs text-amber-600 font-medium italic">
                                                                    Supplier note: {item.notes}
                                                                </span>
                                                            )}
                                                            {reviewing &&
                                                                suggestion?.last_order_date && (
                                                                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                                                        <Info size={10} />
                                                                        Last ordered{' '}
                                                                        {formatLocalDate(
                                                                            suggestion.last_order_date,
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <div className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-healthcare-dark dark:text-white">
                                                            {item.quantity_ordered}
                                                        </div>
                                                        {item.quantity_available !== undefined &&
                                                            item.quantity_available !==
                                                                item.quantity_ordered && (
                                                                <div className="text-[10px] text-red-500 font-bold mt-1">
                                                                    Avail: {item.quantity_available}
                                                                </div>
                                                            )}
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="text-xs font-semibold text-slate-500">
                                                                Req:{' '}
                                                                <span className="text-slate-700 dark:text-slate-300">
                                                                    RWF{' '}
                                                                    {Number(
                                                                        item.unit_price,
                                                                    ).toLocaleString()}
                                                                </span>
                                                            </span>
                                                            {item.quoted_unit_price && (
                                                                <span className="text-xs font-black text-violet-600">
                                                                    Quoted: RWF{' '}
                                                                    {Number(
                                                                        item.quoted_unit_price,
                                                                    ).toLocaleString()}
                                                                </span>
                                                            )}
                                                            {item.accepted_unit_price &&
                                                                !reviewing && (
                                                                    <span className="text-xs font-black text-teal-600">
                                                                        Accepted: RWF{' '}
                                                                        {Number(
                                                                            item.accepted_unit_price,
                                                                        ).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            {item.selling_price && !reviewing && (
                                                                <span className="text-[10px] font-bold text-healthcare-primary">
                                                                    Selling: RWF{' '}
                                                                    {Number(
                                                                        item.selling_price,
                                                                    ).toLocaleString()}
                                                                </span>
                                                            )}
                                                            {reviewing &&
                                                                suggestion?.last_quoted_price && (
                                                                    <span className="text-[10px] text-indigo-500 font-medium mt-0.5">
                                                                        Prev quoted: RWF{' '}
                                                                        {Number(
                                                                            suggestion.last_quoted_price,
                                                                        ).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            {reviewing &&
                                                                suggestion?.last_selling_price && (
                                                                    <span className="text-[10px] text-emerald-600 font-medium">
                                                                        Prev selling: RWF{' '}
                                                                        {Number(
                                                                            suggestion.last_selling_price,
                                                                        ).toLocaleString()}
                                                                    </span>
                                                                )}
                                                        </div>
                                                    </td>
                                                    {!reviewing && (
                                                        <td className="px-6 py-3 text-right">
                                                            <span className="text-sm font-bold text-healthcare-dark dark:text-white tracking-tight">
                                                                RWF{' '}
                                                                {Number(
                                                                    item.total_price,
                                                                ).toLocaleString()}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {!reviewing && (
                                                        <td className="px-6 py-3 text-center">
                                                            {item.status && (
                                                                <span
                                                                    className={cn(
                                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase',
                                                                        item.status === 'accepted'
                                                                            ? 'bg-teal-50 text-teal-600 border border-teal-100'
                                                                            : item.status ===
                                                                                'rejected'
                                                                              ? 'bg-red-50 text-red-500 border border-red-100'
                                                                              : item.status ===
                                                                                  'quoted'
                                                                                ? 'bg-violet-50 text-violet-600 border border-violet-100'
                                                                                : 'bg-slate-100 text-slate-500 border border-slate-200',
                                                                    )}
                                                                >
                                                                    {item.status === 'accepted' && (
                                                                        <CheckCircle2 size={9} />
                                                                    )}
                                                                    {item.status === 'rejected' && (
                                                                        <XCircle size={9} />
                                                                    )}
                                                                    {item.status === 'quoted' && (
                                                                        <Clock size={9} />
                                                                    )}
                                                                    {item.status}
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {reviewing && reviewItem && (
                                                        <td className="px-4 py-3 bg-violet-50/30 dark:bg-violet-950/10">
                                                            <div className="flex flex-col gap-2 items-end min-w-[220px]">
                                                                {/* Accept / Reject toggle */}
                                                                <div className="flex gap-1.5">
                                                                    <button
                                                                        onClick={() =>
                                                                            handleReviewChange(
                                                                                item.medicine_id,
                                                                                'status',
                                                                                'accepted',
                                                                            )
                                                                        }
                                                                        className={cn(
                                                                            'flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-colors',
                                                                            reviewItem.status ===
                                                                                'accepted'
                                                                                ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                                                                                : 'bg-white text-slate-400 border-slate-200 hover:border-teal-300 hover:text-teal-600',
                                                                        )}
                                                                    >
                                                                        <CheckCircle2 size={10} />
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleReviewChange(
                                                                                item.medicine_id,
                                                                                'status',
                                                                                'rejected',
                                                                            )
                                                                        }
                                                                        className={cn(
                                                                            'flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-colors',
                                                                            reviewItem.status ===
                                                                                'rejected'
                                                                                ? 'bg-red-500 text-white border-red-500 shadow-sm'
                                                                                : 'bg-white text-slate-400 border-slate-200 hover:border-red-300 hover:text-red-500',
                                                                        )}
                                                                    >
                                                                        <XCircle size={10} />
                                                                        Reject
                                                                    </button>
                                                                </div>

                                                                {reviewItem.status ===
                                                                    'accepted' && (
                                                                    <>
                                                                        {/* Accepted price */}
                                                                        <div className="flex items-center gap-2 w-full justify-end">
                                                                            <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">
                                                                                Cost Price
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                value={
                                                                                    reviewItem.accepted_unit_price ||
                                                                                    ''
                                                                                }
                                                                                onChange={(e) =>
                                                                                    handleReviewChange(
                                                                                        item.medicine_id,
                                                                                        'accepted_unit_price',
                                                                                        Number(
                                                                                            e.target
                                                                                                .value,
                                                                                        ),
                                                                                    )
                                                                                }
                                                                                placeholder="0"
                                                                                className="w-24 px-2 py-1 text-xs border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none font-bold text-right"
                                                                            />
                                                                        </div>

                                                                        {/* Selling price */}
                                                                        <div className="flex items-center gap-2 w-full justify-end">
                                                                            <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">
                                                                                Selling Price *
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                value={
                                                                                    reviewItem.selling_price ||
                                                                                    ''
                                                                                }
                                                                                onChange={(e) =>
                                                                                    handleReviewChange(
                                                                                        item.medicine_id,
                                                                                        'selling_price',
                                                                                        Number(
                                                                                            e.target
                                                                                                .value,
                                                                                        ),
                                                                                    )
                                                                                }
                                                                                placeholder="0"
                                                                                className={cn(
                                                                                    'w-24 px-2 py-1 text-xs border rounded-lg focus:ring-1 outline-none font-bold text-right',
                                                                                    !reviewItem.selling_price ||
                                                                                        reviewItem.selling_price <=
                                                                                            0
                                                                                        ? 'border-red-300 focus:ring-red-400 text-red-500'
                                                                                        : 'border-healthcare-primary/30 focus:ring-healthcare-primary text-healthcare-primary',
                                                                                )}
                                                                            />
                                                                        </div>

                                                                        {/* Margin indicator */}
                                                                        {margin !== null && (
                                                                            <div
                                                                                className={cn(
                                                                                    'flex items-center gap-1 text-[10px] font-bold',
                                                                                    Number(
                                                                                        margin,
                                                                                    ) >= 20
                                                                                        ? 'text-emerald-600'
                                                                                        : Number(
                                                                                                margin,
                                                                                            ) >= 10
                                                                                          ? 'text-amber-600'
                                                                                          : 'text-red-500',
                                                                                )}
                                                                            >
                                                                                <TrendingUp
                                                                                    size={10}
                                                                                />
                                                                                Margin: {margin}%
                                                                            </div>
                                                                        )}

                                                                        {/* Quick-fill suggestion */}
                                                                        {suggestion?.last_selling_price &&
                                                                            !reviewItem.selling_price && (
                                                                                <button
                                                                                    onClick={() =>
                                                                                        handleReviewChange(
                                                                                            item.medicine_id,
                                                                                            'selling_price',
                                                                                            suggestion.last_selling_price,
                                                                                        )
                                                                                    }
                                                                                    className="text-[9px] text-indigo-500 hover:text-indigo-700 font-bold hover:underline"
                                                                                >
                                                                                    Use previous:
                                                                                    RWF{' '}
                                                                                    {Number(
                                                                                        suggestion.last_selling_price,
                                                                                    ).toLocaleString()}
                                                                                </button>
                                                                            )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {reviewing && (
                            <div className="mb-12 p-5 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-100 dark:border-violet-900 shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div>
                                    <h4 className="text-base font-black text-violet-800 dark:text-violet-300 uppercase tracking-tight mb-1">
                                        Confirm Review Decision
                                    </h4>
                                    <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                                        {reviewData.filter((i) => i.status === 'accepted').length}{' '}
                                        accepted ·{' '}
                                        {reviewData.filter((i) => i.status === 'rejected').length}{' '}
                                        rejected
                                        {reviewData.some(
                                            (i) =>
                                                i.status === 'accepted' &&
                                                (!i.selling_price || i.selling_price <= 0),
                                        ) && (
                                            <span className="ml-2 text-red-500 font-black">
                                                — selling price required for accepted items
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setReviewing(false)}
                                        disabled={actionLoading}
                                        className="px-5 py-2.5 bg-white text-slate-500 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReviewSubmit}
                                        disabled={actionLoading}
                                        className="px-8 py-2.5 bg-violet-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-violet-700 shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {order.notes && (
                            <div className="mb-8">
                                <h4 className="text-sm font-bold text-healthcare-dark dark:text-white mb-2">
                                    Order Notes
                                </h4>
                                <div className="text-sm text-slate-600 bg-teal-50/30 dark:bg-slate-800/30 p-6 rounded-2xl italic font-medium border-l-4 border-teal-500/20">
                                    "{order.notes}"
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        {order.activities && order.activities.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-healthcare-dark dark:text-white mb-4">
                                    Activity History
                                </h4>
                                <div className="relative pl-6">
                                    <div className="absolute top-0 bottom-0 left-2 w-px bg-slate-300" />
                                    {order.activities.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="relative mb-4 cursor-pointer group"
                                            onClick={() => toggleActivityExpand(activity.id)}
                                        >
                                            <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-slate-400 group-hover:bg-healthcare-primary transition-colors"></div>
                                            <div className="ml-6 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="font-semibold text-healthcare-dark dark:text-white capitalize text-sm">
                                                            {activity.action.replace(/_/g, ' ')}
                                                        </span>
                                                        <ChevronDown
                                                            size={16}
                                                            className={`text-slate-400 transition-transform ${
                                                                expandedActivities.has(activity.id)
                                                                    ? 'rotate-180'
                                                                    : ''
                                                            }`}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                                                        {formatLocalDateTime(
                                                            activity.created_at,
                                                        )}
                                                    </span>
                                                </div>
                                                {expandedActivities.has(activity.id) && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                        <p className="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap font-medium mb-2">
                                                            {activity.description}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            By:{' '}
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                                                                {activity.actor_type}
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="print-footer p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Generated via TangaCare Pharmacy ERP Management System
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                        Powered by Tanghub services https://www.tangahubservice.com/
                    </p>
                </div>
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @media print {
                    @page {
                        size: A4;
                        margin: 12mm 14mm;
                    }
                    html, body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    /* Suppress the entire app shell */
                    nav, header, aside,
                    [class*="sidebar"], [class*="topbar"],
                    [class*="Sidebar"], [class*="Header"],
                    [class*="MainLayout"] { display: none !important; }

                    /* Show only the document area */
                    .print\\:hidden { display: none !important; }
                    .print\\:p-0 { padding: 0 !important; }

                    .max-w-5xl {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .min-h-screen { min-height: 0 !important; }

                    /* Card */
                    .bg-white, .dark\\:bg-slate-900 { background: white !important; }
                    .bg-slate-50, .bg-slate-50\\/50 { background: #f8fafc !important; }
                    .shadow-xl, .shadow-sm, .shadow-md { box-shadow: none !important; }
                    .rounded-3xl, .rounded-2xl, .rounded-xl { border-radius: 0 !important; }

                    /* Items table */
                    .tc-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 11px !important;
                        table-layout: fixed !important;
                    }
                    .tc-table th,
                    .tc-table td {
                        padding: 6px 10px !important;
                        border: 1px solid #e2e8f0 !important;
                        vertical-align: top !important;
                        word-break: break-word !important;
                    }
                    .tc-table thead th { background: #f1f5f9 !important; font-weight: 800 !important; }
                    tr { break-inside: avoid !important; page-break-inside: avoid !important; }

                    /* Colors */
                    .text-healthcare-primary { color: #0d9488 !important; }
                    .text-healthcare-dark { color: #0f172a !important; }

                    /* Footer */
                    .print-footer {
                        border-top: 1px solid #e2e8f0 !important;
                        margin-top: 16px !important;
                        padding: 12px 32px !important;
                        background: #f8fafc !important;
                        text-align: center;
                    }
                }
            `,
                }}
            />
        </div>
    );
}
