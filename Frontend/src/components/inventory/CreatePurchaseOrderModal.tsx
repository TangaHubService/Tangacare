import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { X, Plus, ShoppingCart, Search, Loader2 } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Supplier, Medicine } from '../../types/pharmacy';
import toast from 'react-hot-toast';
import { Drawer } from '../ui/Drawer';

interface CreatePurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialItem?: {
        medicine_id: number;
        medicine_name: string;
        quantity: number;
    } | null;
}

const poItemSchema = yup.object({
    medicine_id: yup.number().positive('Required').required('Required'),
    medicine_name: yup.string().required(),
    quantity: yup.number().min(1, 'Min 1').required('Required'),
    notes: yup.string().optional(),
});

const poSchema = yup.object({
    supplier_id: yup
        .number()
        .positive('Please select a supplier')
        .required('Please select a supplier'),
    expected_delivery_date: yup.string().optional(),
    notes: yup.string().optional(),
    items: yup.array().of(poItemSchema).min(1, 'Please add at least one item').required(),
});

type POFormData = {
    supplier_id: number;
    expected_delivery_date?: string;
    notes?: string;
    items: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity: number;
        notes?: string;
    }>;
};

export function CreatePurchaseOrderModal({
    isOpen,
    onClose,
    onSuccess,
    initialItem,
}: CreatePurchaseOrderModalProps) {
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const {
        register,
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<POFormData>({
        resolver: yupResolver(poSchema) as any,
        defaultValues: {
            supplier_id: 0,
            expected_delivery_date: '',
            notes: '',
            items: [],
        },
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
        if (isOpen) {
            const loadData = async () => {
                try {
                    const [sRes, mRes] = await Promise.all([
                        pharmacyService.getSuppliers({ limit: 100 }),
                        pharmacyService.getMedicines({ limit: 100 }),
                    ]);
                    setSuppliers(sRes.data || []);
                    const fetchedMedicines = mRes.data || [];
                    setMedicines(fetchedMedicines);

                    // Handle initial item if present
                    if (initialItem) {
                        reset({
                            supplier_id: 0,
                            expected_delivery_date: '',
                            notes: '',
                            items: [
                                {
                                    medicine_id: initialItem.medicine_id,
                                    medicine_name: initialItem.medicine_name,
                                    quantity: initialItem.quantity,
                                    notes: '',
                                },
                            ],
                        });
                    } else {
                        reset({ supplier_id: 0, expected_delivery_date: '', notes: '', items: [] });
                    }
                } catch (error) {
                    console.error('Failed to load PO data:', error);
                    toast.error('Failed to load suppliers and medicines');
                }
            };
            loadData();
        }
    }, [isOpen, reset, initialItem]);

    const addItem = (med: Medicine) => {
        if (watchItems.find((i) => i.medicine_id === med.id)) {
            toast.error('Item already added to order');
            return;
        }
        append({
            medicine_id: med.id,
            medicine_name: med.name,
            quantity: 1,
            notes: '',
        });
    };

    const onSubmit = async (data: POFormData) => {
        setLoading(true);
        try {
            await pharmacyService.createProcurementOrder({
                supplier_id: data.supplier_id,
                expected_delivery_date: data.expected_delivery_date || undefined,
                notes: data.notes || undefined,
                items: data.items.map((i) => ({
                    medicine_id: i.medicine_id,
                    quantity_ordered: i.quantity,
                    unit_price: 0,
                    notes: i.notes || undefined,
                })),
            });
            toast.success('Purchase request saved as draft');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to create purchase request:', error);
            toast.error(error?.response?.data?.message || 'Failed to create purchase request');
        } finally {
            setLoading(false);
        }
    };

    const filteredMedicines = medicines.filter(
        (m) =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.code.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            title="New Purchase Request"
            subtitle="Draft · Supplier will set prices"
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 w-full max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8 pb-24 sm:pb-6">
                    {}
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                Supplier / Partner
                            </label>
                            <select
                                {...register('supplier_id')}
                                className={`w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-600 dark:border-slate-600 rounded-2xl outline-none transition-all font-bold text-sm ${
                                    errors.supplier_id
                                        ? 'border-red-500 focus:ring-red-500/10'
                                        : 'focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800'
                                }`}
                            >
                                <option value="0">Select a supplier...</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                            {errors.supplier_id && (
                                <p className="text-red-500 text-[10px] font-bold ml-1">
                                    {errors.supplier_id.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                Expected Delivery (Optional)
                            </label>
                            <input
                                type="date"
                                {...register('expected_delivery_date')}
                                className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-600 dark:border-slate-600 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-bold text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                Order Notes (Optional)
                            </label>
                            <textarea
                                {...register('notes')}
                                rows={2}
                                placeholder="e.g. urgent, cold-chain required, partial delivery ok..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-600 dark:border-slate-600 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium text-sm resize-none"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                Search Medicines
                            </label>
                            <div className="relative">
                                <Search
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-500"
                                    size={16}
                                />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or code..."
                                    className="w-full h-11 pl-11 pr-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-600 dark:border-slate-600 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-bold text-sm"
                                />
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 h-[220px] sm:h-[300px] overflow-y-auto p-2 space-y-1">
                                {filteredMedicines.map((med) => (
                                    <button
                                        key={med.id}
                                        onClick={() => addItem(med)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all group border border-transparent hover:border-teal-500/10"
                                    >
                                        <div className="text-left">
                                            <p className="text-xs font-black text-healthcare-dark">
                                                {med.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                {med.code}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-bold mt-1">
                                                Sell: RWF{' '}
                                                {Number(med.selling_price || 0).toLocaleString()} |
                                                Cost: RWF{' '}
                                                {Number(med.cost_price || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-1.5 bg-teal-50 text-teal-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                            <Plus size={14} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="flex flex-col h-full space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            Order items ({fields.length})
                        </label>
                        <div
                            className={`flex-1 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border overflow-y-auto p-4 space-y-3 ${
                                errors.items
                                    ? 'border-red-500'
                                    : 'border-slate-100 dark:border-slate-800'
                            }`}
                        >
                            {fields.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                    <ShoppingCart size={32} className="opacity-20" />
                                    <p className="text-xs font-bold italic">No items added yet</p>
                                </div>
                            ) : (
                                fields.map((field, index) => {
                                    const selectedMedicine = medicineById.get(
                                        Number(watchItems[index]?.medicine_id || field.medicine_id),
                                    );
                                    const sellingPrice = Number(
                                        selectedMedicine?.selling_price || 0,
                                    );

                                    return (
                                        <div
                                            key={field.id}
                                            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2"
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="text-xs font-black text-healthcare-dark">
                                                    {field.medicine_name}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors touch-manipulation"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            {sellingPrice > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-md text-[10px] font-black uppercase tracking-wider">
                                                        Current selling: RWF{' '}
                                                        {sellingPrice.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                                                        Qty Requested *
                                                    </p>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        {...register(`items.${index}.quantity`)}
                                                        className={`w-full h-10 px-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs font-bold transition-all ${
                                                            errors.items?.[index]?.quantity
                                                                ? 'border-red-500'
                                                                : 'focus:border-teal-500 font-bold'
                                                        }`}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                                                        Item Notes
                                                    </p>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. brand preference..."
                                                        {...register(`items.${index}.notes`)}
                                                        className="w-full h-10 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-600 dark:border-slate-600 focus:border-teal-500 rounded-lg text-xs font-medium transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {errors.items && (
                            <p className="text-red-500 text-[10px] font-bold text-center">
                                {errors.items.message}
                            </p>
                        )}

                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 text-center">
                                Cost prices will be set by the supplier in their quotation response.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 border-t border-teal-500/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur p-4 sm:p-6 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>
                            {fields.length} item{fields.length !== 1 ? 's' : ''}
                        </span>
                        <span>·</span>
                        <span>Saves as Draft</span>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 px-4 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all touch-manipulation"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit(onSubmit)}
                            disabled={loading || fields.length === 0}
                            className="h-11 px-5 w-full sm:w-auto flex items-center justify-center gap-2 bg-healthcare-primary text-white rounded-xl font-black text-xs hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 active:scale-[0.98] touch-manipulation"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                            Save Purchase Request
                        </button>
                    </div>
                </div>
            </div>
        </Drawer>
    );
}
