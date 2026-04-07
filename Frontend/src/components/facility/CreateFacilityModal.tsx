import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { pharmacyService } from '../../services/pharmacy.service';
import type { CreateFacilityDto } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { Drawer } from '../ui/Drawer';

const createFacilitySchema = yup.object({
    name: yup.string().required('Facility name is required'),
    type: yup
        .string()
        .oneOf(['hospital', 'clinic', 'pharmacy_shop'], 'Invalid facility type')
        .required('Type is required') as yup.Schema<'hospital' | 'clinic' | 'pharmacy_shop'>,
    address: yup.string().required('Address is required'),
    phone: yup
        .string()
        .matches(/^(\+2507[8923]\d{7})$/, 'Phone must be in format +2507XXXXXXXX')
        .required('Phone number is required'),
    email: yup.string().email('Invalid email').required('Email is required'),
});

interface CreateFacilityModalProps {
    onClose: () => void;
}

export function CreateFacilityModal({ onClose }: CreateFacilityModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { refreshProfile, organizationId, organizations } = useAuth();
    const navigate = useNavigate();
    const effectiveOrgId = organizationId ?? organizations?.[0]?.id;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CreateFacilityDto>({
        resolver: yupResolver(createFacilitySchema) as any,
    });

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const payload = effectiveOrgId ? { ...data, organization_id: effectiveOrgId } : data;
            await pharmacyService.createFacility(payload);
            toast.success('Facility created successfully!');

            await refreshProfile();
            onClose();

            navigate({ to: '/app/facilities' as any, search: {} as any });
        } catch (error: any) {
            console.error('Failed to create facility:', error);
            const message = error.response?.data?.message || 'Failed to create facility';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="lg"
            title="Register Your Facility"
            subtitle="Please provide details about your pharmacy or clinic to get started."
            showOverlay
        >
            <div className="w-full bg-white dark:bg-slate-900 overflow-hidden">
                {!effectiveOrgId && (
                    <div className="mx-6 mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-sm">
                        Select an organization in the header switcher first, then add a facility.
                    </div>
                )}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Facility Name
                        </label>
                        <input
                            {...register('name')}
                            placeholder="e.g. Kigali City Pharmacy"
                            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none transition-all ${
                                errors.name
                                    ? 'border-red-400'
                                    : 'border-slate-100 dark:border-slate-700 focus:border-healthcare-primary'
                            }`}
                        />
                        {errors.name && (
                            <p className="text-[10px] font-bold text-red-500">
                                {errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Type
                            </label>
                            <select
                                {...register('type')}
                                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none transition-all appearance-none cursor-pointer ${
                                    errors.type
                                        ? 'border-red-400'
                                        : 'border-slate-100 dark:border-slate-700 focus:border-healthcare-primary'
                                }`}
                            >
                                <option value="">Select Type</option>
                                <option value="pharmacy_shop">Pharmacy Shop</option>
                                <option value="clinic">Clinic</option>
                                <option value="hospital">Hospital</option>
                            </select>
                            {errors.type && (
                                <p className="text-[10px] font-bold text-red-500">
                                    {errors.type.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Phone
                            </label>
                            <input
                                {...register('phone')}
                                placeholder="+250 7..."
                                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none transition-all ${
                                    errors.phone
                                        ? 'border-red-400'
                                        : 'border-slate-100 dark:border-slate-700 focus:border-healthcare-primary'
                                }`}
                            />
                            {errors.phone && (
                                <p className="text-[10px] font-bold text-red-500">
                                    {errors.phone.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Email
                        </label>
                        <input
                            {...register('email')}
                            type="email"
                            placeholder="contact@pharmacy.com"
                            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none transition-all ${
                                errors.email
                                    ? 'border-red-400'
                                    : 'border-slate-100 dark:border-slate-700 focus:border-healthcare-primary'
                            }`}
                        />
                        {errors.email && (
                            <p className="text-[10px] font-bold text-red-500">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Address
                        </label>
                        <input
                            {...register('address')}
                            placeholder="District, Sector, Cell"
                            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none transition-all ${
                                errors.address
                                    ? 'border-red-400'
                                    : 'border-slate-100 dark:border-slate-700 focus:border-healthcare-primary'
                            }`}
                        />
                        {errors.address && (
                            <p className="text-[10px] font-bold text-red-500">
                                {errors.address.message}
                            </p>
                        )}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isLoading || !effectiveOrgId}
                            className="w-full py-4 bg-healthcare-primary text-white rounded-xl font-black text-sm hover:bg-teal-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Register Facility'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Drawer>
    );
}
