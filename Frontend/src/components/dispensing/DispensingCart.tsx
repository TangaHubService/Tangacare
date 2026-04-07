import React from 'react';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import type { CartItem } from '../../types/pharmacy';
import { toSentenceCase } from '../../lib/text';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';

interface DispensingCartProps {
    cart: CartItem[];
    updateQuantity: (id: number, batchId: number, delta: number, stockId?: number) => void;
    removeFromCart: (id: number, batchId: number, stockId?: number) => void;
    subtotal: number;
    tax: number;
    total: number;
    onCheckout: () => void;
    isProcessing: boolean;
    prescriptionId?: string;
    setPrescriptionId?: (id: string) => void;
    prescriptionRequired?: boolean;
    readOnly?: boolean;
}

export const DispensingCart: React.FC<DispensingCartProps> = ({
    cart,
    updateQuantity,
    removeFromCart,
    subtotal,
    tax,
    total,
    onCheckout,
    isProcessing,
    prescriptionId,
    setPrescriptionId,
    prescriptionRequired,
    readOnly = false,
}) => {
    const { formatMoney, vatRate } = useRuntimeConfig();

    if (cart.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <ShoppingCart size={48} className="mb-4 opacity-50" />
                <p className="text-sm font-medium">Your cart is empty</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-3 p-1">
                {cart.map((item) => (
                    <div
                        key={`${item.id}-${item.selectedBatch?.id || 'no-batch'}`}
                        className="group flex flex-col gap-1.5 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 text-center">
                                    {item.name}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    {String(item.strength || '').toLowerCase()} •{' '}
                                    {toSentenceCase(item.dosage_form)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                    {formatMoney(item.selling_price)} /{' '}
                                    {toSentenceCase(item.unit)}
                                </p>
                            </div>
                            <div>
                                {item.selectedBatch?.id && (
                                    <div className="flex justify-center mt-0.5">
                                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase">
                                            {toSentenceCase(
                                                item.selectedBatch.location?.name || 'Main Shelf',
                                            )}
                                        </span>
                                    </div>
                                )}

                                {item.is_controlled_drug && (
                                    <div className="flex justify-center">
                                        <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800 w-fit text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">
                                            Controlled Drug
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 items-center mt-0.5">
                                    <div />
                                    <div className="justify-self-center flex items-center gap-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-1">
                                        <button
                                            onClick={() =>
                                                updateQuantity(
                                                    item.id,
                                                    item.selectedBatch?.id || 0,
                                                    -1,
                                                    item.selectedBatch?.stock_id,
                                                )
                                            }
                                            className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-400 hover:text-healthcare-primary disabled:opacity-50"
                                            disabled={readOnly || item.quantity <= 1}
                                        >
                                            <Minus size={12} />
                                        </button>
                                        <span className="text-xs font-bold w-4 text-center">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() =>
                                                updateQuantity(
                                                    item.id,
                                                    item.selectedBatch?.id || 0,
                                                    1,
                                                    item.selectedBatch?.stock_id,
                                                )
                                            }
                                            className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-400 hover:text-healthcare-primary disabled:opacity-50"
                                            disabled={readOnly}
                                        >
                                            <Plus size={12} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() =>
                                            removeFromCart(
                                                item.id,
                                                item.selectedBatch?.id || 0,
                                                item.selectedBatch?.stock_id,
                                            )
                                        }
                                        disabled={readOnly}
                                        className="justify-self-end p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                {prescriptionRequired && setPrescriptionId && (
                    <div className="space-y-1 animate-in slide-in-from-bottom-2 fade-in">
                        <label className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">
                            Prescription ID Required *
                        </label>
                        <input
                            type="text"
                            value={prescriptionId}
                            onChange={(e) => setPrescriptionId(e.target.value)}
                            placeholder="Enter RX Number..."
                            className="w-full px-3 py-2 text-sm rounded-lg border-2 border-orange-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        />
                    </div>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-tight">
                        <span>Subtotal</span>
                        <span>{formatMoney(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-tight">
                        <span>
                            Tax ({subtotal > 0 ? ((tax / subtotal) * 100).toFixed(0) : Math.round(vatRate * 100)}%)
                        </span>
                        <span>{formatMoney(tax)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span>Total</span>
                        <span>{formatMoney(total)}</span>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={onCheckout}
                        disabled={
                            readOnly || isProcessing || (prescriptionRequired && !prescriptionId)
                        }
                        className="w-full py-3 bg-healthcare-primary hover:bg-healthcare-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-healthcare-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isProcessing
                            ? 'Processing...'
                            : readOnly
                              ? 'View Only Mode'
                              : 'Proceed to Payment'}
                    </button>
                    {prescriptionRequired && !prescriptionId && (
                        <p className="text-[10px] text-center text-orange-500 font-bold mt-2">
                            Enter Prescription ID to checkout
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
