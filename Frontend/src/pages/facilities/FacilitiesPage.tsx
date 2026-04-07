import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Grid, List, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
import { pharmacyService } from '../../services/pharmacy.service';
import type { Facility } from '../../types/pharmacy';
import toast from 'react-hot-toast';
import { CreateFacilityModal } from '../../components/facility/CreateFacilityModal';
import { useAuth } from '../../context/AuthContext';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { SkeletonTable } from '../../components/ui/SkeletonTable';

export function FacilitiesPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(12);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const role = user?.role?.toUpperCase();
    const isFacilityAdmin =
        role === 'FACILITY_ADMIN' || role === 'FACILITY ADMIN' || role === 'OWNER';

    const loadFacilities = async () => {
        setIsLoading(true);
        try {
            const response = await pharmacyService.getFacilities({ page, limit, search });
            setFacilities(response.data || []);
            setTotalPages(response.meta?.totalPages || 1);
            totalItems !== response.meta?.total && setTotalItems(response.meta?.total || 0);
        } catch (error: any) {
            console.error('Failed to load facilities:', error);

            if (
                isFacilityAdmin &&
                (error?.response?.status === 404 || error?.response?.status === 403)
            ) {
                setFacilities([]);
            } else {
                toast.error(error?.response?.data?.message || 'Failed to load facilities');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadFacilities();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, limit, search]);

    const handleCreateSuccess = () => {
        loadFacilities();
    };

    const showOrgColumn = ['SUPER_ADMIN', 'SUPER ADMIN', 'OWNER'].includes(role || '');

    if (isLoading) {
        return (
            <ProtectedRoute
                allowedRoles={[
                    'SUPER_ADMIN',
                    'SUPER ADMIN',
                    'OWNER',
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'ADMIN',
                    'AUDITOR',
                ]}
                requireFacility
            >
                <div className="h-full flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4">
                        <div className="space-y-2">
                            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                        </div>
                    </div>
                    <div className="flex-1 px-6">
                        <SkeletonTable
                            rows={8}
                            columns={showOrgColumn ? 9 : 8}
                            headers={[
                                '#',
                                'ID',
                                ...(showOrgColumn ? ['Organization'] : []),
                                'Name',
                                'Type',
                                'Address',
                                'Email',
                                'Phone',
                            ]}
                            columnAligns={
                                [
                                    'left',
                                    'left',
                                    ...(showOrgColumn ? ['left'] : []),
                                    'left',
                                    'left',
                                    'left',
                                    'left',
                                    'left',
                                    'right',
                                ] as ('left' | 'center' | 'right')[]
                            }
                            actions
                            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm"
                        />
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute
            allowedRoles={[
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'OWNER',
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'ADMIN',
                'AUDITOR',
            ]}
            requireFacility
        >
            <div className="h-full flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                {}
                <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark">My Facilities</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Manage your pharmacies and clinics
                        </p>
                    </div>

                    <div className="flex-1 max-w-md lg:max-w-xl mx-8 hidden md:block">
                        <div className="relative group">
                            <Search
                                size={18}
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
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-healthcare-dark focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${
                                    viewMode === 'grid'
                                        ? 'bg-healthcare-primary text-white'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Grid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-2 rounded-md transition-all ${
                                    viewMode === 'table'
                                        ? 'bg-healthcare-primary text-white'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <List size={18} />
                            </button>
                        </div>

                        {}
                        {(role === 'SUPER_ADMIN' || role === 'SUPER ADMIN' || role === 'OWNER') && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-healthcare-primary text-white rounded-lg font-bold text-sm hover:bg-teal-700 transition-all shadow-lg"
                            >
                                <Plus size={18} />
                                <span>Add Facility</span>
                            </button>
                        )}
                    </div>
                </div>

                {}
                <div className="flex-1 flex flex-col min-h-0 px-6">
                    {}
                    {facilities.length === 0 ? (
                        isFacilityAdmin ? (
                            <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="text-center max-w-md">
                                    <p className="text-slate-500 mb-4 font-medium">
                                        No facility assigned
                                    </p>
                                    <p className="text-sm text-slate-400 mb-6">
                                        Contact your organization administrator to be assigned to a
                                        facility.
                                    </p>
                                    <button
                                        onClick={() =>
                                            navigate({ to: '/app' as any, search: {} as any })
                                        }
                                        className="px-6 py-3 bg-healthcare-primary text-white rounded-lg font-bold hover:bg-teal-700 transition-all"
                                    >
                                        Go to Dashboard
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-slate-500 mb-4">No facilities found</p>
                                    {(role === 'SUPER_ADMIN' ||
                                        role === 'SUPER ADMIN' ||
                                        role === 'OWNER') && (
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="px-6 py-3 bg-healthcare-primary text-white rounded-lg font-bold hover:bg-teal-700 transition-all"
                                        >
                                            Add Facility
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    ) : viewMode === 'grid' ? (
                        <div className="flex-1 overflow-auto pb-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {facilities.map((facility) => (
                                    <div
                                        key={facility.id}
                                        className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700 relative group"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 bg-healthcare-primary/10 rounded-xl flex items-center justify-center">
                                                <span className="text-2xl">🏥</span>
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-black text-healthcare-dark mb-1">
                                            {facility.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-4">
                                            {(facility.type || '').replace('_', ' ')}
                                        </p>
                                        <div className="space-y-2 text-sm">
                                            <p className="text-slate-600 dark:text-slate-400">
                                                📍 {facility.address}
                                            </p>
                                            <p className="text-slate-600 dark:text-slate-400">
                                                📞 {facility.phone}
                                            </p>
                                            <p className="text-slate-600 dark:text-slate-400">
                                                ✉️ {facility.email}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto pb-2">
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-x-auto">
                                <table className="tc-table w-full min-w-[800px]">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                #
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            {(role === 'SUPER_ADMIN' ||
                                                role === 'SUPER ADMIN' ||
                                                role === 'OWNER') && (
                                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                    Organization
                                                </th>
                                            )}
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Address
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Phone
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {facilities.map((facility, index) => (
                                            <tr
                                                key={facility.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-slate-500">
                                                        {(page - 1) * limit + index + 1}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={
                                                            role === 'AUDITOR'
                                                                ? 'font-bold text-slate-400'
                                                                : 'font-bold text-healthcare-primary'
                                                        }
                                                    >
                                                        #{facility.id}
                                                    </span>
                                                </td>
                                                {(role === 'SUPER_ADMIN' ||
                                                    role === 'SUPER ADMIN' ||
                                                    role === 'OWNER') && (
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                            {facility.organization?.name || '—'}
                                                        </div>
                                                        {facility.organization?.code && (
                                                            <div className="text-xs text-slate-500 font-mono">
                                                                {facility.organization.code}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-healthcare-dark">
                                                        {facility.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-slate-600 dark:text-slate-400 uppercase">
                                                        {(facility.type || '').replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                                        {facility.address}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                                        {facility.email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                                        {facility.phone}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right" />
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {}
                    {facilities.length > 0 && (
                        <div className="flex-shrink-0 mt-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-center gap-4 rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
                            <div className="flex items-center gap-6">
                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                                    Showing{' '}
                                    <span className="text-healthcare-dark">
                                        {totalItems === 0 ? 0 : (page - 1) * limit + 1}
                                    </span>{' '}
                                    to{' '}
                                    <span className="text-healthcare-dark">
                                        {Math.min(page * limit, totalItems)}
                                    </span>{' '}
                                    of <span className="text-healthcare-dark">{totalItems}</span>{' '}
                                    Facilities
                                </div>
                                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-6">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        Show
                                    </span>
                                    <select
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1 text-[11px] font-black text-healthcare-dark focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                                    >
                                        {[12, 24, 48, 96].map((l) => (
                                            <option key={l} value={l}>
                                                {l} items
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={page === 1 || isLoading}
                                    className="p-2 border border-slate-100 dark:border-slate-800 rounded-xl disabled:opacity-50 text-slate-500 hover:text-healthcare-primary transition-all"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPage(i + 1)}
                                            className={cn(
                                                'w-9 h-9 flex items-center justify-center rounded-xl text-[11px] font-black transition-all',
                                                page === i + 1
                                                    ? 'bg-healthcare-primary text-white shadow-md shadow-teal-500/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400',
                                            )}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() =>
                                        setPage((prev) => Math.min(prev + 1, totalPages))
                                    }
                                    disabled={page === totalPages || isLoading}
                                    className="p-2 border border-slate-100 dark:border-slate-800 rounded-xl disabled:opacity-50 text-slate-500 hover:text-healthcare-primary transition-all"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {}
                {showCreateModal && (
                    <CreateFacilityModal
                        onClose={() => {
                            setShowCreateModal(false);
                            handleCreateSuccess();
                        }}
                    />
                )}

                {}
            </div>
        </ProtectedRoute>
    );
}
