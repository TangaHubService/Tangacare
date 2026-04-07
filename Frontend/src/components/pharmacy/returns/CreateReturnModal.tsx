import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight,
    Minus,
    Plus,
    CreditCard,
    Smartphone,
    Wallet,
    FileText,
} from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import type { Sale, RefundMethod, ReturnReason, ItemCondition } from '../../../types/pharmacy';
import { Drawer } from '../../ui/Drawer';

interface CreateReturnModalProps {
    sale: Sale;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateReturnModal = ({ sale, onClose, onSuccess }: CreateReturnModalProps) => {
    const queryClient = useQueryClient();
    const [notes, setNotes] = useState('');
    const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
    const [returnItems, setReturnItems] = useState<
        Array<{
            sale_item_id: number;
            medicine_id: number;
            batch_id: number;
            medicine_name: string;
            max_quantity: number;
            quantity_returned: number;
            reason: ReturnReason;
            condition: ItemCondition;
            unit_price: number;
        }>
    >(
        sale.items?.map((item) => ({
            sale_item_id: item.id,
            medicine_id: item.medicine_id,
            batch_id: item.batch_id,
            medicine_name: item.medicine?.name || 'Medicine',
            max_quantity: item.quantity,
            quantity_returned: 0,
            reason: 'customer_request',
            condition: 'resellable',
            unit_price: item.unit_price,
        })) || [],
    );

    const createReturnMutation = useMutation({
        mutationFn: (payload: any) => pharmacyService.createReturn(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['returns'] });
            onSuccess();
            onClose();
        },
    });

    const updateItemQuantity = (index: number, delta: number) => {
        const newItems = [...returnItems];
        const item = newItems[index];
        const newVal = Math.max(0, Math.min(item.max_quantity, item.quantity_returned + delta));
        item.quantity_returned = newVal;
        setReturnItems(newItems);
    };

    const updateItemField = (index: number, field: string, value: any) => {
        const newItems = [...returnItems];
        (newItems[index] as any)[field] = value;
        setReturnItems(newItems);
    };

    const totalRefund = returnItems.reduce(
        (sum, item) => sum + item.quantity_returned * item.unit_price,
        0,
    );
    const hasItemsToReturn = returnItems.some((item) => item.quantity_returned > 0);

    const handleSubmit = () => {
        if (!hasItemsToReturn) return;

        const payload = {
            sale_id: sale.id,
            facility_id: sale.facility_id,
            refund_method: refundMethod,
            notes,
            items: returnItems
                .filter((item) => item.quantity_returned > 0)
                .map((item) => ({
                    sale_item_id: item.sale_item_id,
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    quantity_returned: item.quantity_returned,
                    reason: item.reason,
                    condition: item.condition,
                    refund_amount: item.quantity_returned * item.unit_price,
                })),
        };

        createReturnMutation.mutate(payload);
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="lg"
            title="Initiate Return"
            subtitle={`Sale No: ${sale.sale_number}`}
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 w-full rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Items List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                Select Items to Return
                            </h3>
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md uppercase">
                                Max quantities restricted by sale
                            </span>
                        </div>

                        <div className="space-y-3">
                            {returnItems.map((item, index) => (
                                <div
                                    key={item.sale_item_id}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        item.quantity_returned > 0
                                            ? 'border-healthcare-primary bg-healthcare-primary/5 dark:bg-teal-900/10'
                                            : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {item.medicine_name}
                                            </p>
                                            <p className="text-xs text-slate-400 font-medium">
                                                Unit Price: RWF {item.unit_price.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => updateItemQuantity(index, -1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                                                disabled={item.quantity_returned <= 0}
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="w-8 text-center font-black text-slate-900 dark:text-white">
                                                {item.quantity_returned}
                                            </span>
                                            <button
                                                onClick={() => updateItemQuantity(index, 1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                                                disabled={
                                                    item.quantity_returned >= item.max_quantity
                                                }
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {item.quantity_returned > 0 && (
                                        <div className="grid grid-cols-2 gap-3 mt-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                                    Reason
                                                </label>
                                                <select
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-bold"
                                                    value={item.reason}
                                                    onChange={(e) =>
                                                        updateItemField(
                                                            index,
                                                            'reason',
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="customer_request">
                                                        Customer Request
                                                    </option>
                                                    <option value="damaged">Damaged</option>
                                                    <option value="expired">Expired</option>
                                                    <option value="wrong_item">Wrong Item</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                                    Condition
                                                </label>
                                                <select
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-bold"
                                                    value={item.condition}
                                                    onChange={(e) =>
                                                        updateItemField(
                                                            index,
                                                            'condition',
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="resellable">Resellable</option>
                                                    <option value="damaged">Damaged</option>
                                                    <option value="expired">Expired</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800" />

                    {/* Refund & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                Refund Method
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setRefundMethod('cash')}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                                        refundMethod === 'cash'
                                            ? 'bg-healthcare-primary text-white border-healthcare-primary'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600'
                                    }`}
                                >
                                    <Wallet size={16} /> Cash
                                </button>
                                <button
                                    onClick={() => setRefundMethod('mobile_money')}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                                        refundMethod === 'mobile_money'
                                            ? 'bg-healthcare-primary text-white border-healthcare-primary'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600'
                                    }`}
                                >
                                    <Smartphone size={16} /> MoMo
                                </button>
                                <button
                                    onClick={() => setRefundMethod('card')}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                                        refundMethod === 'card'
                                            ? 'bg-healthcare-primary text-white border-healthcare-primary'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600'
                                    }`}
                                >
                                    <CreditCard size={16} /> Card
                                </button>
                                <button
                                    onClick={() => setRefundMethod('credit_note')}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                                        refundMethod === 'credit_note'
                                            ? 'bg-healthcare-primary text-white border-healthcare-primary'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600'
                                    }`}
                                >
                                    <FileText size={16} /> Credit Note
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                Notes
                            </h3>
                            <textarea
                                placeholder="Details about this return..."
                                className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none resize-none focus:ring-2 focus:ring-healthcare-primary/20"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                            Estimated Refund
                        </p>
                        <p className="text-2xl font-black text-healthcare-primary">
                            RWF {totalRefund.toLocaleString()}
                        </p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 md:flex-none px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl text-sm font-black hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!hasItemsToReturn || createReturnMutation.isPending}
                            className="flex-1 md:flex-none px-10 py-3 bg-healthcare-primary text-white rounded-2xl text-sm font-black hover:bg-teal-700 transition-all shadow-lg shadow-healthcare-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {createReturnMutation.isPending ? (
                                'Processing...'
                            ) : (
                                <>
                                    Initiate Return <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Drawer>
    );
};
