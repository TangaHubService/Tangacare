import { useState, useEffect } from 'react';
import {
    Plus,
    Building2,
    MapPin,
    Users,
    Store,
    Hotel,
    Stethoscope,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Trash2,
    Search,
} from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { subscriptionService } from '../../services/subscription.service';
import type { Facility, CreateFacilityDto } from '../../types/pharmacy';
import { StatsSkeleton } from '../../components/shared/Skeleton';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../../components/shared/ConfirmModal';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const FacilityModal = ({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<CreateFacilityDto>) => void;
    initialData?: Partial<Facility>;
    loading: boolean;
}) => {
    const [formData, setFormData] = useState<Partial<CreateFacilityDto>>({
        name: '',
        type: 'hospital',
        address: '',
        phone: '',
        email: '',
        status: 'Active',
        departments_enabled: true,
        controlled_drug_rules_enabled: true,
        min_stock_threshold_percentage: 20,
        expiry_alert_days: 90,
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                type: initialData.type,
                address: initialData.address,
                phone: initialData.phone,
                email: initialData.email,
                status: initialData.status || 'Active',
                departments_enabled: initialData.departments_enabled ?? true,
                controlled_drug_rules_enabled: initialData.controlled_drug_rules_enabled ?? true,
                min_stock_threshold_percentage: initialData.min_stock_threshold_percentage ?? 20,
                expiry_alert_days: initialData.expiry_alert_days ?? 90,
            });
        } else {
            setFormData({
                name: '',
                type: 'hospital',
                address: '',
                phone: '',
                email: '',
                status: 'Active',
                departments_enabled: true,
                controlled_drug_rules_enabled: true,
                min_stock_threshold_percentage: 20,
                expiry_alert_days: 90,
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-healthcare-dark">
                        {initialData ? 'Edit Facility' : 'Register New Facility'}
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
                            Facility Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            placeholder="e.g. Central Hospital"
                        />
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
                                        type: e.target.value as any,
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            >
                                <option value="hospital">Hospital</option>
                                <option value="clinic">Clinic</option>
                                <option value="pharmacy_shop">Pharmacy Shop</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        status: e.target.value as 'Active' | 'Inactive',
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Address
                        </label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, address: e.target.value }))
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            placeholder="Address"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Phone
                            </label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                                placeholder="Phone number"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                                placeholder="Email address"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                        Configuration
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between col-span-2 sm:col-span-1 border border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-900">
                            <label className="text-xs font-bold text-slate-500">
                                Enable Departments
                            </label>
                            <input
                                type="checkbox"
                                checked={!!formData.departments_enabled}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        departments_enabled: e.target.checked,
                                    }))
                                }
                                className="w-4 h-4 rounded border-slate-300 text-healthcare-primary focus:ring-healthcare-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between col-span-2 sm:col-span-1 border border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-900">
                            <label className="text-xs font-bold text-slate-500">
                                Controlled Drugs Rules
                            </label>
                            <input
                                type="checkbox"
                                checked={!!formData.controlled_drug_rules_enabled}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        controlled_drug_rules_enabled: e.target.checked,
                                    }))
                                }
                                className="w-4 h-4 rounded border-slate-300 text-healthcare-primary focus:ring-healthcare-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Min Stock Threshold (%)
                            </label>
                            <input
                                type="number"
                                value={formData.min_stock_threshold_percentage || 0}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        min_stock_threshold_percentage: Number(e.target.value),
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Expiry Alert (Days)
                            </label>
                            <input
                                type="number"
                                value={formData.expiry_alert_days || 0}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        expiry_alert_days: Number(e.target.value),
                                    }))
                                }
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>
                        To assign a Facility Admin, please save the facility first, then click the
                        "Assign" button in the facility list.
                    </p>
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
                        disabled={loading}
                        className="px-5 py-2 text-sm font-bold bg-healthcare-primary text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Facility'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export function FacilityManagementPage() {
    const { user } = useAuth();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState('All');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState('');
    const [planLimits, setPlanLimits] = useState<any>(null);
    const [isLimitsLoading, setIsLimitsLoading] = useState(false);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [facilityToDelete, setFacilityToDelete] = useState<number | null>(null);

    const fetchFacilities = async () => {
        setLoading(true);
        try {
            const response = await pharmacyService.getFacilities({ page, limit, search });

            setFacilities(response?.data || []);
            setTotalPages(response?.meta?.totalPages || 1);
            setTotalItems(response?.meta?.total || 0);
        } catch (error) {
            console.error('Failed to fetch facilities:', error);
            setFacilities([]);
            toast.error('Failed to fetch facilities');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchFacilities();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, limit, search]);

    useEffect(() => {
        const loadLimits = async () => {
            if (!user) return;
            setIsLimitsLoading(true);
            try {
                const limits = await subscriptionService.getMyLimits();
                setPlanLimits(limits);
            } catch {
                setPlanLimits(null);
            } finally {
                setIsLimitsLoading(false);
            }
        };

        void loadLimits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.organization_id]);

    const handleCreate = async (data: Partial<CreateFacilityDto>) => {
        setActionLoading(true);
        try {
            await pharmacyService.createFacility(data as any);
            toast.success('Facility created successfully');
            setIsCreateOpen(false);
            fetchFacilities();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create facility');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        setFacilityToDelete(id);
        setIsConfirmOpen(true);
    };

    const safeFacilities = Array.isArray(facilities) ? facilities : [];
    const limitsCanAddFacilities = planLimits?.can_add_facilities ?? true;

    const stats = [
        {
            label: 'Total Facilities',
            value: totalItems,
            icon: Building2,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
        },
        {
            label: 'Active Hospitals',
            value: safeFacilities.filter(
                (f) =>
                    ((f.type as string) === 'hospital' || (f.type as string) === 'HOSPITAL') &&
                    (f.status === 'Active' || (f as any).is_active),
            ).length,
            icon: Hotel,
            color: 'text-teal-500',
            bg: 'bg-teal-50',
        },
        {
            label: 'Active Clinics',
            value: safeFacilities.filter(
                (f) =>
                    ((f.type as string) === 'clinic' || (f.type as string) === 'CLINIC') &&
                    (f.status === 'Active' || (f as any).is_active),
            ).length,
            icon: Stethoscope,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50',
        },
        {
            label: 'Staff Managed',
            value: '---',
            icon: Users,
            color: 'text-amber-500',
            bg: 'bg-amber-50',
        },
    ];

    return (
        <ProtectedRoute allowedRoles={['super_admin', 'auditor', 'owner']}>
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                {}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-healthcare-dark tracking-tight">
                            Facility Management
                        </h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                            System-Wide Infrastructure & Scoping
                        </p>
                    </div>
                    {user?.role?.toString()?.toLowerCase() !== 'auditor' && (
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            disabled={!limitsCanAddFacilities || isLimitsLoading}
                            title={!limitsCanAddFacilities ? 'Facility limit reached for your plan' : undefined}
                            className="px-5 py-2.5 bg-healthcare-primary text-white rounded-xl font-black text-xs hover:bg-teal-700 transition-all shadow-lg active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> Register New Facility
                        </button>
                    )}
                </div>

                {}
                {loading ? (
                    <StatsSkeleton />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div
                                key={i}
                                className="glass-card p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all group"
                            >
                                <div
                                    className={cn(
                                        'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
                                        stat.bg,
                                        stat.color,
                                    )}
                                >
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-tight">
                                        {stat.label}
                                    </p>
                                    <p className="text-xl font-black text-healthcare-dark">
                                        {stat.value}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {}
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-400 tracking-tight">
                            Show
                        </span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-healthcare-dark focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                        >
                            {[10, 25, 50, 100].map((l) => (
                                <option key={l} value={l}>
                                    {l} per page
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 w-full lg:max-w-md">
                        <div className="relative group">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-healthcare-primary transition-colors"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search by name, email or address..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-healthcare-dark focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 w-full lg:w-auto custom-scrollbar">
                        {['All', 'hospital', 'clinic', 'pharmacy'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                className={cn(
                                    'px-4 py-2.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border-2',
                                    selectedType === type
                                        ? 'bg-healthcare-primary border-healthcare-primary text-white shadow-md shadow-teal-500/10'
                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-teal-100',
                                )}
                            >
                                {type === 'All'
                                    ? 'All Types'
                                    : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                            </button>
                        ))}
                    </div>
                </div>

                {}
                <div className="glass-card bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                    <div className="min-w-[1000px]">
                        {loading ? (
                            <SkeletonTable
                                rows={10}
                                columns={7}
                                headers={[
                                    'ID',
                                    'Facility Details',
                                    'Contact Info',
                                    'Admin',
                                    'Type',
                                    'Status',
                                ]}
                                columnAligns={[
                                    'center',
                                    'left',
                                    'left',
                                    'left',
                                    'center',
                                    'left',
                                    'right',
                                ]}
                                actions
                                className="border-none shadow-none"
                            />
                        ) : (
                            <table className="tc-table w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-center w-16">
                                            ID
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                            Facility Details
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                            Contact Info
                                        </th>
                                        <th className="px-6 py-4 text-[10px] lg:text-xs font-bold text-slate-400 tracking-tight">
                                            Admin
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-center">
                                            Type
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 tracking-tight text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {safeFacilities.length > 0 ? (
                                        safeFacilities.map((f) => {
                                            const type = f.type?.toLowerCase() || 'pharmacy';
                                            const isActive =
                                                f.status === 'Active' ||
                                                (f as any).is_active === true;
                                            return (
                                                <tr
                                                    key={f.id}
                                                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                                >
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs lg:text-sm font-bold text-healthcare-primary">
                                                            #{f.id}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div
                                                                className={cn(
                                                                    'w-10 h-10 rounded-xl flex items-center justify-center text-white',
                                                                    type.includes('hospital')
                                                                        ? 'bg-teal-500'
                                                                        : type.includes('clinic')
                                                                          ? 'bg-indigo-500'
                                                                          : 'bg-amber-500',
                                                                )}
                                                            >
                                                                {type.includes('hospital') ? (
                                                                    <Hotel size={20} />
                                                                ) : type.includes('clinic') ? (
                                                                    <Stethoscope size={20} />
                                                                ) : (
                                                                    <Store size={20} />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-healthcare-dark text-sm lg:text-base leading-tight">
                                                                    {f.name}
                                                                </p>
                                                                <div className="flex items-center gap-1 mt-1 text-slate-400">
                                                                    <MapPin size={10} />
                                                                    <p className="text-[10px] lg:text-xs font-bold uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] lg:max-w-[200px]">
                                                                        {f.address}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-2 whitespace-nowrap">
                                                            <p className="text-xs lg:text-sm font-bold text-healthcare-dark">
                                                                {f.email}
                                                            </p>
                                                            <span className="hidden lg:inline text-slate-300">
                                                                •
                                                            </span>
                                                            <p className="text-[10px] lg:text-xs font-bold text-slate-400">
                                                                {f.phone}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                                {f.facility_admin?.first_name
                                                                    ? f.facility_admin.first_name[0]
                                                                    : (f.admin_name || 'No')[0]}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs lg:text-sm font-bold text-healthcare-dark">
                                                                    {f.facility_admin
                                                                        ? `${f.facility_admin.first_name || ''} ${f.facility_admin.last_name || ''}`.trim() ||
                                                                          'Admin'
                                                                        : f.admin_name ||
                                                                          'No Admin'}
                                                                </span>
                                                                {f.facility_admin && (
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {f.facility_admin.email}
                                                                    </span>
                                                                )}
                                                                {!f.facility_admin &&
                                                                    !f.admin_name && (
                                                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                                                            No Admin
                                                                        </span>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 uppercase tracking-widest">
                                                            {(type || '').replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div
                                                            className={cn(
                                                                'w-fit px-3 py-1 rounded-lg text-[10px] lg:text-xs font-semibold flex items-center gap-1.5',
                                                                isActive
                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                    : 'bg-red-50 text-red-600 border border-red-100',
                                                            )}
                                                        >
                                                            {isActive ? (
                                                                <CheckCircle2 size={12} />
                                                            ) : (
                                                                <XCircle size={12} />
                                                            )}
                                                            {isActive ? 'Active' : 'Inactive'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {user?.role?.toString()?.toLowerCase() !==
                                                            'auditor' && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() =>
                                                                        handleDelete(f.id)
                                                                    }
                                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors tooltip"
                                                                    title="Delete Facility"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-10 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle
                                                        size={32}
                                                        className="text-slate-300"
                                                    />
                                                    <span className="text-slate-500 font-bold italic">
                                                        No facilities found
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                    <div className="text-[11px] font-bold text-slate-400 tracking-tight whitespace-nowrap">
                        Showing{' '}
                        <span className="text-healthcare-dark">
                            {totalItems === 0 ? 0 : (page - 1) * limit + 1}
                        </span>{' '}
                        to{' '}
                        <span className="text-healthcare-dark">
                            {Math.min(page * limit, totalItems)}
                        </span>{' '}
                        of <span className="text-healthcare-dark">{totalItems}</span> Facilities
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            disabled={page === 1 || loading}
                            className="p-2 border border-slate-100 dark:border-slate-800 rounded-xl disabled:opacity-50 text-slate-500 hover:text-healthcare-primary transition-all"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center gap-1">
                            {(() => {
                                const pages = [];
                                const maxVisible = 5;

                                if (totalPages <= maxVisible) {
                                    for (let i = 1; i <= totalPages; i++) {
                                        pages.push(i);
                                    }
                                } else {
                                    pages.push(1);
                                    if (page > 3) pages.push('...');

                                    const start = Math.max(2, page - 1);
                                    const end = Math.min(totalPages - 1, page + 1);

                                    for (let i = start; i <= end; i++) {
                                        if (!pages.includes(i)) pages.push(i);
                                    }

                                    if (page < totalPages - 2) pages.push('...');
                                    if (!pages.includes(totalPages)) pages.push(totalPages);
                                }

                                return pages.map((p, i) =>
                                    p === '...' ? (
                                        <span
                                            key={`sep-${i}`}
                                            className="px-2 text-slate-400 font-bold"
                                        >
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setPage(Number(p))}
                                            className={cn(
                                                'w-9 h-9 flex items-center justify-center rounded-xl text-[11px] font-black transition-all',
                                                page === p
                                                    ? 'bg-healthcare-primary text-white shadow-md shadow-teal-500/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400',
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ),
                                );
                            })()}
                        </div>
                        <button
                            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={page === totalPages || loading}
                            className="p-2 border border-slate-100 dark:border-slate-800 rounded-xl disabled:opacity-50 text-slate-500 hover:text-healthcare-primary transition-all"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {}
                <FacilityModal
                    isOpen={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    onSubmit={handleCreate}
                    loading={actionLoading}
                />
                <ConfirmModal
                    isOpen={isConfirmOpen}
                    onClose={() => {
                        setIsConfirmOpen(false);
                        setFacilityToDelete(null);
                    }}
                    onConfirm={async () => {
                        if (facilityToDelete) {
                            setActionLoading(true);
                            try {
                                await pharmacyService.deleteFacility(facilityToDelete);
                                toast.success('Facility deleted');
                                setIsConfirmOpen(false);
                                setFacilityToDelete(null);
                                fetchFacilities();
                            } catch (error) {
                                console.error(error);
                                toast.error('Failed to delete facility');
                            } finally {
                                setActionLoading(false);
                            }
                        }
                    }}
                    loading={actionLoading}
                    title="Delete Facility"
                    message="Are you sure you want to delete this facility? This action cannot be undone."
                    confirmText="Delete"
                />
            </div>
        </ProtectedRoute>
    );
}
