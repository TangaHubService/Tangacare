import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Medicine, Batch, Department, StorageLocation } from '../../types/pharmacy';
import { ArrowRightLeft, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toSentenceCase } from '../../lib/text';
import { formatLocalDate, parseLocalDate } from '../../lib/date';
import { Drawer } from '../ui/Drawer';

interface StockTransferModalProps {
    medicine: Medicine;
    facilityId: number;
    onClose: () => void;
    onSuccess: () => void;
    /** When opening from batch workspace, pre-select this batch in the dropdown. */
    initialBatchId?: number;
}

const transferSchema = yup.object({
    batch_id: yup.number().required('Select a batch'),
    target_department_id: yup.number().required('Select destination department'),
    source_location_id: yup.number().optional().nullable(),
    target_location_id: yup.number().optional().nullable(),
    quantity: yup.number().min(1, 'Quantity must be at least 1').required('Required'),
    notes: yup.string(),
});

export function StockTransferModal({
    medicine,
    facilityId,
    onClose,
    onSuccess,
    initialBatchId,
}: StockTransferModalProps) {
    const {} = useAuth();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(transferSchema),
        defaultValues: {
            quantity: 1,
            source_location_id: undefined,
            target_location_id: undefined,
            batch_id: initialBatchId,
        },
    });

    const selectedBatchId = watch('batch_id');
    const selectedBatch = batches.find((b) => b.id === Number(selectedBatchId));

    useEffect(() => {
        const loadData = async () => {
            setLoadingData(true);
            try {
                const [batchesData, departmentsData, locationsData] = await Promise.all([
                    pharmacyService.getBatches({ medicine_id: medicine.id, facility_id: facilityId }),
                    pharmacyService.getDepartments({ facility_id: facilityId }),
                    pharmacyService.getStorageLocations({ facility_id: facilityId }),
                ]);

                const activeBatches = (batchesData || []).filter(
                    (b) => b.current_quantity > 0 && parseLocalDate(b.expiry_date) > new Date(),
                );

                setBatches(activeBatches);
                if (initialBatchId && activeBatches.some((b) => b.id === initialBatchId)) {
                    setValue('batch_id', initialBatchId);
                }
                setDepartments(departmentsData || []);
                setStorageLocations((locationsData || []).filter((l) => l.is_active));
            } catch (error) {
                console.error('Failed to load transfer data:', error);
                toast.error('Failed to load batches or departments');
            } finally {
                setLoadingData(false);
            }
        };
        loadData();
    }, [medicine.id, facilityId, initialBatchId, setValue]);

    const onSubmit = async (data: any) => {
        if (!selectedBatch) return;

        if (data.quantity > selectedBatch.current_quantity) {
            toast.error(
                `Cannot transfer more than available stock (${selectedBatch.current_quantity})`,
            );
            return;
        }

        setIsLoading(true);
        try {
            await pharmacyService.transferStock({
                facility_id: facilityId,
                medicine_id: medicine.id,
                batch_id: data.batch_id,
                source_department_id: null,
                target_department_id: data.target_department_id,
                source_location_id: data.source_location_id,
                target_location_id: data.target_location_id,
                quantity: data.quantity,
                notes: data.notes,
            });
            toast.success('Stock transferred successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Transfer failed:', error);
            toast.error(error?.response?.data?.message || 'Transfer failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="md"
            title="Transfer Stock"
            subtitle={`${medicine.name} (${medicine.code})`}
            showOverlay
        >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-6">
                    {loadingData ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                    From
                                </span>
                                <div className="font-bold text-healthcare-dark dark:text-white flex items-center gap-2">
                                    <Building2 size={16} /> Central Store / Main Pharmacy
                                </div>
                            </div>

                            {}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    Select Batch
                                </label>
                                <select
                                    {...register('batch_id')}
                                    className="w-full px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-medium bg-white dark:bg-slate-800 dark:text-white"
                                >
                                    <option value="">Select a batch...</option>
                                    {batches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.batch_number} (Qty: {b.current_quantity}) - Exp:{' '}
                                            {formatLocalDate(b.expiry_date)}
                                        </option>
                                    ))}
                                </select>
                                {errors.batch_id && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {errors.batch_id.message}
                                    </p>
                                )}
                            </div>

                            {}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    Source Location (Optional)
                                </label>
                                <select
                                    {...register('source_location_id')}
                                    className="w-full px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-medium bg-white dark:bg-slate-800 dark:text-white"
                                >
                                    <option value="">Default Location...</option>
                                    {storageLocations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {toSentenceCase(loc.name)} ({loc.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    Destination Department
                                </label>
                                <select
                                    {...register('target_department_id')}
                                    className="w-full px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-medium bg-white dark:bg-slate-800 dark:text-white"
                                >
                                    <option value="">Select destination...</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {toSentenceCase(d.name)} ({toSentenceCase(d.type)})
                                        </option>
                                    ))}
                                </select>
                                {errors.target_department_id && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {errors.target_department_id.message}
                                    </p>
                                )}
                            </div>

                            {}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    Destination Location (Optional)
                                </label>
                                <select
                                    {...register('target_location_id')}
                                    className="w-full px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-medium bg-white dark:bg-slate-800 dark:text-white"
                                >
                                    <option value="">Default Location...</option>
                                    {storageLocations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {toSentenceCase(loc.name)} ({loc.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    Quantity to Transfer
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        {...register('quantity')}
                                        className="flex-1 px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold bg-white dark:bg-slate-800 dark:text-white"
                                        max={selectedBatch?.current_quantity}
                                    />
                                    <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                                        Max: {selectedBatch?.current_quantity || 0}
                                    </span>
                                </div>
                                {errors.quantity && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {errors.quantity.message}
                                    </p>
                                )}
                            </div>

                            {}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    {...register('notes')}
                                    className="w-full px-4 py-2 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm bg-white dark:bg-slate-800 dark:text-white"
                                    rows={2}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || batches.length === 0}
                                className="w-full py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                                ) : (
                                    <ArrowRightLeft size={18} />
                                )}
                                Confirm Transfer
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </Drawer>
    );
}
