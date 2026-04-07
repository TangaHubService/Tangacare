import { useState } from 'react';
import { Building2, ChevronRight, MapPin, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacyService } from '../../services/pharmacy.service';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import * as yup from 'yup';

const step1Schema = yup.object({
    organization_name: yup
        .string()
        .trim()
        .min(2, 'Organization name must be at least 2 characters')
        .required('Organization name is required'),
    legal_name: yup.string().trim().optional(),
    registration_number: yup.string().trim().optional(),
    medical_license: yup.string().trim().optional(),
    city: yup.string().trim().optional(),
    country: yup.string().trim().optional(),
});

const step2Schema = yup.object({
    facility_name: yup
        .string()
        .trim()
        .min(2, 'Branch name must be at least 2 characters')
        .required('Branch name is required'),
    facility_type: yup
        .mixed<'hospital' | 'clinic' | 'pharmacy_shop'>()
        .oneOf(['hospital', 'clinic', 'pharmacy_shop'])
        .required(),
    address: yup.string().trim().optional(),
    phone: yup
        .string()
        .trim()
        .matches(/^\+?[1-9]\d{1,14}$/, 'Phone number must be in international format')
        .optional(),
    email: yup.string().trim().email('Invalid email address').optional(),
});

interface SetupPharmacyModalProps {
    onSuccess: () => void;
    onClose?: () => void;
}

type Step = 1 | 2;

export function SetupPharmacyModal({ onSuccess, onClose }: SetupPharmacyModalProps) {
    const { refreshProfile, setOrganization, setFacility } = useAuth();
    const [step, setStep] = useState<Step>(1);
    const [createdOrganization, setCreatedOrganization] = useState<{
        id: number;
        name: string;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [step1Form, setStep1Form] = useState({
        organization_name: '',
        legal_name: '',
        registration_number: '',
        medical_license: '',
        city: '',
        country: '',
    });
    const [step2Form, setStep2Form] = useState({
        facility_name: '',
        facility_type: 'pharmacy_shop' as 'hospital' | 'clinic' | 'pharmacy_shop',
        address: '',
        phone: '',
        email: '',
    });

    const handleStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await step1Schema.validate(step1Form, { abortEarly: false });
            const result = await pharmacyService.createOnboardingOrganization({
                organization_name: step1Form.organization_name.trim(),
                legal_name: step1Form.legal_name?.trim() || undefined,
                registration_number: step1Form.registration_number?.trim() || undefined,
                medical_license: step1Form.medical_license?.trim() || undefined,
                city: step1Form.city?.trim() || undefined,
                country: step1Form.country?.trim() || undefined,
            });
            toast.success('Organization created. Now add your first branch.');
            if (result.organization) {
                setCreatedOrganization({
                    id: result.organization.id,
                    name: result.organization.name,
                });
                // Default branch name to organization name
                setStep2Form((prev) => ({
                    ...prev,
                    facility_name: step1Form.organization_name.trim(),
                }));
                await authService.refreshToken();
                setStep(2);
            }
        } catch (error: any) {
            const msg =
                error?.response?.data?.message || error?.message || 'Failed to create organization';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createdOrganization?.id) return;
        setIsLoading(true);
        try {
            await step2Schema.validate(step2Form, { abortEarly: false });
            const facility = await pharmacyService.createFacility({
                name: step2Form.facility_name.trim(),
                type: step2Form.facility_type,
                organization_id: createdOrganization.id,
                address: step2Form.address?.trim() || undefined,
                phone: step2Form.phone?.trim() || undefined,
                email: step2Form.email?.trim() || undefined,
            });
            toast.success('Your pharmacy is set up. You can start using the app.');
            setOrganization(createdOrganization.id);
            localStorage.setItem('selected_organization_id', String(createdOrganization.id));
            setFacility(facility.id);
            localStorage.setItem('selected_facility_id', String(facility.id));
            await refreshProfile();
            onSuccess();
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || 'Failed to add branch';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-healthcare-primary/10 flex items-center justify-center">
                            <Building2 className="text-healthcare-primary" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-healthcare-dark">
                                {step === 1
                                    ? 'Step 1: Register your organization'
                                    : 'Step 2: Add your first branch'}
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {step === 1
                                    ? 'Create your organization (company / pharmacy group).'
                                    : `Add a branch for ${createdOrganization?.name ?? 'your organization'}.`}
                            </p>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 mt-3">
                        <span
                            className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-healthcare-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                        <span
                            className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-healthcare-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                    </div>
                </div>

                {step === 1 && (
                    <form onSubmit={handleStep1} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Organization name *
                            </label>
                            <input
                                value={step1Form.organization_name}
                                onChange={(e) =>
                                    setStep1Form((f) => ({
                                        ...f,
                                        organization_name: e.target.value,
                                    }))
                                }
                                placeholder="e.g. My Pharmacy Ltd"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    Legal Name
                                </label>
                                <input
                                    value={step1Form.legal_name}
                                    onChange={(e) =>
                                        setStep1Form((f) => ({
                                            ...f,
                                            legal_name: e.target.value,
                                        }))
                                    }
                                    placeholder="Full legal name"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    Reg Number
                                </label>
                                <input
                                    value={step1Form.registration_number}
                                    onChange={(e) =>
                                        setStep1Form((f) => ({
                                            ...f,
                                            registration_number: e.target.value,
                                        }))
                                    }
                                    placeholder="Business ID"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    Medical License
                                </label>
                                <input
                                    value={step1Form.medical_license}
                                    onChange={(e) =>
                                        setStep1Form((f) => ({
                                            ...f,
                                            medical_license: e.target.value,
                                        }))
                                    }
                                    placeholder="License #"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    City
                                </label>
                                <input
                                    value={step1Form.city}
                                    onChange={(e) =>
                                        setStep1Form((f) => ({
                                            ...f,
                                            city: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g. Kigali"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Country
                            </label>
                            <input
                                value={step1Form.country}
                                onChange={(e) =>
                                    setStep1Form((f) => ({
                                        ...f,
                                        country: e.target.value,
                                    }))
                                }
                                placeholder="e.g. Rwanda"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                            />
                        </div>
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-healthcare-primary text-white rounded-xl font-black text-sm hover:bg-teal-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Next: Add branch <ChevronRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleStep2} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Branch / facility name *
                            </label>
                            <input
                                value={step2Form.facility_name}
                                onChange={(e) =>
                                    setStep2Form((f) => ({ ...f, facility_name: e.target.value }))
                                }
                                placeholder="e.g. Main Branch"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Type
                            </label>
                            <select
                                value={step2Form.facility_type}
                                onChange={(e) =>
                                    setStep2Form((f) => ({
                                        ...f,
                                        facility_type: e.target.value as any,
                                    }))
                                }
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                            >
                                <option value="pharmacy_shop">Pharmacy Shop</option>
                                <option value="clinic">Clinic</option>
                                <option value="hospital">Hospital</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                <MapPin size={12} /> Address
                            </label>
                            <input
                                value={step2Form.address}
                                onChange={(e) =>
                                    setStep2Form((f) => ({ ...f, address: e.target.value }))
                                }
                                placeholder="District, Sector, Cell"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    Phone
                                </label>
                                <input
                                    value={step2Form.phone}
                                    onChange={(e) =>
                                        setStep2Form((f) => ({ ...f, phone: e.target.value }))
                                    }
                                    placeholder="+250 7..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={step2Form.email}
                                    onChange={(e) =>
                                        setStep2Form((f) => ({ ...f, email: e.target.value }))
                                    }
                                    placeholder="contact@pharmacy.com"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl text-sm font-bold focus:outline-none focus:border-healthcare-primary border-slate-200 dark:border-slate-700"
                                />
                            </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex-1 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 py-4 bg-healthcare-primary text-white rounded-xl font-black text-sm hover:bg-teal-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Complete Setup'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
