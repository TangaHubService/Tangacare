import { useState, useEffect } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Organization } from '../../types/pharmacy';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { PERMISSIONS } from '../../types/auth';
import { OrganizationDetailsModal } from '../../components/organization/OrganizationDetailsModal';

export function OrganizationsPage() {
    const { user, organizations: authOrganizations } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>(() =>
        Array.isArray(authOrganizations) && authOrganizations.length > 0 ? authOrganizations : [],
    );
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page] = useState(1);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

    const loadOrganizations = async () => {
        setIsLoading(true);
        try {
            const response = await pharmacyService.getOrganizations({ page, limit: 12, search });
            setOrganizations(response.data || []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load organizations');
        } finally {
            setIsLoading(false);
        }
    };

    // If auth context already has organizations (e.g., after login), show them immediately.
    useEffect(() => {
        if (Array.isArray(authOrganizations) && authOrganizations.length > 0 && !search) {
            setOrganizations(authOrganizations);
            setIsLoading(false);
            return;
        }

        const timer = setTimeout(() => loadOrganizations(), 300);
        return () => clearTimeout(timer);
    }, [page, search, authOrganizations]);

    const handleCreateSuccess = () => {
        setShowCreateModal(false);
        loadOrganizations();
    };

    const role = user?.role?.toUpperCase();
    const canCreate = role === 'SUPER_ADMIN';

    return (
        <ProtectedRoute requiredPermissions={[PERMISSIONS.ORGANIZATION_MANAGE]}>
            <div className="h-full flex flex-col p-6 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark">Organizations</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Manage organizations and their facilities
                        </p>
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-600 transition-all shadow-md"
                        >
                            <Plus size={18} />
                            New Organization
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search organizations..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center flex-1">
                        <div className="w-8 h-8 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {organizations.map((org) => (
                            <div
                                key={org.id}
                                onClick={() => setSelectedOrganization(org)}
                                className="glass-card p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-healthcare-primary/30 transition-all cursor-pointer hover:shadow-md"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-healthcare-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="text-healthcare-primary" size={24} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-healthcare-dark truncate">
                                            {org.name}
                                        </h3>
                                        {org.code && (
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                {org.code}
                                            </p>
                                        )}
                                        {org.type && (
                                            <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                                                {(org.type || '').replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showCreateModal && (
                    <CreateOrganizationModal
                        onClose={() => setShowCreateModal(false)}
                        onSuccess={handleCreateSuccess}
                    />
                )}

                {selectedOrganization && (
                    <OrganizationDetailsModal
                        organization={selectedOrganization}
                        onClose={() => setSelectedOrganization(null)}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}

function CreateOrganizationModal({
    onClose,
    onSuccess,
}: {
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [type, setType] = useState('single_pharmacy');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            await pharmacyService.createOrganization({ name, code: code || undefined, type });
            toast.success('Organization created');
            onSuccess();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to create organization');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-black text-healthcare-dark mb-4">New Organization</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Code
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="e.g. TCD"
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                        >
                            <option value="single_pharmacy">Single Pharmacy</option>
                            <option value="pharmacy_chain">Pharmacy Chain</option>
                            <option value="clinic">Clinic</option>
                            <option value="hospital">Hospital</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-2.5 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-600 disabled:opacity-50"
                        >
                            {submitting ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
