import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../lib/api';
import { parseLocalDate } from '../../lib/date';

// Define types locally for now, or import if available
interface PurchaseOrderItem {
    id: number;
    medicine_id: number;
    medicine: {
        id?: number;
        name: string;
        code: string;
    };
    quantity_ordered: number;
    unit_price: number;
    quoted_unit_price?: number;
    backorder_qty?: number;
    quantity_available?: number;
    notes?: string;
    total_price: number;
}

interface PurchaseOrderActivity {
    id: number;
    action: string;
    description: string;
    created_at: string;
    actor_type: string;
}

interface PurchaseOrder {
    id: number;
    order_number: string;
    status: string;
    order_date: string;
    total_amount: number;
    facility: {
        name: string;
        address: string;
        contact_phone: string;
    };
    supplier: {
        name: string;
    };
    items: PurchaseOrderItem[];
    is_viewed_by_supplier: boolean;
    activities?: PurchaseOrderActivity[];
}

export const PublicPurchaseOrder = () => {
    const { token } = useParams({ from: '/public/po/$token' });
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showClarification, setShowClarification] = useState(false);
    const [clarificationMessage, setClarificationMessage] = useState('');
    const [quotedItems, setQuotedItems] = useState<any[]>([]);
    const [isQuoting, setIsQuoting] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                // Using a direct fetch or axios instance that doesn't require auth headers if possible, 
                // but 'api' service likely has interceptors. 
                // We might need a separate axios instance or ensure the endpoint is public.
                // Assuming /api/public/po/:token is open.
                const response = await api.get(`/public/po/${token}`);
                const orderData = response.data.data;
                setOrder(orderData);
                
                // Initialize quoted items from current order items
                if (orderData.items) {
                    setQuotedItems(orderData.items.map((item: any) => ({
                        medicine_id: item.medicine_id || item.medicine?.id,
                        quoted_unit_price: item.quoted_unit_price || item.unit_price,
                        quantity_available: item.quantity_available !== undefined ? item.quantity_available : item.quantity_ordered,
                        notes: item.notes || ''
                    })));
                }
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to load purchase order');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchOrder();
        }
    }, [token]);

    const handleAction = async (action: 'approve' | 'confirm' | 'clarification' | 'reject' | 'delivered' | 'quote') => {
        if (!order) return;

        setActionLoading(true);
        try {
            const response = await api.post(`/public/po/${token}/action`, {
                action,
                data: action === 'clarification' 
                    ? { message: clarificationMessage } 
                    : action === 'quote'
                        ? { items: quotedItems }
                        : undefined
            });

            // Update local state immediately with the returned updated order
            if (response.data && response.data.data) {
                setOrder(response.data.data);
            }

            toast.success(`Order ${action === 'clarification' ? 'clarification requested' : action + 'ed'} successfully`);

            if (action === 'clarification') {
                setShowClarification(false);
                setClarificationMessage('');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Failed to ${action} order`);
        } finally {
            setActionLoading(false);
            setIsQuoting(false);
        }
    };

    const handleQuoteChange = (medicineId: number, field: string, value: any) => {
        setQuotedItems(prev => prev.map(item => 
            item.medicine_id === medicineId ? { ...item, [field]: value } : item
        ));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
                    <p className="text-gray-600">The purchase order link may be invalid or expired.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-teal-100 selection:text-teal-900">
            <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                {/* Brand / Header Area */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-600 shadow-lg shadow-teal-600/20 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        Purchase Order Details
                    </h1>
                    <p className="mt-2 text-lg text-slate-600">
                        {order.facility?.name || 'Unknown facility'}
                    </p>
                </div>

                <div className="bg-white shadow-xl shadow-slate-200/60 rounded-2xl overflow-hidden border border-slate-100">
                    {/* Status Banner */}
                    <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Order Number</span>
                            <span className="text-xl font-black text-slate-800">{order.order_number}</span>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-2 ${['APPROVED', 'CONFIRMED', 'DELIVERED', 'RECEIVED'].includes(order.status.toUpperCase())
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : order.status.toUpperCase() === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${['APPROVED', 'CONFIRMED', 'DELIVERED', 'RECEIVED'].includes(order.status.toUpperCase()) ? 'bg-teal-500' :
                                order.status.toUpperCase() === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
                                }`}></span>
                            {order.status.replace(/_/g, ' ')}
                        </div>
                      
                    </div>

                    <div className="p-8">
                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">From</span>
                                <h3 className="font-bold text-slate-800 text-lg">{order.facility?.name || 'Unknown facility'}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">{order.facility?.address || ''}</p>
                                <p className="text-slate-500 text-sm">{order.facility?.contact_phone || ''}</p>
                            </div>
                            <div className="flex flex-col gap-1 md:text-right">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">To Supplier</span>
                                <h3 className="font-bold text-slate-800 text-lg">{order.supplier?.name || 'Unknown supplier'}</h3>
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1">Date Sent</span>
                                <p className="text-slate-700 font-medium">{format(parseLocalDate(order.order_date), 'MMMM dd, yyyy')}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden mb-8">
                            <table className="tc-table w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Item Description</th>
                                        <th className="px-6 py-4 text-center">Qty</th>
                                        <th className="px-6 py-4 text-right">Unit Cost</th>
                                        <th className="px-6 py-4 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {order.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700">{item.medicine?.name ?? `Medicine #${item.medicine_id}`}</div>
                                                <div className="text-xs text-slate-400 font-medium">{item.medicine?.code}</div>
                                                {isQuoting && (
                                                    <input 
                                                        type="text"
                                                        placeholder="Notes/Remarks"
                                                        value={quotedItems.find(i => i.medicine_id === item.medicine_id)?.notes || ''}
                                                        onChange={(e) => handleQuoteChange(item.medicine_id, 'notes', e.target.value)}
                                                        className="mt-2 w-full px-2 py-1 text-xs border rounded outline-none focus:ring-1 focus:ring-teal-500"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 font-medium bg-slate-50/30">
                                                {isQuoting ? (
                                                    <input 
                                                        type="number"
                                                        value={quotedItems.find(i => i.medicine_id === item.medicine_id)?.quantity_available || 0}
                                                        onChange={(e) => handleQuoteChange(item.medicine_id, 'quantity_available', Number(e.target.value))}
                                                        className="w-16 px-1 py-1 text-center border rounded outline-none focus:ring-1 focus:ring-teal-500"
                                                    />
                                                ) : item.quantity_ordered}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-600 tabular-nums">
                                                {isQuoting ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="text-xs text-slate-400">RWF</span>
                                                        <input 
                                                            type="number"
                                                            value={quotedItems.find(i => i.medicine_id === item.medicine_id)?.quoted_unit_price || 0}
                                                            onChange={(e) => handleQuoteChange(item.medicine_id, 'quoted_unit_price', Number(e.target.value))}
                                                            className="w-24 px-1 py-1 text-right border rounded outline-none focus:ring-1 focus:ring-teal-500 font-bold"
                                                        />
                                                    </div>
                                                ) : (item.quoted_unit_price || item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800 tabular-nums bg-slate-50/30">
                                                {isQuoting 
                                                    ? ((quotedItems.find(i => i.medicine_id === item.medicine_id)?.quoted_unit_price || 0) * (item.quantity_ordered)).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                                    : item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-200">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-xs tracking-wider">Total Amount</td>
                                        <td className="px-6 py-4 text-right font-black text-lg text-teal-700 tracking-tight">
                                            {order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Actions Area */}
                        {['PENDING', 'ORDERED', 'SUBMITTED', 'DRAFT', 'QUOTED', 'PARTIALLY_QUOTED'].includes(order.status.toUpperCase()) ? (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 bg-teal-50 rounded-xl border border-teal-100 text-teal-800 text-sm flex gap-3 items-start">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <p>
                                        {['QUOTED', 'PARTIALLY_QUOTED'].includes(order.status.toUpperCase())
                                            ? 'Quotation submitted. Waiting for pharmacy to review and accept.'
                                            : isQuoting
                                                ? 'Fill in your unit prices for each item and adjust available quantities, then submit your quotation.'
                                                : 'The pharmacy is requesting the items above. Please submit a quotation with your prices.'}
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    {isQuoting ? (
                                        <>
                                            <button
                                                onClick={() => handleAction('quote')}
                                                disabled={actionLoading}
                                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? 'Submitting...' : 'Submit Quotation'}
                                            </button>
                                            <button
                                                onClick={() => setIsQuoting(false)}
                                                disabled={actionLoading}
                                                className="px-6 py-2.5 bg-white text-slate-500 border rounded-xl font-bold"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : ['QUOTED', 'PARTIALLY_QUOTED'].includes(order.status.toUpperCase()) ? (
                                        <button
                                            onClick={() => setIsQuoting(true)}
                                            className="flex-1 bg-teal-50 text-teal-700 border border-teal-200 px-6 py-2.5 rounded-xl font-bold hover:bg-teal-100 transition-colors"
                                        >
                                            Update Quotation
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setIsQuoting(true)}
                                                disabled={actionLoading}
                                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50"
                                            >
                                                Submit Quotation with Prices
                                            </button>
                                            <button
                                                onClick={() => handleAction('reject')}
                                                disabled={actionLoading}
                                                className="bg-white hover:bg-red-50 text-slate-500 border border-slate-200 px-6 py-2.5 rounded-xl font-bold hover:text-red-600 transition-colors disabled:opacity-50"
                                            >
                                                Cannot Fulfill
                                            </button>
                                        </>
                                    )}
                                    {!isQuoting && (
                                        <button
                                            onClick={() => setShowClarification(true)}
                                            disabled={actionLoading}
                                            className="sm:flex-none text-slate-500 hover:text-teal-600 px-4 py-2 font-bold text-sm transition-colors"
                                        >
                                            Ask Question
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                {order.status.toUpperCase() === 'REJECTED' ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </div>
                                        <h3 className="font-bold text-slate-800">Order Rejected</h3>
                                        <p className="text-slate-500 text-sm mt-1">You have opted to reject this order.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h3 className="font-bold text-slate-800">Order Approved</h3>
                                        <p className="text-slate-500 text-sm mt-1">Thank you for accepting this order. No further action is required here.</p>
                                        <button
                                            onClick={() => setShowClarification(true)}
                                            className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-bold hover:underline"
                                        >
                                            Need to contact the facility?
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Activity Log (Collapsed or Subtle) */}
                        {order.activities && order.activities.length > 0 && (
                            <div className="mt-12 pt-8 border-t border-slate-100">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Activity Timeline</h4>
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:w-0.5 before:-translate-x-1/2 before:bg-slate-100">
                                    {order.activities.map((activity) => (
                                        <div key={activity.id} className="relative pl-8 flex flex-col gap-1">
                                            <div className={`absolute left-0 w-5 h-5 rounded-full border-4 border-white shadow-sm ${activity.action === 'rejected' ? 'bg-red-500' :
                                                activity.action === 'approved' ? 'bg-teal-500' :
                                                    activity.action === 'clarification_requested' ? 'bg-amber-400' : 'bg-slate-300'
                                                }`}></div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                {format(parseLocalDate(activity.created_at), 'MMM dd, HH:mm')}
                                            </span>
                                            <p className="text-sm font-medium text-slate-800">
                                                {activity.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                            Secure Purchase Order System &copy; {new Date().getFullYear()} TangaCare
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showClarification && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-black text-slate-800 mb-2">Request Clarification</h3>
                        <p className="text-slate-500 text-sm mb-4">
                            Send a message to the facility administrator regarding this order.
                        </p>
                        <textarea
                            value={clarificationMessage}
                            onChange={(e) => setClarificationMessage(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[120px] text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Type your question or message here..."
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowClarification(false)}
                                className="px-5 py-2.5 text-slate-500 hover:text-slate-700 font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleAction('clarification')}
                                disabled={!clarificationMessage.trim() || actionLoading}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:shadow-none"
                            >
                                {actionLoading ? 'Sending...' : 'Send Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
