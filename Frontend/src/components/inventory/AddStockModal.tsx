import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
    X,
    Plus,
    Search,
    Loader2,
    PackagePlus,
    Calendar,
    Download,
    Upload,
    Trash2,
} from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Medicine, StorageLocation } from '../../types/pharmacy';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toSentenceCase } from '../../lib/text';
import { parseLocalDate } from '../../lib/date';
import { Drawer } from '../ui/Drawer';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AddStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialMedicineId?: number | null;
}

const batchSchema = yup.object({
    batch_number: yup.string().required('Batch # is required'),
    quantity: yup.number().min(1, 'Min 1').required('Required'),
    expiry_date: yup
        .string()
        .required('Required')
        .test('is-future', 'Expiry must be in future', (val) => {
            if (!val) return false;
            const d = parseLocalDate(val);
            return !Number.isNaN(d.getTime()) && d > new Date();
        }),
    manufacturing_date: yup.string().optional(),
    unit_cost: yup.number().min(0, 'Cannot be negative').default(0),
});

const addStockSchema = yup.object({
    medicine_id: yup.number().positive('Select a medicine').required('Required'),
    storage_location_id: yup.number().required('Storage Location is required'),
    batches: yup.array().of(batchSchema).min(1, 'Add at least one batch').required(),
});

interface AddStockFormData {
    medicine_id: number;
    storage_location_id: number | null | undefined;
    batches: {
        batch_number: string;
        quantity: number;
        expiry_date: string;
        manufacturing_date?: string;
        unit_cost?: number;
    }[];
}

export function AddStockModal({
    isOpen,
    onClose,
    onSuccess,
    initialMedicineId = null,
}: AddStockModalProps) {
    const { user } = useAuth();
    const facilityId = user?.facility_id;
    const [loading, setLoading] = useState(false);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
    const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<AddStockFormData>({
        resolver: yupResolver(addStockSchema) as any,
        defaultValues: {
            medicine_id: 0,
            storage_location_id: undefined,
            batches: [{ batch_number: '', quantity: 1, expiry_date: '', unit_cost: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'batches',
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                medicine_id: 0,
                storage_location_id: undefined,
                batches: [{ batch_number: '', quantity: 1, expiry_date: '', unit_cost: 0 }],
            });
            setSelectedMedicine(null);
            setSearchQuery('');

            const loadMedicines = async () => {
                try {
                    const res = await pharmacyService.getMedicines({ limit: 100 });
                    const fetchedMedicines = res.data || [];
                    setMedicines(fetchedMedicines);

                    if (initialMedicineId) {
                        const preselected = fetchedMedicines.find(
                            (medicine) => medicine.id === initialMedicineId,
                        );
                        if (preselected) {
                            setSelectedMedicine(preselected);
                            setValue('medicine_id', preselected.id);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load medicines:', error);
                }
            };
            loadMedicines();

            const loadStorageLocations = async () => {
                if (!facilityId) return;
                try {
                    const locations = await pharmacyService.getStorageLocations({
                        facility_id: facilityId,
                    });
                    setStorageLocations(locations.filter((l) => l.is_active));
                } catch (error) {
                    console.error('Failed to load storage locations:', error);
                }
            };
            loadStorageLocations();
        }
    }, [initialMedicineId, isOpen, reset, setValue]);

    const handleMedicineSelect = (med: Medicine) => {
        setSelectedMedicine(med);
        setValue('medicine_id', med.id);
        setSearchQuery('');
    };

    const downloadTemplate = async () => {
        try {
            const blob = await pharmacyService.downloadStockTemplate(facilityId || undefined);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Stock_Entry_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Template downloaded!');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to download template.');
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !facilityId) return;

        setLoading(true);
        try {
            const result = await pharmacyService.importStockBatches(file, facilityId);
            toast.success(`Successfully imported ${result.imported} stock entries.`);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Import failed:', error);
            toast.error(error.message || 'Failed to import Excel file.');
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const onSubmit: any = async (data: any) => {
        if (!facilityId) {
            toast.error('Facility not identified');
            return;
        }

        setLoading(true);
        try {
            await pharmacyService.manualStockEntry({
                facility_id: facilityId,
                medicine_id: data.medicine_id,
                storage_location_id: data.storage_location_id,
                batches: data.batches.map((b: any) => ({
                    ...b,
                    unit_cost: b.unit_cost || 0,
                })),
            });
            toast.success('Stock added successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Submission failed:', error);
            toast.error(error?.response?.data?.message || 'Failed to add stock');
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
            title="Add New Stock"
            subtitle="Record manual batch receipt"
            showOverlay
            headerActions={
                <>
                    <button
                        onClick={downloadTemplate}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download size={14} /> Template
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Upload size={14} /> Import Excel
                    </button>
                </>
            }
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportExcel}
                className="hidden"
                accept=".xlsx,.xls"
            />

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-8">
                    {/* Left: Medicine Selection */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                1. Select Medicine
                            </label>
                            {selectedMedicine ? (
                                <div className="p-4 bg-healthcare-primary/5 border-2 border-healthcare-primary/20 rounded-2xl flex items-center justify-between group animate-in slide-in-from-left-2 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-healthcare-primary text-white rounded-xl flex items-center justify-center font-black">
                                            {selectedMedicine.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-healthcare-dark dark:text-white">
                                                {selectedMedicine.name}
                                            </p>
                                            <p className="text-[10px] text-healthcare-primary font-bold">
                                                {selectedMedicine.code}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedMedicine(null);
                                            setValue('medicine_id', 0);
                                        }}
                                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            size={16}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search by name or code..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-600 dark:border-slate-600 focus:border-healthcare-primary focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm font-bold outline-none transition-all"
                                        />
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 h-[300px] overflow-y-auto p-2 space-y-1">
                                        {filteredMedicines.map((med) => (
                                            <button
                                                key={med.id}
                                                onClick={() => handleMedicineSelect(med)}
                                                className="w-full flex items-center justify-between p-3 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all group border border-transparent hover:border-healthcare-primary/10"
                                            >
                                                <div className="text-left">
                                                    <p className="text-xs font-black text-slate-800 dark:text-white">
                                                        {med.name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                        {med.code}
                                                    </p>
                                                </div>
                                                <Plus
                                                    size={14}
                                                    className="text-healthcare-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {errors.medicine_id && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">
                                    {errors.medicine_id.message}
                                </p>
                            )}
                        </div>

                        {/* Storage Location Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                2. Storage Location
                            </label>
                            <select
                                {...register('storage_location_id')}
                                className={cn(
                                    'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-600 dark:border-slate-600 rounded-xl text-sm font-bold outline-none transition-all',
                                    errors.storage_location_id
                                        ? 'border-red-200 focus:border-red-300'
                                        : 'focus:border-healthcare-primary focus:bg-white',
                                )}
                            >
                                <option value="">Select Storage Location...</option>
                                {storageLocations.map((loc) => (
                                    <option key={loc.id} value={loc.id}>
                                        {toSentenceCase(loc.name)} ({loc.code})
                                    </option>
                                ))}
                            </select>
                            {errors.storage_location_id && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">
                                    {errors.storage_location_id.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: Batches Entry */}
                    <div className="md:col-span-3 flex flex-col h-full space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                3. Batch Details
                            </label>
                            <button
                                type="button"
                                onClick={() =>
                                    append({
                                        batch_number: '',
                                        quantity: 1,
                                        expiry_date: '',
                                        unit_cost: 0,
                                    })
                                }
                                className="text-[10px] font-black uppercase text-healthcare-primary hover:text-teal-700 flex items-center gap-1 transition-colors"
                            >
                                <Plus size={12} /> Add Another Batch
                            </button>
                        </div>

                        <div className="flex-1 min-h-[400px] space-y-4">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in slide-in-from-right-2 duration-300 relative group"
                                >
                                    {fields.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="absolute -right-2 -top-2 w-7 h-7 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md active:scale-95"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                Batch Number
                                            </label>
                                            <input
                                                {...register(`batches.${index}.batch_number`)}
                                                placeholder="e.g. B-2023-001"
                                                className={cn(
                                                    'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-xl text-sm font-bold focus:outline-none transition-all',
                                                    errors.batches?.[index]?.batch_number
                                                        ? 'border-red-200 focus:border-red-300'
                                                        : 'focus:border-healthcare-primary focus:bg-white',
                                                )}
                                            />
                                            {errors.batches?.[index]?.batch_number && (
                                                <p className="text-[9px] text-red-500 font-bold ml-1">
                                                    {errors.batches[index]?.batch_number?.message}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                Quantity
                                            </label>
                                            <input
                                                type="number"
                                                {...register(`batches.${index}.quantity`)}
                                                className={cn(
                                                    'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-xl text-sm font-bold focus:outline-none transition-all',
                                                    errors.batches?.[index]?.quantity
                                                        ? 'border-red-200 focus:border-red-300'
                                                        : 'focus:border-healthcare-primary focus:bg-white',
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                Expiry Date
                                            </label>
                                            <div className="relative">
                                                <Calendar
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                                                    size={14}
                                                />
                                                <input
                                                    type="date"
                                                    {...register(`batches.${index}.expiry_date`)}
                                                    className={cn(
                                                        'w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-xl text-sm font-bold focus:outline-none transition-all',
                                                        errors.batches?.[index]?.expiry_date
                                                            ? 'border-red-200 focus:border-red-300'
                                                            : 'focus:border-healthcare-primary focus:bg-white',
                                                    )}
                                                />
                                            </div>
                                            {errors.batches?.[index]?.expiry_date && (
                                                <p className="text-[9px] text-red-500 font-bold ml-1">
                                                    {errors.batches[index]?.expiry_date?.message}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                Mfg Date (Optional)
                                            </label>
                                            <input
                                                type="date"
                                                {...register(`batches.${index}.manufacturing_date`)}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 focus:border-healthcare-primary focus:bg-white rounded-xl text-sm font-bold transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Summary & Submit */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto bg-white dark:bg-slate-900 sticky bottom-0 z-10 pb-2">
                            <button
                                onClick={handleSubmit(onSubmit)}
                                disabled={loading || !selectedMedicine}
                                className="w-full py-3.5 bg-healthcare-primary text-white rounded-2xl font-black text-sm hover:bg-teal-700 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <PackagePlus size={20} />
                                )}
                                Confirm & Add Stock
                            </button>
                        </div>
                    </div>
            </div>
        </Drawer>
    );
}
