import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { Pill, Save, Info, Plus, Loader2 } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Medicine, MedicineCategory } from '../../types/pharmacy';
import { Drawer } from '../ui/Drawer';

interface MedicineModalProps {
    medicine?: Medicine;
    onClose: () => void;
    onSuccess: () => void;
}

const medicineSchema = yup.object({
    name: yup.string().required('Name is required'),
    brand_name: yup.string().optional(),
    code: yup.string().required('Code is required'),
    strength: yup.string().required('Strength is required'),
    dosage_form: yup.string().required('Dosage form is required'),
    unit: yup.string().required('Unit is required'),
    category_id: yup.number().optional(),
    selling_price: yup.number().min(0, 'Cannot be negative').required('Required'),
    reorder_point: yup.number().min(0, 'Cannot be negative').optional().default(0),
    min_stock_level: yup.number().min(0, 'Cannot be negative').optional().default(0),
    is_controlled_drug: yup.boolean().default(false),
    allow_partial_sales: yup.boolean().default(false),
    units_per_package: yup.number().when('allow_partial_sales', {
        is: true,
        then: (schema) =>
            schema.min(1, 'Must be at least 1').required('Required for partial sales'),
        otherwise: (schema) => schema.optional(),
    }),
    base_unit: yup.string().when('allow_partial_sales', {
        is: true,
        then: (schema) => schema.required('Base unit is required (e.g. tablet)'),
        otherwise: (schema) => schema.optional(),
    }),
});

export function MedicineModal({ medicine, onClose, onSuccess }: MedicineModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isPrefilling, setIsPrefilling] = useState(false);
    const [categories, setCategories] = useState<MedicineCategory[]>([]);
    const [showCreateCategory, setShowCreateCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    const buildFormValues = (payload?: Partial<Medicine>) => ({
        name: payload?.name || '',
        brand_name: payload?.brand_name || '',
        code: payload?.code || '',
        strength: payload?.strength || '',
        dosage_form: payload?.dosage_form || '',
        unit: payload?.unit || '',
        category_id: payload?.category_id ?? (payload as any)?.category?.id ?? '',
        selling_price: Number(payload?.selling_price || 0),
        reorder_point: Number(payload?.reorder_point || 0),
        min_stock_level: Number(payload?.min_stock_level || 0),
        is_controlled_drug: Boolean(payload?.is_controlled_drug),
        allow_partial_sales: Boolean(payload?.allow_partial_sales),
        units_per_package: payload?.units_per_package ?? undefined,
        base_unit: payload?.base_unit || '',
    });

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(medicineSchema) as any,
        defaultValues: buildFormValues(medicine),
    });

    const allowPartialSales = watch('allow_partial_sales');

    const fetchCategories = async () => {
        try {
            const data = await pharmacyService.getCategories();
            setCategories(data);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        let isMounted = true;

        const hydrateForEdit = async () => {
            if (!medicine?.id) {
                reset(buildFormValues(undefined));
                return;
            }

            // Fill quickly from table row, then replace with full record.
            reset(buildFormValues(medicine));
            setIsPrefilling(true);
            try {
                const fullMedicine = await pharmacyService.getMedicine(medicine.id);
                if (!isMounted) return;
                reset(buildFormValues(fullMedicine));
            } catch (error) {
                console.error('Failed to fetch full medicine details:', error);
                // Keep existing row data if details request fails.
            } finally {
                if (isMounted) {
                    setIsPrefilling(false);
                }
            }
        };

        hydrateForEdit();

        return () => {
            isMounted = false;
        };
    }, [medicine, reset]);

    const generateCategoryCode = (name: string): string => {
        const base =
            name
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '') || 'CATEGORY';
        const suffix = Date.now().toString().slice(-6);
        const safeBase = base.slice(0, Math.max(1, 50 - (suffix.length + 1)));
        return `${safeBase}_${suffix}`;
    };

    const handleCreateCategory = async () => {
        const trimmedName = newCategoryName.trim();
        if (trimmedName.length < 2) {
            toast.error('Category name must be at least 2 characters');
            return;
        }

        setIsCreatingCategory(true);
        try {
            const created = await pharmacyService.createCategory({
                name: trimmedName,
                code: generateCategoryCode(trimmedName),
            });
            setCategories((prev) =>
                [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setValue('category_id', created.id, { shouldDirty: true, shouldValidate: true });
            setNewCategoryName('');
            setShowCreateCategory(false);
            toast.success('Category created');
        } catch (error: any) {
            console.error('Category creation failed:', error);
            toast.error(error?.response?.data?.message || 'Failed to create category');
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const toNumberOrUndefined = (value: any): number | undefined => {
                if (value === '' || value === null || value === undefined) return undefined;
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : undefined;
            };

            const toNumberOrNull = (value: any): number | null => {
                if (value === '' || value === null || value === undefined) return null;
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : null;
            };

            const payload = {
                ...data,
                category_id: toNumberOrNull(data.category_id),
                selling_price: Number(data.selling_price || 0),
                reorder_point: toNumberOrUndefined(data.reorder_point) ?? 0,
                min_stock_level: toNumberOrUndefined(data.min_stock_level) ?? 0,
                units_per_package: data.allow_partial_sales
                    ? toNumberOrUndefined(data.units_per_package)
                    : undefined,
                base_unit: data.allow_partial_sales ? data.base_unit : undefined,
            };

            if (medicine?.id) {
                await pharmacyService.updateMedicine(medicine.id, payload);
                toast.success('Medicine updated successfully');
            } else {
                await pharmacyService.createMedicine(payload);
                toast.success('Medicine created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Operation failed:', error);
            toast.error(error?.response?.data?.message || 'Operation failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="lg"
            title={medicine ? 'Edit Medicine' : 'Add New Medicine'}
            subtitle="Configure basic information and retail settings."
            showOverlay
        >
            <div className="px-4 sm:px-6 pt-3">
                <div className="inline-flex items-center gap-2 text-healthcare-primary text-sm font-black">
                    <Pill size={18} />
                    Medicine
                </div>
            </div>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0 flex-col">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                        <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-slate-900">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Basic Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Medicine Name *
                                    </label>
                                    <input
                                        {...register('name')}
                                        disabled={isPrefilling}
                                        placeholder="e.g. Paracetamol"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                    {errors.name && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.name.message as string}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Brand Name
                                    </label>
                                    <input
                                        {...register('brand_name')}
                                        disabled={isPrefilling}
                                        placeholder="e.g. Panadol"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        System Code *
                                    </label>
                                    <input
                                        {...register('code')}
                                        disabled={isPrefilling}
                                        placeholder="e.g. PARA-500"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono uppercase"
                                    />
                                    {errors.code && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.code.message as string}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white">
                                            Category
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateCategory((prev) => !prev)}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-healthcare-primary hover:text-teal-700 transition-colors"
                                        >
                                            <Plus size={14} />
                                            {showCreateCategory ? 'Close' : 'Add Category'}
                                        </button>
                                    </div>
                                    <select
                                        {...register('category_id')}
                                        disabled={isCreatingCategory || isPrefilling}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="">Uncategorized</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                    {showCreateCategory && (
                                        <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newCategoryName}
                                                    onChange={(event) =>
                                                        setNewCategoryName(event.target.value)
                                                    }
                                                    placeholder="Category name (e.g. Antibiotics)"
                                                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleCreateCategory}
                                                    disabled={
                                                        isCreatingCategory ||
                                                        !newCategoryName.trim()
                                                    }
                                                    className="min-w-[82px] px-3 py-2 rounded-lg bg-healthcare-primary text-white text-xs font-bold hover:bg-teal-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                                >
                                                    {isCreatingCategory ? (
                                                        <>
                                                            <Loader2
                                                                size={14}
                                                                className="animate-spin"
                                                            />
                                                            Saving
                                                        </>
                                                    ) : (
                                                        'Save'
                                                    )}
                                                </button>
                                            </div>
                                            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                The category code will be generated automatically.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Strength *
                                    </label>
                                    <input
                                        {...register('strength')}
                                        disabled={isPrefilling}
                                        placeholder="e.g. 500mg"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                    {errors.strength && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.strength.message as string}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Dosage Form *
                                    </label>
                                    <select
                                        {...register('dosage_form')}
                                        disabled={isPrefilling}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="">Select form...</option>
                                        <option value="tablet">Tablet</option>
                                        <option value="capsule">Capsule</option>
                                        <option value="syrup">Syrup</option>
                                        <option value="injection">Injection</option>
                                        <option value="ointment">Ointment</option>
                                        <option value="drops">Drops</option>
                                        <option value="inhaler">Inhaler</option>
                                        <option value="patch">Patch</option>
                                        <option value="other">Other</option>
                                    </select>
                                    {errors.dosage_form && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.dosage_form.message as string}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-slate-900">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Pricing & Packaging
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Package Unit *
                                    </label>
                                    <input
                                        {...register('unit')}
                                        disabled={isPrefilling}
                                        placeholder="e.g. Box, Bottle"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                    {errors.unit && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.unit.message as string}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Selling Price (per Unit) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...register('selling_price')}
                                        disabled={isPrefilling}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                    {errors.selling_price && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.selling_price.message as string}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Reorder Threshold
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        {...register('reorder_point')}
                                        disabled={isPrefilling}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Alert and reorder suggestion will trigger below this
                                        quantity.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                        Minimum Stock Level
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        {...register('min_stock_level')}
                                        disabled={isPrefilling}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4 p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-black text-healthcare-primary uppercase tracking-widest">
                                        Partial Sales Support
                                    </h3>
                                    <div className="group relative">
                                        <Info size={14} className="text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                            Enable this to allow selling individual units (e.g.
                                            pills) from a larger package (e.g. box).
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...register('allow_partial_sales')}
                                        disabled={isPrefilling}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-healthcare-primary"></div>
                                </label>
                            </div>

                            {allowPartialSales && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                            Units per Package *
                                        </label>
                                        <input
                                            type="number"
                                            {...register('units_per_package')}
                                            disabled={isPrefilling}
                                            placeholder="e.g. 10"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                        {errors.units_per_package && (
                                            <p className="text-red-500 text-xs mt-1">
                                                {errors.units_per_package.message as string}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                            Base Unit *
                                        </label>
                                        <input
                                            {...register('base_unit')}
                                            disabled={isPrefilling}
                                            placeholder="e.g. tablet, pill, ml"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                        {errors.base_unit && (
                                            <p className="text-red-500 text-xs mt-1">
                                                {errors.base_unit.message as string}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-slate-900">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('is_controlled_drug')}
                                    disabled={isPrefilling}
                                    className="w-4 h-4 rounded border-2 border-slate-300 text-healthcare-primary focus:ring-healthcare-primary transition-all"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-white">
                                    Controlled Drug
                                </span>
                            </label>
                        </section>
                    </div>

                    <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-slate-900">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || isPrefilling}
                                className="flex-[2] py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading || isPrefilling ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        <span>
                                            {medicine ? 'Update Medicine' : 'Create Medicine'}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
        </Drawer>
    );
}
