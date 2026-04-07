import { useState, useEffect } from 'react';
import {
    Users as UsersIcon,
    Search,
    ChevronLeft,
    ChevronRight,
    Plus,
    Pencil,
    History,
    UserCheck,
    UserX,
    Trash2,
    AlertTriangle,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link } from '@tanstack/react-router';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
import { userService, STAFF_ROLES, type CreateStaffPayload } from '../../services/user.service';
import { formatLocalDate } from '../../lib/date';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import type { User, Organization } from '../../types/auth';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { subscriptionService } from '../../services/subscription.service';

const ROLE_LABELS: Record<string, string> = {
    facility_admin: 'Facility Admin',
    pharmacist: 'Pharmacist',
    store_manager: 'Store Manager',
    auditor: 'Auditor',
    cashier: 'Cashier',
};

export function UsersPage() {
    const { user, facilities, organizations } = useAuth();
    const authUser = user;
    const role = (user?.role || '').toString().toUpperCase();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [facilityFilter, setFacilityFilter] = useState<number | ''>('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [roleFilter, setRoleFilter] = useState<string | 'all'>('all');
    const [planLimits, setPlanLimits] = useState<any>(null);
    const [isLimitsLoading, setIsLimitsLoading] = useState(false);

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const response = await userService.getUsers({
                page,
                limit,
                search: search || undefined,
                facility_id: facilityFilter === '' ? undefined : facilityFilter,
                status: statusFilter === 'all' ? undefined : statusFilter,
                role: roleFilter === 'all' ? undefined : roleFilter,
            });
            setUsers(response.data || []);
            setTotalPages(response.meta?.totalPages ?? 1);
            setTotal(response.meta?.total ?? 0);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load users');
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    };

    const groupedFacilities = (facilities ?? []).reduce(
        (acc, f) => {
            const orgName =
                organizations?.find((o: Organization) => o.id === f.organization_id)?.name ||
                'Other';
            if (!acc[orgName]) acc[orgName] = [];
            acc[orgName].push(f);
            return acc;
        },
        {} as Record<string, typeof facilities>,
    );

    useEffect(() => {
        const timer = setTimeout(() => loadUsers(), 300);
        return () => clearTimeout(timer);
    }, [page, search, facilityFilter, statusFilter, roleFilter, limit]);

    useEffect(() => {
        const loadLimits = async () => {
            if (!authUser) return;
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
    }, [authUser?.organization_id]);

    const displayName = (u: User) =>
        [u.first_name ?? u.firstName, u.last_name ?? u.lastName].filter(Boolean).join(' ') ||
        u.email ||
        '—';

    const roleCanAddStaff =
        role === 'OWNER' ||
        role === 'SUPER_ADMIN' ||
        role === 'SUPER ADMIN' ||
        role === 'FACILITY_ADMIN' ||
        role === 'FACILITY ADMIN';
    const limitsCanAddUsers = planLimits?.can_add_users ?? true;
    const currentUserId = authUser?.id ?? (authUser as any)?.userId ?? null;

    const canShowActions = (u: User) => {
        if (u.id === currentUserId) return false;
        const uRole = (u.role ?? '').toString().toUpperCase();
        if (uRole === 'OWNER') return false;
        return true;
    };

    return (
        <ProtectedRoute
            allowedRoles={[
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'OWNER',
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'AUDITOR',
            ]}
            requireFacility
        >
            <div className="h-full flex flex-col p-6 bg-slate-50/50 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">
                            Users
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {roleCanAddStaff
                                ? 'View and add staff with roles'
                                : 'View users (by role permissions)'}
                        </p>
                    </div>
                    {roleCanAddStaff && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            disabled={!limitsCanAddUsers || isLimitsLoading}
                            title={!limitsCanAddUsers ? 'User limit reached for your plan' : undefined}
                            className="flex items-center gap-2 px-4 py-2.5 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-600 transition-all shadow-md"
                        >
                            <Plus size={18} />
                            Add staff
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
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                        />
                    </div>
                    {facilities && facilities.length > 0 && (
                        <select
                            value={facilityFilter}
                            onChange={(e) => {
                                setFacilityFilter(
                                    e.target.value === '' ? '' : Number(e.target.value),
                                );
                                setPage(1);
                            }}
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                        >
                            <option value="">All facilities</option>
                            {user?.role?.toUpperCase().includes('SUPER')
                                ? Object.entries(groupedFacilities).map(([orgName, facs]) => (
                                      <optgroup key={orgName} label={orgName}>
                                          {facs.map((f) => (
                                              <option key={f.id} value={f.id}>
                                                  {f.name}
                                              </option>
                                          ))}
                                      </optgroup>
                                  ))
                                : facilities.map((f) => (
                                      <option key={f.id} value={f.id}>
                                          {f.name ?? `Facility ${f.id}`}
                                      </option>
                                  ))}
                        </select>
                    )}
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                            setPage(1);
                        }}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                    >
                        <option value="all">All status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20"
                    >
                        <option value="all">All roles</option>
                        {Object.entries(ROLE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {isLoading ? (
                    <SkeletonTable
                        rows={10}
                        columns={7}
                        headers={[
                            'ID',
                            'Joined Date',
                            'Name',
                            'Email',
                            'Role',
                            'Facility',
                            'Status',
                        ]}
                        columnAligns={[
                            'left',
                            'left',
                            'left',
                            'left',
                            'left',
                            'left',
                            'left',
                            'right',
                        ]}
                        actions
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700"
                    />
                ) : users.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-slate-500">
                            <UsersIcon size={48} className="mx-auto mb-3 opacity-50" />
                            <p>No users found</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="tc-table w-full min-w-[900px]">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase whitespace-nowrap tracking-wider">
                                                Joined Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase whitespace-nowrap tracking-wider">
                                                Role
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase whitespace-nowrap tracking-wider">
                                                Facility
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase whitespace-nowrap tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {users.map((u) => {
                                            const userFacility = facilities?.find(
                                                (f) => f.id === u.facility_id,
                                            );
                                            const joinedDate = u.created_at
                                                ? formatLocalDate(u.created_at, {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: 'numeric',
                                                  })
                                                : '—';
                                            return (
                                                <tr
                                                    key={u.id}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                                >
                                                    <td className="px-6 py-4 text-sm font-mono text-slate-600 dark:text-slate-400">
                                                        {u.id}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap dark:text-slate-400">
                                                        {joinedDate}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold whitespace-nowrap text-healthcare-dark dark:text-white">
                                                        {displayName(u)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {u.email || '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-healthcare-primary/10 text-healthcare-primary uppercase">
                                                            {u.role || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap dark:text-slate-400">
                                                        {userFacility?.name || '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-bold ${(u.is_active ?? u.isActive) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}
                                                        >
                                                            {(u.is_active ?? u.isActive)
                                                                ? 'Active'
                                                                : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {canShowActions(u) ? (
                                                            <UserActionsIcons
                                                                user={u}
                                                                facilities={facilities ?? []}
                                                                onUpdate={() => loadUsers()}
                                                            />
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between bg-white dark:bg-slate-800 px-6 py-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Showing {(page - 1) * limit + 1}–
                                        {Math.min(page * limit, total)} of {total}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                            Show
                                        </span>
                                        <select
                                            value={limit}
                                            onChange={(e) => {
                                                setLimit(Number(e.target.value));
                                                setPage(1);
                                            }}
                                            className="bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1 text-[11px] font-black text-healthcare-dark dark:text-white focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                                        >
                                            {[20, 40, 60, 100].map((l) => (
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
                                        {Array.from({ length: Math.min(totalPages, 5) }).map(
                                            (_, i) => (
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
                                            ),
                                        )}
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
                    </>
                )}

                {showAddModal && (
                    <AddStaffModal
                        facilities={facilities ?? []}
                        onClose={() => setShowAddModal(false)}
                        onSuccess={() => {
                            setShowAddModal(false);
                            loadUsers();
                        }}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}

function UserActionsIcons({
    user,
    facilities,
    onUpdate,
}: {
    user: User;
    facilities: Array<{ id: number; name?: string }>;
    onUpdate: () => void;
}) {
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
    const [showActivateConfirm, setShowActivateConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const isActive = user.is_active ?? user.isActive ?? true;
    const displayName =
        [user.first_name ?? user.firstName, user.last_name ?? user.lastName]
            .filter(Boolean)
            .join(' ') ||
        user.email ||
        'this user';

    const handleToggleActive = async () => {
        try {
            await userService.updateUser(user.id, { is_active: !isActive } as Partial<User>);
            toast.success(isActive ? 'User deactivated' : 'User activated');
            setShowDeactivateConfirm(false);
            setShowActivateConfirm(false);
            onUpdate();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update user');
        }
    };

    const handleArchive = async () => {
        try {
            await userService.deleteUser(user.id);
            toast.success('User archived successfully');
            setShowArchiveConfirm(false);
            onUpdate();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to archive user');
        }
    };

    const onToggleActiveClick = () => {
        if (isActive) setShowDeactivateConfirm(true);
        else setShowActivateConfirm(true);
    };

    return (
        <div className="flex items-center justify-end gap-1">
            <Link
                to={'/app/audit-logs' as any}
                search={{ search: user.email || user.id.toString() } as any}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-healthcare-primary transition-colors"
                title="View activity history"
            >
                <History size={18} />
            </Link>
            {user?.role?.toString()?.toLowerCase() !== 'auditor' && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-healthcare-primary transition-colors"
                        aria-label="Edit user"
                        title="Edit user"
                    >
                        <Pencil size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onToggleActiveClick}
                        className={`p-2 rounded-lg transition-colors ${isActive ? 'text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400'}`}
                        aria-label={isActive ? 'Deactivate' : 'Activate'}
                        title={isActive ? 'Deactivate' : 'Activate'}
                    >
                        {isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowArchiveConfirm(true)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                        aria-label="Archive user"
                        title="Archive user"
                    >
                        <Trash2 size={18} />
                    </button>
                </>
            )}
            {showEditModal && (
                <EditUserModal
                    user={user}
                    facilities={facilities}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        setShowEditModal(false);
                        onUpdate();
                    }}
                />
            )}
            {showDeactivateConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={() => setShowDeactivateConfirm(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-healthcare-dark dark:text-white">
                                    Deactivate user
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    This can be undone later
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to deactivate <strong>{displayName}</strong>? They
                            will no longer be able to sign in until reactivated.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeactivateConfirm(false)}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleToggleActive}
                                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600"
                            >
                                Deactivate
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showActivateConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={() => setShowActivateConfirm(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <UserCheck size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-healthcare-dark dark:text-white">
                                    Activate user
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Restore access for this user
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to activate <strong>{displayName}</strong>? They
                            will be able to sign in again.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowActivateConfirm(false)}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleToggleActive}
                                className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600"
                            >
                                Activate
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showArchiveConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={() => setShowArchiveConfirm(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-healthcare-dark dark:text-white">
                                    Archive user
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    This will permanently hide the user
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to archive <strong>{displayName}</strong>? They
                            will be removed from the staff list, but their historical data (sales,
                            orders, etc.) will be preserved in the database.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowArchiveConfirm(false)}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleArchive}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 shadow-md shadow-red-500/20"
                            >
                                Archive staff
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditUserModal({
    user,
    facilities,
    onClose,
    onSuccess,
}: {
    user: User;
    facilities: Array<{ id: number; name?: string }>;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [role, setRole] = useState(() => (user.role ?? '').toString().toLowerCase());
    const [facilityId, setFacilityId] = useState<number | ''>(() => {
        if (user.facility_id) return user.facility_id;
        if (facilities.length === 1) return facilities[0].id;
        return '';
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await userService.updateUser(user.id, {
                role: role as User['role'],
                facility_id: facilityId === '' ? undefined : (facilityId as number),
            } as Partial<User>);
            toast.success('User updated');
            onSuccess();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update user');
        } finally {
            setSubmitting(false);
        }
    };

    const editableRoles = [...STAFF_ROLES];
    const currentRole = (user.role ?? '').toString().toLowerCase();
    if (!editableRoles.includes(currentRole as any) && currentRole && currentRole !== 'owner') {
        editableRoles.push(currentRole as any);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-black text-healthcare-dark dark:text-white mb-4">
                    Edit user
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                    {[user.first_name ?? user.firstName, user.last_name ?? user.lastName]
                        .filter(Boolean)
                        .join(' ') || user.email}
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Role
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                        >
                            {editableRoles.map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABELS[r] ?? (r || '').replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {facilities.length > 1 && (
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Facility
                            </label>
                            <select
                                value={facilityId}
                                onChange={(e) =>
                                    setFacilityId(
                                        e.target.value === '' ? '' : Number(e.target.value),
                                    )
                                }
                                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="">None</option>
                                {facilities.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name ?? `Facility ${f.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
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
                            {submitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddStaffModal({
    facilities,
    onClose,
    onSuccess,
}: {
    facilities: Array<{ id: number; name?: string }>;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState<Omit<CreateStaffPayload, 'password'>>({
        email: '',
        first_name: '',
        last_name: '',
        role: 'pharmacist',
    });
    const [facilityId, setFacilityId] = useState<number | ''>(() => {
        return facilities.length === 1 ? facilities[0].id : '';
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await userService.createUser({
                email: form.email,
                first_name: form.first_name,
                last_name: form.last_name,
                role: form.role,
                facility_id: facilityId === '' ? undefined : (facilityId as number),
            });
            toast.success(
                'Staff member added. They will receive an email with a link to verify and set their password.',
            );
            onSuccess();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to add staff');
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
                <h2 className="text-xl font-black text-healthcare-dark mb-4">Add staff member</h2>
                <p className="text-sm text-slate-500 mb-4">
                    Create a new user with a role. They will receive an email with a link to verify
                    their email and set their own password, plus their role and where they are
                    joining.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                                First name *
                            </label>
                            <input
                                type="text"
                                value={form.first_name}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, first_name: e.target.value }))
                                }
                                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                                required
                                minLength={2}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Last name *
                            </label>
                            <input
                                type="text"
                                value={form.last_name}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, last_name: e.target.value }))
                                }
                                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                                required
                                minLength={2}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Role *
                        </label>
                        <select
                            value={form.role}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    role: e.target.value as CreateStaffPayload['role'],
                                }))
                            }
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                        >
                            {STAFF_ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABELS[r] ?? r}
                                </option>
                            ))}
                        </select>
                    </div>
                    {facilities.length > 1 && (
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Facility (optional)
                            </label>
                            <select
                                value={facilityId}
                                onChange={(e) =>
                                    setFacilityId(
                                        e.target.value === '' ? '' : Number(e.target.value),
                                    )
                                }
                                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="">None</option>
                                {facilities.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name ?? `Facility ${f.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
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
                            {submitting ? 'Adding...' : 'Add staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
