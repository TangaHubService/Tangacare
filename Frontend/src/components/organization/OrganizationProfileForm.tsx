import { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Organization, UpdateOrganizationDto } from '../../types/pharmacy';

const ORG_TYPES = [
    { value: 'single_pharmacy', label: 'Single Pharmacy' },
    { value: 'pharmacy_chain', label: 'Pharmacy Chain' },
    { value: 'clinic', label: 'Clinic' },
    { value: 'hospital', label: 'Hospital' },
] as const;

interface OrganizationProfileFormProps {
    organizationId: number;
    onSaved?: () => void;
}

export function OrganizationProfileForm({ organizationId, onSaved }: OrganizationProfileFormProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<UpdateOrganizationDto>({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        legal_name: '',
        registration_number: '',
        medical_license: '',
        city: '',
        country: '',
        tax_registration_number: '',
        business_license_number: '',
        type: 'single_pharmacy',
    });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        pharmacyService
            .getOrganization(organizationId)
            .then((org: Organization) => {
                if (cancelled) return;
                setForm({
                    name: org.name ?? '',
                    code: org.code ?? '',
                    address: org.address ?? '',
                    phone: org.phone ?? '',
                    email: org.email ?? '',
                    legal_name: org.legal_name ?? '',
                    registration_number: org.registration_number ?? '',
                    medical_license: org.medical_license ?? '',
                    city: org.city ?? '',
                    country: org.country ?? '',
                    tax_registration_number: org.tax_registration_number ?? '',
                    business_license_number: org.business_license_number ?? '',
                    type: (org.type as any) ?? 'single_pharmacy',
                });
            })
            .catch((err: any) => {
                if (!cancelled) {
                    toast.error(err?.response?.data?.message || 'Failed to load organization');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [organizationId]);

    const update = (field: keyof UpdateOrganizationDto, value: string | number | boolean | undefined) => {
        setForm((prev) => ({ ...prev, [field]: value === '' ? undefined : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name?.trim()) {
            toast.error('Organization name is required');
            return;
        }
        setSaving(true);
        try {
            const payload: UpdateOrganizationDto = {
                name: form.name.trim(),
                code: form.code?.trim() || undefined,
                address: form.address?.trim() || undefined,
                phone: form.phone?.trim() || undefined,
                email: form.email?.trim() || undefined,
                legal_name: form.legal_name?.trim() || undefined,
                registration_number: form.registration_number?.trim() || undefined,
                medical_license: form.medical_license?.trim() || undefined,
                city: form.city?.trim() || undefined,
                country: form.country?.trim() || undefined,
                tax_registration_number: form.tax_registration_number?.trim() || undefined,
                business_license_number: form.business_license_number?.trim() || undefined,
                type: form.type,
            };
            await pharmacyService.updateOrganization(organizationId, payload);
            toast.success('Organization profile saved');
            onSaved?.();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to save organization');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
                <Building2 className="text-healthcare-primary" size={20} />
                <h2 className="text-lg font-black text-healthcare-dark dark:text-white">
                    Organization profile
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Organization name *
                    </label>
                    <input
                        type="text"
                        value={form.name ?? ''}
                        onChange={(e) => update('name', e.target.value)}
                        required
                        maxLength={255}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Code
                    </label>
                    <input
                        type="text"
                        value={form.code ?? ''}
                        onChange={(e) => update('code', e.target.value)}
                        maxLength={20}
                        placeholder="e.g. TCD"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Type
                    </label>
                    <select
                        value={form.type ?? 'single_pharmacy'}
                        onChange={(e) => update('type', e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    >
                        {ORG_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Legal name
                    </label>
                    <input
                        type="text"
                        value={form.legal_name ?? ''}
                        onChange={(e) => update('legal_name', e.target.value)}
                        maxLength={255}
                        placeholder="Registered legal name"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Registration number
                    </label>
                    <input
                        type="text"
                        value={form.registration_number ?? ''}
                        onChange={(e) => update('registration_number', e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Business license number
                    </label>
                    <input
                        type="text"
                        value={form.business_license_number ?? ''}
                        onChange={(e) => update('business_license_number', e.target.value)}
                        maxLength={100}
                        placeholder="Business / trade license"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Tax registration number
                    </label>
                    <input
                        type="text"
                        value={form.tax_registration_number ?? ''}
                        onChange={(e) => update('tax_registration_number', e.target.value)}
                        maxLength={100}
                        placeholder="VAT / TIN / Tax ID"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Medical / pharmacy license
                    </label>
                    <input
                        type="text"
                        value={form.medical_license ?? ''}
                        onChange={(e) => update('medical_license', e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Address
                    </label>
                    <input
                        type="text"
                        value={form.address ?? ''}
                        onChange={(e) => update('address', e.target.value)}
                        maxLength={255}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        City
                    </label>
                    <input
                        type="text"
                        value={form.city ?? ''}
                        onChange={(e) => update('city', e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Country
                    </label>
                    <input
                        type="text"
                        value={form.country ?? ''}
                        onChange={(e) => update('country', e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Phone
                    </label>
                    <input
                        type="text"
                        value={form.phone ?? ''}
                        onChange={(e) => update('phone', e.target.value)}
                        maxLength={20}
                        placeholder="+250..."
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        value={form.email ?? ''}
                        onChange={(e) => update('email', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-healthcare-primary text-white font-bold text-sm hover:bg-teal-600 disabled:opacity-60 transition-colors"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save profile'}
                </button>
            </div>
        </form>
    );
}
