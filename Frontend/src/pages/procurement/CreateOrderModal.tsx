import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Save, ShoppingCart } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Supplier, Medicine } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';

interface CreateOrderModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const itemSchema = yup.object({
    medicine_id: yup.number().required('Select a medicine'),
    quantity_ordered: yup.number().min(1, 'Min 1').required('Req'),
    unit_price: yup.number().min(0, 'Min 0').required('Req'),
});

const orderSchema = yup.object({
    supplier_id: yup.number().required('Select a supplier'),
    order_date: yup.string().required('Date is required'),
    discount_percent: yup.number().min(0).max(100).optional().default(0),
    vat_rate: yup.number().min(0).max(100).optional(),
    notes: yup.string(),
    items: yup.array().of(itemSchema).min(1, 'Add at least one item').required(),
});

export function CreateOrderModal({ onClose, onSuccess }: CreateOrderModalProps) {
    const { user } = useAuth();
    const { formatMoney, currencySymbol, vatRate } = useRuntimeConfig();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultVatPercent = Math.round((vatRate ?? 0.18) * 100);

    const {
        register,
        control,
        handleSubmit,
        watch,
        formState: { errors, isValid },
    } = useForm({
        resolver: yupResolver(orderSchema),
        defaultValues: {
            order_date: new Date().toISOString().split('T')[0],
            discount_percent: 0,
            vat_rate: defaultVatPercent,
            items: [{ medicine_id: 0, quantity_ordered: 1, unit_price: 0 }],
        },
        mode: 'onChange',
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    const watchItems = watch('items') || [];
    const medicineById = useMemo(
        () => new Map(medicines.map((medicine) => [medicine.id, medicine])),
        [medicines],
    );

    useEffect(() => {
        const loadData = async () => {
            try {
                const [suppliersData, medicinesResponse] = await Promise.all([
                    pharmacyService.getSuppliers(),
                    pharmacyService.getMedicines({ limit: 100 }),
                ]);
                setSuppliers(suppliersData.data || []);
                setMedicines(medicinesResponse.data || []);
            } catch (error) {
                console.error('Failed to load data', error);
                toast.error('Failed to load form data');
            } finally {
                setLoadingData(false);
            }
        };
        loadData();
    }, []);

    const calculateTotal = () => {
        return (
            watchItems?.reduce((sum, item) => {
                return sum + (item.quantity_ordered || 0) * (item.unit_price || 0);
            }, 0) || 0
        );
    };

    const subtotal = calculateTotal();
    const discountPercent = Number(watch('discount_percent') || 0);
    const discountAmount = subtotal * (discountPercent / 100);
    const vatRateField = Number(watch('vat_rate') || 0);
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const vatAmount = taxableBase * (vatRateField / 100);
    const grandTotal = taxableBase + vatAmount;
    const hasCostAboveSelling = (watchItems || []).some((item) => {
        const medicine = medicineById.get(Number(item.medicine_id));
        if (!medicine) return false;
        return Number(item.unit_price || 0) > Number(medicine.selling_price || 0);
    });

    const onSubmit = async (data: any) => {
        if (!user?.facility_id) return;
        setIsSubmitting(true);
        try {
            await pharmacyService.createProcurementOrder({
                facility_id: user.facility_id,
                supplier_id: data.supplier_id,
                order_date: data.order_date,
                discount_percent: Number(data.discount_percent || 0),
                vat_rate: Number(data.vat_rate || 0),
                items: data.items,
                notes: data.notes,
            });
            toast.success('Order created successfully');
            onSuccess();
        } catch (error: any) {
            console.error('Create order failed:', error);
            toast.error(error?.response?.data?.message || 'Failed to create order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                {}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="text-xl font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                        <ShoppingCart size={20} className="text-healthcare-primary" />
                        Create Purchase Order
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loadingData ? (
                        <div className="flex justify-center py-10">
                            <div className="w-8 h-8 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
                        </div>
                    ) : (
                        <form
                            id="order-form"
                            onSubmit={handleSubmit(onSubmit)}
                            className="space-y-6"
                        >
                            {}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Supplier
                                    </label>
                                    <select
                                        {...register('supplier_id')}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white dark:border-slate-700"
                                    >
                                        <option value="">Select Supplier...</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.contact_person})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.supplier_id && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.supplier_id.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Order Date
                                    </label>
                                    <input
                                        type="date"
                                        {...register('order_date')}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                                    />
                                    {errors.order_date && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.order_date.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Discount (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        {...register('discount_percent')}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        VAT (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        {...register('vat_rate')}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                                    />
                                </div>
                            </div>

                            {}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-bold text-slate-700">
                                        Order Items
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            append({
                                                medicine_id: 0,
                                                quantity_ordered: 1,
                                                unit_price: 0,
                                            })
                                        }
                                        className="text-xs font-bold text-healthcare-primary flex items-center gap-1 hover:underline"
                                    >
                                        <Plus size={14} /> Add Item
                                    </button>
                                </div>

                                <div className="border rounded-xl overflow-hidden">
                                    <table className="tc-table w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3 w-[40%]">Medicine</th>
                                                <th className="px-4 py-3 w-[20%]">Quantity</th>
                                                <th className="px-4 py-3 w-[25%]">Unit Price</th>
                                                <th className="px-4 py-3 w-[15%] text-right">
                                                    Total
                                                </th>
                                                <th className="px-2 py-3 w-[5%]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {fields.map((field, index) => (
                                                <tr
                                                    key={field.id}
                                                    className="group hover:bg-slate-50/50"
                                                >
                                                    <td className="p-2">
                                                        <select
                                                            {...register(
                                                                `items.${index}.medicine_id`,
                                                            )}
                                                            className="w-full px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 text-sm"
                                                        >
                                                            <option value="0">Select...</option>
                                                            {medicines.map((m) => (
                                                                <option key={m.id} value={m.id}>
                                                                    {m.name} ({m.strength})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {errors.items?.[index]?.medicine_id && (
                                                            <p className="text-red-500 text-[10px]">
                                                                {
                                                                    errors.items[index]?.medicine_id
                                                                        ?.message
                                                                }
                                                            </p>
                                                        )}
                                                        {(() => {
                                                            const selectedMedicine =
                                                                medicineById.get(
                                                                    Number(
                                                                        watchItems[index]
                                                                            ?.medicine_id,
                                                                    ),
                                                                );
                                                            const selectedSellingPrice = Number(
                                                                selectedMedicine?.selling_price ||
                                                                    0,
                                                            );
                                                            const selectedCostPrice = Number(
                                                                selectedMedicine?.cost_price || 0,
                                                            );
                                                            const enteredCost = Number(
                                                                watchItems[index]?.unit_price || 0,
                                                            );
                                                            const isCostAboveSelling =
                                                                enteredCost > selectedSellingPrice;

                                                            if (!selectedMedicine) return null;
                                                            return (
                                                                <div className="mt-1 space-y-1">
                                                                    <p className="text-[10px] font-black text-slate-500">
                                                                        Selling: {formatMoney(selectedSellingPrice)}{' '}
                                                                        | Last Cost: {formatMoney(selectedCostPrice)}
                                                                    </p>
                                                                    {isCostAboveSelling && (
                                                                        <p className="text-[10px] font-black text-red-600">
                                                                            Cost is above selling
                                                                            price. Update medicine
                                                                            selling price first.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            {...register(
                                                                `items.${index}.quantity_ordered`,
                                                            )}
                                                            className="w-full px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 text-sm"
                                                            min="1"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1.5 text-slate-400 text-xs">
                                                                {currencySymbol}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                {...register(
                                                                    `items.${index}.unit_price`,
                                                                )}
                                                                className="w-full pl-10 px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 text-sm"
                                                                min="0"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-slate-700">
                                                        {(watchItems[index]?.quantity_ordered ||
                                                            0) *
                                                            (watchItems[index]?.unit_price || 0)}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => remove(index)}
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                            disabled={fields.length === 1}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t">
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-2 text-right font-black uppercase text-xs text-slate-500"
                                                >
                                                    Subtotal
                                                </td>
                                                <td className="px-4 py-2 text-right font-black text-healthcare-dark dark:text-white">
                                                    {formatMoney(subtotal)}
                                                </td>
                                                <td></td>
                                            </tr>
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-2 text-right font-black uppercase text-xs text-slate-500"
                                                >
                                                    Discount ({discountPercent}%)
                                                </td>
                                                <td className="px-4 py-2 text-right font-black text-healthcare-dark dark:text-white">
                                                    - {formatMoney(discountAmount)}
                                                </td>
                                                <td></td>
                                            </tr>
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-2 text-right font-black uppercase text-xs text-slate-500"
                                                >
                                                    VAT ({vatRate}%)
                                                </td>
                                                <td className="px-4 py-2 text-right font-black text-healthcare-dark dark:text-white">
                                                    {formatMoney(vatAmount)}
                                                </td>
                                                <td></td>
                                            </tr>
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-3 text-right font-black uppercase text-xs text-slate-500"
                                                >
                                                    Total Amount
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-healthcare-dark dark:text-white text-lg">
                                                    {formatMoney(grandTotal)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                {errors.items && (
                                    <p className="text-red-500 text-xs mt-2 text-center">
                                        {errors.items.message}
                                    </p>
                                )}
                            </div>
                        </form>
                    )}
                </div>

                {}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    {hasCostAboveSelling && (
                        <p className="mr-auto text-[10px] font-black text-red-600 self-center">
                            Fix items where Unit Cost is above Selling Price before creating order.
                        </p>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="order-form"
                        disabled={
                            isSubmitting ||
                            !isValid ||
                            calculateTotal() === 0 ||
                            hasCostAboveSelling
                        }
                        className="px-6 py-2 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-500/10"
                    >
                        {isSubmitting ? (
                            <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                        ) : (
                            <Save size={18} />
                        )}
                        Create Order
                    </button>
                </div>
            </div>
        </div>
    );
}
