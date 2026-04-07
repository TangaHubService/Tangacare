import { useState, useEffect } from 'react';
import {
    Plus,
    ShieldCheck,
    Search,
    Edit2,
    CheckCircle2,
    XCircle,
    Building2,
    ClipboardList,
    Filter,
    Calendar,
} from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { pharmacyService } from '../../services/pharmacy.service';
import type { InsuranceProvider, InsuranceClaim, InsuranceClaimStatus } from '../../types/pharmacy';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ProviderModal = ({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<InsuranceProvider>) => void;
    initialData?: Partial<InsuranceProvider>;
    loading: boolean;
}) => {
    const [formData, setFormData] = useState<Partial<InsuranceProvider>>({
        name: '',
        type: 'PRIVATE',
        coverage_percentage: 0,
        max_coverage_limit: undefined,
        is_active: true,
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                type: initialData.type,
                coverage_percentage: initialData.coverage_percentage,
                max_coverage_limit: initialData.max_coverage_limit,
                is_active: initialData.is_active,
            });
        } else {
            setFormData({
                name: '',
                type: 'PRIVATE',
                coverage_percentage: 0,
                max_coverage_limit: undefined,
                is_active: true,
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-healthcare-dark dark:text-white">
                        {initialData ? 'Edit Provider' : 'Register Insurance Provider'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Provider Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                            placeholder="e.g. RSSB, Radiant"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Coverage (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.coverage_percentage}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        coverage_percentage: Number(e.target.value),
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Max Limit (RWF)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.max_coverage_limit || ''}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        max_coverage_limit: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Type
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        type: e.target.value as 'PUBLIC' | 'PRIVATE',
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                            >
                                <option value="PUBLIC">Public</option>
                                <option value="PRIVATE">Private</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Status
                            </label>
                            <select
                                value={formData.is_active ? 'true' : 'false'}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        is_active: e.target.value === 'true',
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                            >
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(formData)}
                        disabled={loading || !formData.name}
                        className="px-5 py-2 text-sm font-bold bg-healthcare-primary text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Provider'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ClaimModal = ({
    isOpen,
    onClose,
    onSubmit,
    providers,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<InsuranceClaim>) => void;
    providers: InsuranceProvider[];
    loading: boolean;
}) => {
    const [formData, setFormData] = useState<Partial<InsuranceClaim>>({
        sale_id: undefined,
        provider_id: undefined,
        patient_insurance_number: '',
        total_amount: 0,
        applied_coverage_percentage: 0,
        expected_amount: 0,
        copay_amount: 0,
        status: 'pending' as any,
    });

    useEffect(() => {
        if (!isOpen) {
            setFormData({
                sale_id: undefined,
                provider_id: undefined,
                patient_insurance_number: '',
                total_amount: 0,
                applied_coverage_percentage: 0,
                expected_amount: 0,
                copay_amount: 0,
                status: 'pending' as any,
            });
        }
    }, [isOpen]);

    const handleProviderChange = (providerId: number) => {
        const provider = providers.find((p) => p.id === providerId);
        if (provider) {
            const percentage = Number(provider.coverage_percentage);
            const expected = (formData.total_amount || 0) * (percentage / 100);
            setFormData((prev) => ({
                ...prev,
                provider_id: providerId,
                applied_coverage_percentage: percentage,
                expected_amount: expected,
                copay_amount: (formData.total_amount || 0) - expected,
            }));
        } else {
            setFormData((prev) => ({ ...prev, provider_id: providerId }));
        }
    };

    const handleTotalAmountChange = (amount: number) => {
        const expected = amount * ((formData.applied_coverage_percentage || 0) / 100);
        setFormData((prev) => ({
            ...prev,
            total_amount: amount,
            expected_amount: expected,
            copay_amount: amount - expected,
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-healthcare-dark dark:text-white">
                        Register Insurance Claim
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Sale ID
                            </label>
                            <input
                                type="number"
                                value={formData.sale_id || ''}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        sale_id: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                                placeholder="Enter Sale ID"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Provider
                            </label>
                            <select
                                value={formData.provider_id || ''}
                                onChange={(e) => handleProviderChange(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                            >
                                <option value="">Select Provider</option>
                                {providers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Patient Insurance Number
                        </label>
                        <input
                            type="text"
                            value={formData.patient_insurance_number}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    patient_insurance_number: e.target.value,
                                }))
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white"
                            placeholder="Policy / Card Number"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Total Amount (RWF)
                            </label>
                            <input
                                type="number"
                                value={formData.total_amount || ''}
                                onChange={(e) => handleTotalAmountChange(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 text-slate-900 dark:text-white font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Coverage (%)
                            </label>
                            <input
                                type="number"
                                value={formData.applied_coverage_percentage || ''}
                                readOnly
                                className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Expected (RWF)
                            </label>
                            <div className="w-full px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl text-healthcare-primary font-black">
                                {formData.expected_amount?.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Co-pay (RWF)
                            </label>
                            <div className="w-full px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl text-orange-600 font-black">
                                {formData.copay_amount?.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(formData)}
                        disabled={loading || !formData.sale_id || !formData.provider_id}
                        className="px-5 py-2 text-sm font-bold bg-healthcare-primary text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Registering...' : 'Register Claim'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export function InsurancePage() {
    const [activeTab, setActiveTab] = useState<'providers' | 'claims'>('providers');
    const [providers, setProviders] = useState<InsuranceProvider[]>([]);
    const [claims, setClaims] = useState<InsuranceClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<InsuranceProvider | undefined>();
    const [actionLoading, setActionLoading] = useState(false);

    // Filter states
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const fetchData = async () => {
        setLoading(true);
        try {
            // Always fetch providers if we're on providers tab OR if we need them for the claim modal
            const providerData = await pharmacyService.getInsuranceProviders();
            setProviders(providerData);

            if (activeTab === 'claims') {
                const claimData = await pharmacyService.getInsuranceClaims({
                    status: statusFilter || undefined,
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                });
                setClaims(claimData);
            }
        } catch (error) {
            console.error('Failed to fetch insurance data:', error);
            toast.error('Failed to load insurance information');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab, statusFilter, startDate, endDate]);

    const handleProviderSubmit = async (data: Partial<InsuranceProvider>) => {
        setActionLoading(true);
        try {
            if (selectedProvider) {
                await pharmacyService.updateInsuranceProvider(selectedProvider.id, data);
                toast.success('Provider updated successfully');
            } else {
                await pharmacyService.createInsuranceProvider(data);
                toast.success('Provider registered successfully');
            }
            setIsProviderModalOpen(false);
            setSelectedProvider(undefined);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save provider');
        } finally {
            setActionLoading(false);
        }
    };

    const handleClaimStatusUpdate = async (claimId: number, status: InsuranceClaimStatus) => {
        try {
            await pharmacyService.updateInsuranceClaim(claimId, { status });
            toast.success('Claim status updated');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update claim');
        }
    };

    const handleClaimSubmit = async (data: Partial<InsuranceClaim>) => {
        setActionLoading(true);
        try {
            await pharmacyService.createInsuranceClaim(data);
            toast.success('Insurance claim registered successfully');
            setIsClaimModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Failed to register insurance claim');
        } finally {
            setActionLoading(false);
        }
    };

    const filteredProviders = providers.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
    );

    const filteredClaims = claims.filter(
        (c) =>
            c.patient_insurance_number?.toLowerCase().includes(search.toLowerCase()) ||
            c.provider?.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.sale?.sale_number?.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'owner', 'super_admin']}>
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-healthcare-dark dark:text-white tracking-tight">
                            Insurance Management
                        </h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                            Providers & Financial Claims Tracking
                        </p>
                    </div>
                    {activeTab === 'providers' ? (
                        <button
                            onClick={() => {
                                setSelectedProvider(undefined);
                                setIsProviderModalOpen(true);
                            }}
                            className="px-5 py-2.5 bg-healthcare-primary text-white rounded-xl font-black text-xs hover:bg-teal-700 transition-all shadow-lg active:scale-[0.98] flex items-center gap-2"
                        >
                            <Plus size={16} /> Add Provider
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsClaimModalOpen(true)}
                            className="px-5 py-2.5 bg-healthcare-secondary text-white rounded-xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg active:scale-[0.98] flex items-center gap-2"
                        >
                            <Plus size={16} /> Register Claim
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 w-fit rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('providers')}
                        className={cn(
                            'px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2',
                            activeTab === 'providers'
                                ? 'bg-white dark:bg-slate-900 text-healthcare-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                        )}
                    >
                        <ShieldCheck size={14} />
                        Providers
                    </button>
                    <button
                        onClick={() => setActiveTab('claims')}
                        className={cn(
                            'px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2',
                            activeTab === 'claims'
                                ? 'bg-white dark:bg-slate-900 text-healthcare-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                        )}
                    >
                        <ClipboardList size={14} />
                        Claims Tracking
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-center">
                        <div className="flex-1 w-full lg:max-w-md">
                            <div className="relative group">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-healthcare-primary transition-colors"
                                />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={
                                        activeTab === 'providers'
                                            ? 'Search providers...'
                                            : 'Search by number, provider, or sale...'
                                    }
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-healthcare-dark dark:text-white focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {activeTab === 'claims' && (
                            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border-2 border-slate-100 dark:border-slate-800">
                                    <Filter size={14} className="text-slate-400" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="bg-transparent border-none text-[10px] font-black text-slate-600 dark:text-slate-300 focus:ring-0 uppercase tracking-wider cursor-pointer"
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="SUBMITTED">Submitted</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="PARTIALLY_APPROVED">
                                            Partially Approved
                                        </option>
                                        <option value="REJECTED">Rejected</option>
                                        <option value="PAID">Paid</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border-2 border-slate-100 dark:border-slate-800">
                                    <Calendar size={14} className="text-slate-400" />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent border-none text-[10px] font-black text-slate-600 dark:text-slate-300 focus:ring-0 uppercase tracking-wider cursor-pointer font-sans"
                                    />
                                    <span className="text-slate-300 font-bold px-1 text-[10px]">
                                        to
                                    </span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent border-none text-[10px] font-black text-slate-600 dark:text-slate-300 focus:ring-0 uppercase tracking-wider cursor-pointer font-sans"
                                    />
                                </div>

                                {(statusFilter || startDate || endDate || search) && (
                                    <button
                                        onClick={() => {
                                            setStatusFilter('');
                                            setStartDate('');
                                            setEndDate('');
                                            setSearch('');
                                        }}
                                        className="text-[10px] font-black text-healthcare-danger uppercase tracking-widest hover:underline px-2"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Table Section */}
                <div className="glass-card bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm min-h-[400px]">
                    {loading ? (
                        <SkeletonTable
                            rows={8}
                            columns={6}
                            animate
                            className="border-none shadow-none"
                        />
                    ) : (
                        <table className="tc-table w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50">
                                    {activeTab === 'providers' ? (
                                        <>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-center w-16">
                                                ID
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                                Provider Name
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-center">
                                                Coverage
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-center">
                                                Type
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-center">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-right">
                                                Actions
                                            </th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                                Claim Details
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                                Provider
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                                Requested
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                                Co-pay
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-right">
                                                Update Status
                                            </th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {activeTab === 'providers' ? (
                                    filteredProviders.length > 0 ? (
                                        filteredProviders.map((p) => (
                                            <tr
                                                key={p.id}
                                                className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                            >
                                                <td className="px-6 py-4 text-center text-xs font-bold text-slate-400">
                                                    #{p.id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-emerald-900/30 text-healthcare-primary flex items-center justify-center">
                                                            <Building2 size={16} />
                                                        </div>
                                                        <span className="font-black text-healthcare-dark dark:text-white text-sm">
                                                            {p.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <p className="text-xs font-black text-healthcare-dark dark:text-white">
                                                        {p.coverage_percentage}%
                                                    </p>
                                                    {p.max_coverage_limit && (
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                                                            Max:{' '}
                                                            {Number(
                                                                p.max_coverage_limit,
                                                            ).toLocaleString()}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={cn(
                                                            'text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider',
                                                            p.type === 'PUBLIC'
                                                                ? 'bg-blue-50 text-blue-600'
                                                                : 'bg-purple-50 text-purple-600',
                                                        )}
                                                    >
                                                        {p.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div
                                                        className={cn(
                                                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold',
                                                            p.is_active
                                                                ? 'bg-emerald-50 text-emerald-600'
                                                                : 'bg-red-50 text-red-600',
                                                        )}
                                                    >
                                                        {p.is_active ? (
                                                            <CheckCircle2 size={12} />
                                                        ) : (
                                                            <XCircle size={12} />
                                                        )}
                                                        {p.is_active ? 'Active' : 'Inactive'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedProvider(p);
                                                            setIsProviderModalOpen(true);
                                                        }}
                                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-healthcare-primary transition-colors"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-10 text-center text-slate-500 font-bold italic"
                                            >
                                                No providers found
                                            </td>
                                        </tr>
                                    )
                                ) : filteredClaims.length > 0 ? (
                                    filteredClaims.map((c) => (
                                        <tr
                                            key={c.id}
                                            className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="space-y-0.5">
                                                    <p className="font-black text-healthcare-dark dark:text-white text-sm">
                                                        Sale #{c.sale?.sale_number || c.sale_id}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                        Policy:{' '}
                                                        {c.patient_insurance_number || 'N/A'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck
                                                        size={14}
                                                        className="text-blue-500"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-healthcare-dark dark:text-white">
                                                            {c.provider?.name || 'Unknown'}
                                                        </span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                            Applied: {c.applied_coverage_percentage}
                                                            %
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-black text-healthcare-dark dark:text-white">
                                                    {c.expected_amount.toLocaleString()} RWF
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Total: {c.total_amount.toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-orange-600">
                                                    {c.copay_amount.toLocaleString()} RWF
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={cn(
                                                        'text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider',
                                                        c.status === 'pending' &&
                                                            'bg-amber-50 text-amber-600',
                                                        c.status === 'submitted' &&
                                                            'bg-blue-50 text-blue-600',
                                                        c.status === 'approved' &&
                                                            'bg-emerald-50 text-emerald-600',
                                                        c.status === 'paid' &&
                                                            'bg-healthcare-primary text-white',
                                                        c.status === 'rejected' &&
                                                            'bg-red-50 text-red-600',
                                                    )}
                                                >
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {c.status === 'pending' && (
                                                        <button
                                                            onClick={() =>
                                                                handleClaimStatusUpdate(
                                                                    c.id,
                                                                    'submitted',
                                                                )
                                                            }
                                                            className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                                                        >
                                                            Submit
                                                        </button>
                                                    )}
                                                    {c.status === 'submitted' && (
                                                        <>
                                                            <button
                                                                onClick={() =>
                                                                    handleClaimStatusUpdate(
                                                                        c.id,
                                                                        'approved',
                                                                    )
                                                                }
                                                                className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleClaimStatusUpdate(
                                                                        c.id,
                                                                        'rejected',
                                                                    )
                                                                }
                                                                className="text-[10px] font-black bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {c.status === 'approved' && (
                                                        <button
                                                            onClick={() =>
                                                                handleClaimStatusUpdate(
                                                                    c.id,
                                                                    'paid',
                                                                )
                                                            }
                                                            className="text-[10px] font-black bg-healthcare-primary text-white px-2 py-1 rounded-lg hover:bg-teal-700 transition-colors"
                                                        >
                                                            Mark as Paid
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-6 py-10 text-center text-slate-500 font-bold italic"
                                        >
                                            No insurance claims found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <ProviderModal
                isOpen={isProviderModalOpen}
                onClose={() => setIsProviderModalOpen(false)}
                onSubmit={handleProviderSubmit}
                initialData={selectedProvider}
                loading={actionLoading}
            />

            <ClaimModal
                isOpen={isClaimModalOpen}
                onClose={() => setIsClaimModalOpen(false)}
                onSubmit={handleClaimSubmit}
                providers={providers}
                loading={actionLoading}
            />
        </ProtectedRoute>
    );
}
