import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Batch } from '../../types/pharmacy';
import {
    AlertTriangle,
    ArrowUpCircle,
    ArrowDownCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Drawer } from '../ui/Drawer';

type UiAdjustmentType = 'increase' | 'decrease' | 'damage' | 'expired' | 'return';

interface StockAdjustmentModalProps {
    batch: Batch;
    onClose: () => void;
    onSuccess: () => void;
    /** When opening from batch workspace shortcuts (e.g. mark expired). */
    initialAdjustmentType?: UiAdjustmentType;
}

type UiAdjustmentReason = 'correction' | 'damage' | 'expiry' | 'loss' | 'customer_return';

const reasonByType: Record<UiAdjustmentType, UiAdjustmentReason> = {
    increase: 'correction',
    decrease: 'correction',
    damage: 'damage',
    expired: 'expiry',
    return: 'customer_return',
};

const adjustmentSchema = yup.object({
    type: yup.string().oneOf(['increase', 'decrease', 'damage', 'expired', 'return']).required(),
    reason: yup
        .string()
        .oneOf(['correction', 'damage', 'expiry', 'loss', 'customer_return'])
        .required('Reason is required'),
    quantity: yup.number().min(1, 'Quantity must be at least 1').required('Required'),
    notes: yup.string().required('Notes are required').min(5, 'Notes must be detailed'),
});

export function StockAdjustmentModal({
    batch,
    onClose,
    onSuccess,
    initialAdjustmentType,
}: StockAdjustmentModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [highRiskConfirmed, setHighRiskConfirmed] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(adjustmentSchema),
        defaultValues: {
            type: initialAdjustmentType || 'decrease',
            reason: 'correction',
            quantity: 1,
        },
    });

    const adjustmentType = watch('type');
    const quantity = Number(watch('quantity') || 0);

    useEffect(() => {
        const defaultReason = reasonByType[adjustmentType as UiAdjustmentType];
        if (defaultReason) {
            setValue('reason', defaultReason);
        }
        setHighRiskConfirmed(false);
    }, [adjustmentType, setValue]);

    useEffect(() => {
        if (!initialAdjustmentType) return;
        setValue('type', initialAdjustmentType);
        const r = reasonByType[initialAdjustmentType];
        if (r) setValue('reason', r);
        setHighRiskConfirmed(false);
    }, [batch.id, initialAdjustmentType, setValue]);

    const stockPreview = useMemo(() => {
        const decreasesStock = ['decrease', 'damage', 'expired'].includes(adjustmentType);
        const projected = decreasesStock
            ? batch.current_quantity - quantity
            : batch.current_quantity + quantity;
        return {
            projected,
            delta: decreasesStock ? -quantity : quantity,
            decreasesStock,
        };
    }, [adjustmentType, batch.current_quantity, quantity]);

    const isHighRiskAdjustment = useMemo(() => {
        if (!stockPreview.decreasesStock) return false;
        if (quantity <= 0) return false;
        if (quantity >= Math.max(10, Math.ceil(batch.current_quantity * 0.2))) return true;
        if (['damage', 'expired'].includes(adjustmentType)) return true;
        return false;
    }, [adjustmentType, batch.current_quantity, quantity, stockPreview.decreasesStock]);

    const onSubmit = async (data: {
        type: UiAdjustmentType;
        reason: UiAdjustmentReason;
        quantity: number;
        notes: string;
    }) => {
        if (!user?.facility_id) {
            toast.error('User facility not found');
            return;
        }

        if (['decrease', 'damage', 'expired'].includes(data.type)) {
            if (data.quantity > batch.current_quantity) {
                toast.error(`Cannot remove more than available stock (${batch.current_quantity})`);
                return;
            }
        }
        if (isHighRiskAdjustment && !highRiskConfirmed) {
            toast.error('Confirm high-risk adjustment before saving');
            return;
        }

        setIsLoading(true);
        try {
            await pharmacyService.adjustStock({
                facility_id: user.facility_id,
                batch_id: batch.id,
                type: data.type,
                quantity: data.quantity,
                reason: data.reason,
                notes: data.notes,
            });
            toast.success('Stock adjusted successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Adjustment failed:', error);
            toast.error(error?.response?.data?.message || 'Adjustment failed');
        } finally {
            setIsLoading(false);
        }
    };

    const getTypeIcon = () => {
        switch (adjustmentType) {
            case 'increase':
                return <ArrowUpCircle className="text-green-500" />;
            case 'return':
                return <ArrowUpCircle className="text-blue-500" />;
            case 'decrease':
                return <ArrowDownCircle className="text-amber-500" />;
            default:
                return <AlertTriangle className="text-red-500" />;
        }
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="md"
            title="Adjust Stock"
            subtitle={`Batch: ${batch.batch_number}`}
            showOverlay
        >
            <div className="w-full max-h-[100dvh] sm:max-h-[90vh] bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Current Quantity</span>
                            <span className="text-xl font-black text-healthcare-dark dark:text-white">
                                {batch.current_quantity}
                            </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Projected Quantity</span>
                            <div className="text-right">
                                <span
                                    className={`text-xl font-black ${
                                        stockPreview.projected < 0
                                            ? 'text-rose-600'
                                            : 'text-healthcare-dark dark:text-white'
                                    }`}
                                >
                                    {stockPreview.projected}
                                </span>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    {stockPreview.delta >= 0 ? '+' : ''}
                                    {stockPreview.delta} change
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                Adjustment Type
                            </label>
                            <div className="relative">
                                <select
                                    {...register('type')}
                                    className="w-full h-11 pl-10 pr-4 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-medium bg-white dark:bg-slate-800 dark:text-white appearance-none"
                                >
                                    <option value="decrease">Standard Decrease (Correction)</option>
                                    <option value="increase">Standard Increase (Correction)</option>
                                    <option value="damage">Damaged / Broken</option>
                                    <option value="expired">Expired</option>
                                    <option value="return">Customer Return</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    {getTypeIcon()}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                Reason
                            </label>
                            <select
                                {...register('reason')}
                                className="w-full h-11 px-4 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-medium bg-white dark:bg-slate-800 dark:text-white"
                            >
                                <option value="correction">Inventory Correction</option>
                                <option value="damage">Damaged Stock</option>
                                <option value="expiry">Expired Stock</option>
                                <option value="loss">Loss / Shrinkage</option>
                                <option value="customer_return">Customer Return</option>
                            </select>
                            {errors.reason && (
                                <p className="text-red-500 text-xs mt-1">
                                    {errors.reason.message as string}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                Quantity
                            </label>
                            <input
                                type="number"
                                {...register('quantity')}
                                className="w-full h-11 px-4 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold bg-white dark:bg-slate-800 dark:text-white"
                            />
                            {errors.quantity && (
                                <p className="text-red-500 text-xs mt-1">
                                    {errors.quantity.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                Notes
                            </label>
                            <textarea
                                {...register('notes')}
                                className="w-full px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:text-white"
                                rows={3}
                                placeholder="Explain why this adjustment is being made..."
                            />
                            {errors.notes && (
                                <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>
                            )}
                        </div>

                        {isHighRiskAdjustment && (
                            <label className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
                                <input
                                    type="checkbox"
                                    checked={highRiskConfirmed}
                                    onChange={(e) => setHighRiskConfirmed(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <span className="text-xs font-bold leading-relaxed">
                                    This is a high-risk adjustment. I confirm the quantity and
                                    reason are correct and should be permanently audited.
                                </span>
                            </label>
                        )}
                    </div>

                    <div className="sticky bottom-0 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur p-4 sm:p-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 px-4 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={
                                isLoading ||
                                stockPreview.projected < 0 ||
                                (isHighRiskAdjustment && !highRiskConfirmed)
                            }
                            className="h-11 px-5 w-full sm:w-auto bg-healthcare-primary text-white rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 touch-manipulation"
                        >
                            {isLoading ? (
                                <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                            ) : (
                                <span>Save Adjustment</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Drawer>
    );
}
