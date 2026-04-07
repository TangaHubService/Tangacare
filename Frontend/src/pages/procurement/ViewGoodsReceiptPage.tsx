import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Printer, Building2, Truck } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { GoodsReceipt } from '../../types/pharmacy';
import toast from 'react-hot-toast';
import tangaLogo from '../../assets/tanga-logo.png';
import { formatLocalDate, formatLocalDateTime } from '../../lib/date';

export function ViewGoodsReceiptPage() {
    const { receiptId } = useParams({ from: '/app/procurement/receipts/$receiptId' });
    const navigate = useNavigate();
    const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchReceipt = async () => {
            try {
                const data = await pharmacyService.getGoodsReceipt(Number(receiptId));
                setReceipt(data);
            } catch (error) {
                console.error('Failed to load goods receipt', error);
                toast.error('Failed to load goods receipt');
                navigate({ to: '/app/procurement/receipts' as any, search: {} as any });
            } finally {
                setLoading(false);
            }
        };
        fetchReceipt();
    }, [navigate, receiptId]);

    const summary = useMemo(() => {
        const items = receipt?.items || [];
        const totalUnits = items.reduce(
            (sum, item) => sum + Number(item.quantity_received || 0),
            0,
        );
        const totalValue = items.reduce(
            (sum, item) => sum + Number(item.quantity_received || 0) * Number(item.unit_cost || 0),
            0,
        );
        return { totalUnits, totalValue };
    }, [receipt]);

    const handlePrint = () => window.print();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[380px]">
                <div className="w-12 h-12 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!receipt) return null;

    const receivedDate = receipt.received_date
        ? formatLocalDateTime(receipt.received_date)
        : 'N/A';
    const receivedBy =
        receipt.received_by?.first_name ||
        receipt.received_by?.email ||
        `User #${receipt.received_by_id}`;
    const poNumber = receipt.purchase_order?.order_number || `PO-${receipt.purchase_order_id}`;
    const supplierName = receipt.purchase_order?.supplier?.name || 'N/A';
    const facilityName = (receipt.purchase_order as any)?.facility?.name || '';
    const facilityAddress = (receipt.purchase_order as any)?.facility?.address || '';

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
            {/* Top bar — hidden when printing */}
            <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <button
                    onClick={() => navigate({ to: '/app/procurement/receipts' as any, search: {} as any })}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-healthcare-primary text-sm font-bold transition-colors"
                >
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-healthcare-primary/20">
                        <ArrowLeft size={16} />
                    </div>
                    Back to Goods Receipts
                </button>

                <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors shadow-md shadow-teal-500/10"
                >
                    <Printer size={16} />
                    Print / Save PDF
                </button>
            </div>

            {/* ─── Printable document ──────────────────────────────────── */}
            <div
                ref={printRef}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden print:shadow-none print:rounded-none print:border-0"
            >
                {/* Document header */}
                <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start mb-8">
                        {/* Facility branding */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-1.5">
                                    <img
                                        src={tangaLogo}
                                        alt="TangaCare"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-healthcare-dark dark:text-white uppercase tracking-tight">
                                        TangaCare
                                    </h1>
                                    <p className="text-[10px] font-black uppercase text-healthcare-primary tracking-widest leading-none">
                                        Pharmacy &amp; Healthcare
                                    </p>
                                </div>
                            </div>
                            {facilityName && (
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {facilityName}
                                </p>
                            )}
                            {facilityAddress && (
                                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                                    {facilityAddress}
                                </p>
                            )}
                        </div>

                        {/* Document title + metadata */}
                        <div className="text-right">
                            <h2 className="text-4xl font-black text-slate-100 dark:text-slate-700 uppercase tracking-tighter italic mb-4">
                                Goods Receipt
                            </h2>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left whitespace-nowrap">
                                <div className="grid grid-cols-2 gap-x-10 gap-y-1.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Receipt No.
                                    </span>
                                    <span className="text-sm font-black text-healthcare-dark dark:text-white tracking-tight">
                                        {receipt.receipt_number || `GR-${receipt.id}`}
                                    </span>

                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Purchase Order
                                    </span>
                                    <span className="text-sm font-bold text-healthcare-dark dark:text-white">
                                        {poNumber}
                                    </span>

                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Date Received
                                    </span>
                                    <span className="text-sm font-bold text-healthcare-dark dark:text-white">
                                        {receivedDate}
                                    </span>

                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Received By
                                    </span>
                                    <span className="text-sm font-bold text-healthcare-dark dark:text-white">
                                        {receivedBy}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Supplier & facility info row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <Truck size={13} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Supplier
                                </span>
                            </div>
                            <p className="text-base font-bold text-healthcare-dark dark:text-white">
                                {supplierName}
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <Building2 size={13} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Received At
                                </span>
                            </div>
                            <p className="text-base font-bold text-healthcare-dark dark:text-white">
                                {facilityName || 'Main Pharmacy'}
                            </p>
                        </div>
                    </div>

                    {/* Notes */}
                    {receipt.notes && (
                        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                                Notes
                            </p>
                            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                {receipt.notes}
                            </p>
                        </div>
                    )}

                    {/* Items table */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                            Received Items
                        </h3>
                        <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-sm print-table">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            #
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            Medicine
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            Batch No.
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            Expiry Date
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                                            Qty
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                                            Unit Cost
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                                            Line Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {(receipt.items || []).map((item, idx) => {
                                        const lineTotal =
                                            Number(item.quantity_received || 0) *
                                            Number(item.unit_cost || 0);
                                        const expiryDate = item.expiry_date
                                            ? formatLocalDate(item.expiry_date)
                                            : item.batch?.expiry_date
                                              ? formatLocalDate(item.batch.expiry_date)
                                              : '-';
                                        const batchNo =
                                            item.batch_number || item.batch?.batch_number || '-';
                                        return (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                            >
                                                <td className="px-4 py-3 text-xs text-slate-400 font-bold">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-healthcare-dark dark:text-white text-sm">
                                                        {item.medicine?.name ||
                                                            `Medicine #${item.medicine_id}`}
                                                    </p>
                                                    {(item.medicine as any)?.strength && (
                                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                            {(item.medicine as any).strength} ·{' '}
                                                            {(item.medicine as any).dosage_form}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                                                    {batchNo}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {expiryDate}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-black text-right text-healthcare-dark dark:text-white tabular-nums">
                                                    {Number(
                                                        item.quantity_received || 0,
                                                    ).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-right text-slate-500 dark:text-slate-400 tabular-nums">
                                                    {Number(item.unit_cost || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-black text-right text-healthcare-primary tabular-nums">
                                                    RWF {lineTotal.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400 text-right"
                                        >
                                            Total Units
                                        </td>
                                        <td className="px-4 py-3 text-sm font-black text-right text-healthcare-dark dark:text-white tabular-nums">
                                            {summary.totalUnits.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400 text-right">
                                            Total Value
                                        </td>
                                        <td className="px-4 py-3 text-base font-black text-right text-healthcare-primary tabular-nums">
                                            RWF {summary.totalValue.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="border-b-2 border-slate-300 dark:border-slate-600 mb-2 h-10" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Received By
                            </p>
                            <p className="text-sm font-black text-healthcare-dark dark:text-white mt-0.5">
                                {receivedBy}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{receivedDate}</p>
                        </div>
                        <div>
                            <div className="border-b-2 border-slate-300 dark:border-slate-600 mb-2 h-10" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Authorized Signatory
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Pharmacy Manager / Procurement Officer
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Generated via TangaCare Pharmacy ERP Management System
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                        Powered by Tangahub services · https://www.tangahubservice.com/
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
                    /* Hide everything except the document */
                    body > * { display: none !important; }
                    #root, [data-root] { display: block !important; }
                    /* Show only the printable card */
                    .print\\:hidden { display: none !important; }
                    nav, header, aside, footer,
                    [class*="sidebar"], [class*="topbar"], [class*="MainLayout"],
                    [class*="Sidebar"], [class*="Header"] { display: none !important; }

                    .max-w-4xl {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                    }
                    .min-h-screen { min-height: 0 !important; }
                    /* Card */
                    .bg-white, .dark\\:bg-slate-900 { background: white !important; }
                    .bg-slate-50 { background: #f8fafc !important; }
                    .shadow-xl, .shadow-sm, .shadow-md { box-shadow: none !important; }
                    .rounded-3xl, .rounded-2xl, .rounded-xl { border-radius: 0 !important; }
                    /* Table */
                    .print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 11px !important;
                    }
                    .print-table th,
                    .print-table td {
                        padding: 6px 8px !important;
                        border: 1px solid #e2e8f0 !important;
                        vertical-align: top !important;
                        word-break: break-word !important;
                    }
                    .print-table thead th {
                        background: #f1f5f9 !important;
                        font-weight: 800 !important;
                    }
                    .print-table tfoot td {
                        background: #f1f5f9 !important;
                        font-weight: 800 !important;
                    }
                    tr { break-inside: avoid !important; }
                    /* Colors */
                    .text-healthcare-primary { color: #0d9488 !important; }
                    .text-healthcare-dark { color: #0f172a !important; }
                    /* Signatures */
                    .border-b-2 { border-bottom: 2px solid #cbd5e1 !important; }
                }
            `,
                }}
            />
        </div>
    );
}
