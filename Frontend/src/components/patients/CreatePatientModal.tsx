import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { pharmacyService } from '../../services/pharmacy.service';
import { Drawer } from '../ui/Drawer';

const schema = yup.object({
    first_name: yup.string().required('First name is required'),
    last_name: yup.string().required('Last name is required'),
    email: yup.string().email('Invalid email').optional(),
    phone_number: yup.string().required('Phone number is required'),
    address: yup.string().optional(),
});

interface CreatePatientForm {
    first_name: string;
    last_name: string;
    email?: string;
    phone_number: string;
    address?: string;
}

interface CreatePatientModalProps {
    onClose: () => void;
    initialData?: CreatePatientForm & { id: number };
    onCreate?: (patient: any) => void;
    onUpdate?: (patient: any) => void;
}

export const CreatePatientModal: React.FC<CreatePatientModalProps> = ({
    onClose,
    initialData,
    onCreate,
    onUpdate,
}) => {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CreatePatientForm>({
        resolver: yupResolver(schema) as any,
        defaultValues: initialData || {
            first_name: '',
            last_name: '',
            email: '',
            phone_number: '',
            address: '',
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CreatePatientForm) => {
            if (initialData?.id) {
                // Update existing patient
                const response = await pharmacyService.updatePatient(initialData.id, {
                    ...data,
                    role: 'patient',
                });
                return response;
            } else {
                // Create new patient
                const response = await api.post('/users', {
                    ...data,
                    role: 'patient',
                    password: 'ChangeMe123!',
                    must_set_password: true,
                });
                return response.data;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
            toast.success(
                initialData ? 'Patient updated successfully' : 'Patient created successfully',
            );

            if (initialData && onUpdate) {
                onUpdate(data);
            } else if (!initialData && onCreate) {
                // Determine the correct data structure logic
                const patientData = (data as any).data ?? data;
                onCreate(patientData);
            }

            onClose();
        },
        onError: (error: any) => {
            toast.error(
                error.response?.data?.message ||
                    (initialData ? 'Failed to update patient' : 'Failed to create patient'),
            );
        },
    });

    const onSubmit = (data: CreatePatientForm) => {
        const payload = {
            ...data,
            email: data.email || undefined,
            address: data.address || undefined,
            phone_number: data.phone_number || undefined,
        };
        createMutation.mutate(payload as CreatePatientForm);
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="md"
            title={initialData ? 'Edit Customer' : 'Add New Customer'}
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 shadow-xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                First Name
                            </label>
                            <input
                                {...register('first_name')}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all text-sm font-medium"
                                placeholder="John"
                            />
                            {errors.first_name && (
                                <p className="text-xs text-red-500 font-medium">
                                    {errors.first_name.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Last Name
                            </label>
                            <input
                                {...register('last_name')}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all text-sm font-medium"
                                placeholder="Doe"
                            />
                            {errors.last_name && (
                                <p className="text-xs text-red-500 font-medium">
                                    {errors.last_name.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Phone Number
                        </label>
                        <input
                            {...register('phone_number')}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all text-sm font-medium"
                            placeholder="+256..."
                        />
                        {errors.phone_number && (
                            <p className="text-xs text-red-500 font-medium">
                                {errors.phone_number.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Email (Optional)
                        </label>
                        <input
                            {...register('email')}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all text-sm font-medium"
                            placeholder="john.doe@example.com"
                        />
                        {errors.email && (
                            <p className="text-xs text-red-500 font-medium">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Address (Optional)
                        </label>
                        <textarea
                            {...register('address')}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all text-sm font-medium resize-none h-20"
                            placeholder="Kampala, Uganda"
                        />
                    </div>
                </form>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold text-sm transition-colors"
                        disabled={createMutation.isPending}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit(onSubmit)}
                        className="flex items-center gap-2 px-6 py-2 bg-healthcare-primary hover:bg-teal-700 text-white rounded-lg font-bold text-sm transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                {initialData ? 'Update Customer' : 'Create Customer'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Drawer>
    );
};
