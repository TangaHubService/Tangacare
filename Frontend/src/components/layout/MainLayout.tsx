import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, Link, useNavigate } from '@tanstack/react-router';
import {
    LayoutDashboard,
    Package,
    Users,
    Settings,
    LogOut,
    ChevronLeft,
    Menu,
    Search,
    Bell,
    Moon,
    Sun,
    ShoppingCart,
    Factory,
    Database,
    Building2,
    ChevronDown,
    FileText,
    ArrowLeft,
    ShieldCheck,
    Receipt,
    RotateCcw,
    Truck,
    RefreshCw,
    BarChart3,
    Layers,
    ArrowLeftRight,
    ClipboardList,
    AlertTriangle,
    Scale,
    TrendingUp,
    BarChart2,
    ShoppingBag,
    ScrollText,
} from 'lucide-react';
import logo from '../../assets/tanga-logo.png';
import { useAuth } from '../../context/AuthContext';
import { RouteContentFallback } from '../ui/RouteContentFallback';
import { isSuperAdmin } from '../../types/auth';
import { userHasPermission } from '../../lib/rolePermissions';
import type { GlobalSearchResultItem, GlobalSearchResults } from '../../types/pharmacy';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../../context/ThemeContext';
import { NotificationBell } from '../ui/NotificationBell';
import { FacilityEmptyState } from '../facility/FacilityEmptyState';
import { CreateFacilityModal } from '../facility/CreateFacilityModal';
import { SetupPharmacyModal } from '../facility/SetupPharmacyModal';
import { JoinOrganizationModal } from '../facility/JoinOrganizationModal';
import { pharmacyService } from '../../services/pharmacy.service';
import { adminOrganizationsService } from '../../services/admin-organizations.service';
import { toast } from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface NavItem {
    to: string;
    icon: React.ComponentType<{ size: number }>;
    label: string;
    allowedRoles?: string[];
    allowedPermissions?: string[];
    children?: NavItem[];
    subsection?: string;
    /** When true, expanded sidebar lists children directly under the section (parent row hidden). Collapsed sidebar still shows the parent icon. */
    hideParentWhenExpanded?: boolean;
}

interface NavSection {
    id: string;
    label: string;
    items: NavItem[];
}

type GlobalSearchGroupKey =
    | 'medicines'
    | 'batches'
    | 'suppliers'
    | 'purchaseOrders'
    | 'stockMovements';

const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchResults = {
    medicines: [],
    batches: [],
    suppliers: [],
    purchaseOrders: [],
    stockMovements: [],
};

const GLOBAL_SEARCH_GROUPS: Array<{ key: GlobalSearchGroupKey; label: string }> = [
    { key: 'medicines', label: 'Medicines' },
    { key: 'batches', label: 'Batches' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'purchaseOrders', label: 'Purchase Orders' },
    { key: 'stockMovements', label: 'Stock Movements' },
];

const NAV_SECTIONS: NavSection[] = [
    {
        id: 'operations',
        label: 'Operations',
        items: [
            {
                to: '/app',
                icon: LayoutDashboard,
                label: 'Dashboard',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'CASHIER',
                    'PHARMACIST',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'STORE_KEEPER',
                    'STORE KEEPER',
                    'AUDITOR',
                    'ADMIN',
                    'DOCTOR',
                ],
            },
            {
                to: '/app/sell',
                icon: ShoppingCart,
                label: 'Sell',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'CASHIER',
                    'PHARMACIST',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'AUDITOR',
                    'ADMIN',
                ],
            },
            {
                to: '/app/patients',
                icon: Users,
                label: 'Customers',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'CASHIER',
                    'PHARMACIST',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'AUDITOR',
                    'ADMIN',
                ],
                allowedPermissions: ['patients:read'],
            },
            {
                to: '/app/insurance',
                icon: ShieldCheck,
                label: 'Insurance',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'CASHIER',
                    'PHARMACIST',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'AUDITOR',
                    'ADMIN',
                ],
            },
            {
                to: '/app/alerts',
                icon: Bell,
                label: 'Alerts',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'STORE_KEEPER',
                    'STORE KEEPER',
                    'PHARMACIST',
                    'AUDITOR',
                    'ADMIN',
                ],
                allowedPermissions: ['alerts:read'],
            },
        ],
    },
    {
        id: 'inventory',
        label: 'Stock',
        items: [
            {
                to: '/app/inventory',
                icon: Package,
                label: 'Stock',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'CASHIER',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'STORE_KEEPER',
                    'STORE KEEPER',
                    'PHARMACIST',
                    'AUDITOR',
                    'ADMIN',
                    'DOCTOR',
                ],
                children: [
                    { to: '/app/inventory', icon: Package, label: 'Medicines' },
                    { to: '/app/stock', icon: Layers, label: 'Batches' },
                    {
                        to: '/app/stock-movements',
                        icon: ArrowLeftRight,
                        label: 'Movements',
                        allowedPermissions: ['stock_movements:read'],
                    },
                    {
                        to: '/app/stocktaking',
                        icon: ClipboardList,
                        label: 'Stock count',
                        allowedPermissions: ['inventory:write'],
                    },
                    { to: '/app/recalls', icon: AlertTriangle, label: 'Expiry & recalls' },
                    {
                        to: '/app/variances',
                        icon: Scale,
                        label: 'Variances',
                        allowedRoles: [
                            'FACILITY_ADMIN',
                            'FACILITY ADMIN',
                            'OWNER',
                            'STORE_MANAGER',
                            'STORE MANAGER',
                            'ADMIN',
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'supply',
        label: 'Order & replenish',
        items: [
            {
                to: '/app/order-receive',
                icon: Truck,
                label: 'Order & receive',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'STORE_KEEPER',
                    'STORE KEEPER',
                    'AUDITOR',
                    'ADMIN',
                ],
                allowedPermissions: ['procurement:read'],
                hideParentWhenExpanded: true,
                children: [
                    { to: '/app/procurement/orders', icon: ShoppingCart, label: 'Purchase orders' },
                    { to: '/app/procurement/suppliers', icon: Factory, label: 'Suppliers' },
                ],
            },
            {
                to: '/app/replenish',
                icon: RefreshCw,
                label: 'Replenish',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'PHARMACIST',
                    'ADMIN',
                ],
                allowedPermissions: ['procurement:read'],
            },
        ],
    },
    {
        id: 'reports',
        label: 'Reports',
        items: [
            {
                to: '/app/analytics/sales',
                icon: FileText,
                label: 'Reports',
                allowedRoles: [
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'OWNER',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'AUDITOR',
                    'ADMIN',
                ],
                allowedPermissions: ['reports:read', 'audit:read'],
                children: [
                    {
                        to: '/app/analytics/sales',
                        icon: TrendingUp,
                        label: 'Sales summary',
                        allowedPermissions: ['reports:read'],
                    },
                    {
                        to: '/app/analytics/fast-moving',
                        icon: BarChart2,
                        label: 'Top sellers',
                        allowedPermissions: ['reports:read'],
                    },
                    {
                        to: '/app/analytics/inventory',
                        icon: Package,
                        label: 'Stock & expiry',
                        allowedPermissions: ['reports:read'],
                    },
                    {
                        to: '/app/analytics/procurement',
                        icon: ShoppingBag,
                        label: 'Purchasing',
                        allowedPermissions: ['reports:read'],
                    },
                    {
                        to: '/app/analytics/returns',
                        icon: RotateCcw,
                        label: 'Returns',
                        allowedPermissions: ['reports:read'],
                    },
                    {
                        to: '/app/audit-logs',
                        icon: ScrollText,
                        label: 'Audit logs',
                        allowedPermissions: ['audit:read'],
                    },
                ],
            },
        ],
    },
    {
        id: 'settings',
        label: 'Settings & admin',
        items: [
            {
                to: '/app/overview',
                icon: BarChart3,
                label: 'Management overview',
                allowedRoles: [
                    'OWNER',
                    'ADMIN',
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'STORE_MANAGER',
                    'STORE MANAGER',
                    'SUPER_ADMIN',
                    'SUPER ADMIN',
                    'Admin',
                    'Super Admin',
                ],
            },
            {
                to: '/app/organizations',
                icon: Building2,
                label: 'Organizations',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN', 'OWNER'],
                allowedPermissions: ['organization:manage'],
            },
            {
                to: '/app/facilities',
                icon: Factory,
                label: 'Branches',
                allowedRoles: ['OWNER', 'AUDITOR'],
                allowedPermissions: ['facility:read', 'facility:manage'],
            },
            {
                to: '/app/users',
                icon: Users,
                label: 'Users',
                allowedRoles: [
                    'SUPER_ADMIN',
                    'SUPER ADMIN',
                    'OWNER',
                    'FACILITY_ADMIN',
                    'FACILITY ADMIN',
                    'AUDITOR',
                ],
                allowedPermissions: ['users:read', 'users:manage'],
            },
            {
                to: '/app/admin/dashboard',
                icon: Receipt,
                label: 'Admin dashboard',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/admin/billing/customers',
                icon: Users,
                label: 'Billing customers',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/admin/billing/subscriptions',
                icon: FileText,
                label: 'Billing subscriptions',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/admin/billing/payments',
                icon: Receipt,
                label: 'Billing payments',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/admin/billing/trials',
                icon: ShieldCheck,
                label: 'Billing trials',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/admin/billing/plans',
                icon: Settings,
                label: 'Billing plans',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/admin/billing/gateways',
                icon: Database,
                label: 'Billing gateways',
                allowedRoles: ['SUPER_ADMIN', 'SUPER ADMIN'],
            },
            {
                to: '/app/billing',
                icon: Receipt,
                label: 'Billing',
                allowedRoles: ['OWNER'],
            },
        ],
    },
];

interface SidebarLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isCollapsed: boolean;
    children?: NavItem[];
    /**
     * When true, expanded sidebar hides the parent row and lists children flush under the section
     * (duplicate section title, or `hideParentWhenExpanded` on the nav item). Collapsed sidebar keeps the parent icon.
     */
    flattenExpandedChildren?: boolean;
    onNavigate?: () => void;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
    to,
    icon,
    label,
    isCollapsed,
    children,
    flattenExpandedChildren = false,
    onNavigate,
}) => {
    const hasChildren = children && children.length > 0;
    const hideParentWhileExpanded =
        flattenExpandedChildren && hasChildren && !isCollapsed;
    const showParentRow = !hideParentWhileExpanded;
    const flushChildList = flattenExpandedChildren && !isCollapsed;

    const childLinkClass = cn(
        'flex items-center gap-3 rounded-lg transition-colors whitespace-nowrap group/child',
        flushChildList
            ? 'px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-healthcare-primary hover:bg-blue-50 dark:hover:bg-slate-800'
            : 'px-3 py-2 text-sm text-slate-600 hover:text-healthcare-primary hover:bg-blue-50 dark:hover:bg-slate-800',
    );

    return (
        <div>
            {showParentRow && (
                <Link
                    to={to as any}
                    search={{} as any}
                    onClick={() => onNavigate?.()}
                    activeProps={{
                        className:
                            'bg-healthcare-primary/10 text-healthcare-primary dark:bg-healthcare-primary dark:text-white shadow-none',
                    }}
                    className={cn(
                        'flex items-center px-4 py-2.5 text-slate-600 hover:bg-blue-50 hover:text-healthcare-primary rounded-lg transition-all group',
                        isCollapsed ? 'justify-center px-0 mx-auto w-10' : 'gap-3',
                    )}
                >
                    <span className="group-hover:scale-105 transition-transform flex-shrink-0">
                        {icon}
                    </span>
                    {!isCollapsed && (
                        <span className="font-bold text-sm whitespace-nowrap">{label}</span>
                    )}
                </Link>
            )}
            {!isCollapsed && hasChildren && (
                <div
                    className={cn(
                        'mt-1 space-y-1',
                        flushChildList
                            ? 'ml-0 pl-0'
                            : 'ml-9 border-l-2 border-blue-100 dark:border-slate-700 pl-2',
                    )}
                >
                    {children.map((child, index) => {
                        const ChildIcon = child.icon;
                        const prevSub = index > 0 ? children[index - 1]?.subsection : undefined;
                        const showSubsection =
                            Boolean(child.subsection) && child.subsection !== prevSub;
                        return (
                            <div key={child.to}>
                                {showSubsection && (
                                    <div className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        {child.subsection}
                                    </div>
                                )}
                                <Link
                                    to={child.to as any}
                                    search={{} as any}
                                    onClick={() => onNavigate?.()}
                                    activeProps={{
                                        className:
                                            'text-healthcare-primary font-bold bg-blue-50 dark:bg-blue-950/40',
                                    }}
                                    className={childLinkClass}
                                >
                                    <span className="flex-shrink-0 text-slate-500 group-hover/child:text-healthcare-primary transition-colors">
                                        <ChildIcon size={18} />
                                    </span>
                                    <span className="font-[inherit]">{child.label}</span>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export function MainLayout() {
    const {
        logout,
        user,
        facilities,
        currentFacility,
        setFacility,
        organizations,
        setOrganization,
        refreshProfile,
        organizationId,
        facilityId,
        hasOrganization,
        isOwner,
        isLoading,
    } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const { isDark, toggleTheme } = useTheme();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const globalSearchRef = useRef<HTMLDivElement | null>(null);

    const effectiveFacilityId = facilityId ?? user?.facility_id ?? undefined;

    const isItemAllowed = (item: NavItem): boolean => {
        if (isSuperAdmin(user?.role)) {
            return true;
        }

        const hasPermGate = !!item.allowedPermissions?.length;
        const hasRoleGate = !!item.allowedRoles?.length;

        const permOk =
            !hasPermGate ||
            item.allowedPermissions!.some((perm) => userHasPermission(user, perm));

        const userRole = (user?.role || '').toString().toUpperCase();
        const roleOk =
            !hasRoleGate ||
            !!item.allowedRoles!.some(
                (role) =>
                    role.toUpperCase() === userRole ||
                    role.toUpperCase().replace('_', ' ') === userRole.replace('_', ' '),
            );

        if (hasPermGate && hasRoleGate) {
            return permOk || roleOk;
        }
        return permOk && roleOk;
    };

    const filteredSections = useMemo(() => {
        return NAV_SECTIONS.map((section) => {
            const items = section.items.filter(isItemAllowed).map((item) => {
                const filteredChildren = item.children?.filter((child) => isItemAllowed(child));
                return {
                    ...item,
                    children: filteredChildren,
                };
            });
            return {
                ...section,
                items,
            };
        }).filter((section) => section.items.length > 0);
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate({ to: '/auth/login' as any, search: {} as any });
    };

    const isSuperAdminUser = isSuperAdmin(user?.role);

    const showSwitcher =
        organizations.length > 0 || facilities.length > 0 || isSuperAdminUser || isOwner;

    const switcherLabel =
        currentFacility?.name ??
        facilities[0]?.name ??
        (user as any)?.facility?.name ??
        'Select Facility';

    const normalizedRole = (user?.role || '').toLowerCase().replace(/[\s_]+/g, '');

    const isOwnerOrAdmin = ['owner', 'facilityadmin'].includes(normalizedRole);

    // Super admins should never be forced through organization onboarding.
    const needsOnboarding =
        !isSuperAdminUser && !hasOrganization && (isOwnerOrAdmin || normalizedRole === 'user');

    const isUnassignedAdmin =
        hasOrganization &&
        facilities.length === 0 &&
        !user?.facility_id &&
        !user?.facility &&
        isOwnerOrAdmin;

    React.useEffect(() => {
        const path = window.location.pathname;
        if ((needsOnboarding || isUnassignedAdmin) && path !== '/app/facilities') {
            navigate({ to: '/app/facilities' as any, replace: true, search: {} as any } as any);
        }
    }, [needsOnboarding, isUnassignedAdmin, navigate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                globalSearchRef.current &&
                !globalSearchRef.current.contains(event.target as Node)
            ) {
                setGlobalSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(globalSearchQuery.trim());
        }, 400);
        return () => window.clearTimeout(timer);
    }, [globalSearchQuery]);

    const { data: searchQueryData, isFetching: globalSearchLoading } = useQuery({
        queryKey: [
            'pharmacy-global-search',
            organizationId ?? user?.organization_id ?? 0,
            effectiveFacilityId ?? 0,
            debouncedSearchQuery,
        ],
        queryFn: () => pharmacyService.globalSearch({ q: debouncedSearchQuery, limit: 5 }),
        enabled: debouncedSearchQuery.length >= 2 && !!user,
        staleTime: 30_000,
    });

    const globalSearchResults: GlobalSearchResults = useMemo(() => {
        if (debouncedSearchQuery.length < 2) {
            return EMPTY_GLOBAL_SEARCH_RESULTS;
        }
        return searchQueryData ?? EMPTY_GLOBAL_SEARCH_RESULTS;
    }, [debouncedSearchQuery, searchQueryData]);

    useEffect(() => {
        if (debouncedSearchQuery.length < 2) {
            setGlobalSearchOpen(false);
        }
    }, [debouncedSearchQuery]);

    useEffect(() => {
        if (debouncedSearchQuery.length < 2 || !searchQueryData) {
            return;
        }
        const count = Object.values(searchQueryData).reduce<number>(
            (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
            0,
        );
        if (count > 0) {
            setGlobalSearchOpen(true);
        }
    }, [debouncedSearchQuery, searchQueryData]);

    const globalSearchResultCount = useMemo(
        () =>
            Object.values(globalSearchResults).reduce(
                (count, items) => count + (Array.isArray(items) ? items.length : 0),
                0,
            ),
        [globalSearchResults],
    );

    const flattenedGlobalSearchResults = useMemo(
        () => GLOBAL_SEARCH_GROUPS.flatMap((group) => globalSearchResults[group.key]),
        [globalSearchResults],
    );

    const handleGlobalSearchSelect = (item: GlobalSearchResultItem) => {
        setGlobalSearchOpen(false);
        setGlobalSearchQuery('');
        navigate({ to: item.to as any, search: {} as any });
    };

    const showAllFacilitiesOption = ['OWNER', 'SUPER_ADMIN', 'SUPER ADMIN'].includes(
        user?.role || '',
    );

    const showFacilityNameOnly =
        !isSuperAdminUser && !isOwner && facilities.length <= 1 && organizations.length <= 1;

    const profileFirstName = String(user?.firstName || user?.first_name || '').trim();
    const profileLastName = String(user?.lastName || user?.last_name || '').trim();
    const profileName =
        `${profileFirstName} ${profileLastName}`.trim() ||
        String(user?.email || '').trim() ||
        'Account';
    const profileRoleLabel = String(user?.role || 'User')
        .replace(/[_\s]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    const profileInitialsSource = `${profileFirstName[0] || ''}${profileLastName[0] || ''}`.trim();
    const profileInitials = (profileInitialsSource || profileName.slice(0, 2) || '??')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="layout-shell flex h-screen transition-colors duration-300 overflow-hidden">
            {/* Backdrop for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                className={cn(
                    'layout-sidebar border-r flex flex-col transition-all duration-300 ease-in-out z-40 lg:z-20 h-screen',
                    'lg:static fixed top-0 bottom-0 left-0',
                    isCollapsed ? 'lg:w-20' : 'lg:w-72',
                    isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0',
                )}
            >
                <div className="h-20 flex items-center px-6 border-b border-slate-200/70 dark:border-slate-700/60">
                    <div className="flex items-center gap-3 w-full">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-healthcare-primary/20 rounded-xl blur-lg group-hover:bg-healthcare-primary/30 transition-all duration-500" />
                            <img
                                src={logo}
                                alt="TangaCare"
                                className="h-10 w-10 relative z-10 rounded-xl shadow-sm transform group-hover:scale-105 transition-transform duration-300 object-cover bg-white"
                            />
                        </div>
                        {(!isCollapsed || isMobileMenuOpen) && (
                            <div className="flex flex-col">
                                <span className="font-black text-xl tracking-tight text-healthcare-dark dark:text-white font-display">
                                    Tanga<span className="text-healthcare-primary">Care</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                                    Pharmacy OS
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    <Link
                        to="/"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                            'flex items-center gap-3 px-4 py-2.5 w-full text-left text-healthcare-primary hover:bg-blue-50 rounded-xl transition-all group font-bold text-sm mb-4 border border-blue-100 shadow-sm',
                            isCollapsed && !isMobileMenuOpen && 'lg:justify-center lg:px-0',
                        )}
                    >
                        <ArrowLeft
                            size={18}
                            className="group-hover:-translate-x-1 transition-transform"
                        />
                        {(!isCollapsed || isMobileMenuOpen) && <span>Back to Website</span>}
                    </Link>

                    {filteredSections.map((section) => (
                        <div key={section.id} className="space-y-1.5">
                            {(!isCollapsed || isMobileMenuOpen) && (
                                <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {section.label}
                                </p>
                            )}
                            {section.items.map((item) => {
                                const flattenExpandedChildren =
                                    (!!item.children?.length &&
                                        item.label.trim().toLowerCase() ===
                                            section.label.trim().toLowerCase()) ||
                                    !!item.hideParentWhenExpanded;
                                return (
                                    <SidebarLink
                                        key={item.to}
                                        to={item.to}
                                        icon={<item.icon size={18} />}
                                        label={item.label}
                                        isCollapsed={isCollapsed && !isMobileMenuOpen}
                                        children={item.children}
                                        flattenExpandedChildren={flattenExpandedChildren}
                                        onNavigate={() => setIsMobileMenuOpen(false)}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="p-2 border-t border-slate-200/70 dark:border-slate-700/60">
                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            handleLogout();
                        }}
                        className={cn(
                            'flex items-center gap-3 px-4 py-2.5 w-full text-left text-healthcare-danger hover:bg-red-50 rounded-lg transition-all group font-bold text-sm',
                            isCollapsed && !isMobileMenuOpen && 'lg:justify-center lg:px-0',
                        )}
                    >
                        <LogOut
                            size={18}
                            className="group-hover:translate-x-0.5 transition-transform"
                        />
                        {(!isCollapsed || isMobileMenuOpen) && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className="layout-topbar px-3 md:px-5 py-3 flex items-center justify-between shadow-sm rounded-none">
                    <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0">
                        <button
                            onClick={() => {
                                if (window.innerWidth < 1024) {
                                    setIsMobileMenuOpen(!isMobileMenuOpen);
                                } else {
                                    setIsCollapsed(!isCollapsed);
                                }
                            }}
                            className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg text-white transition-colors border border-white/20 flex-shrink-0"
                        >
                            <span className="lg:block hidden">
                                {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                            </span>
                            <span className="lg:hidden block">
                                <Menu size={20} />
                            </span>
                        </button>

                        <div
                            ref={globalSearchRef}
                            className="relative max-w-sm lg:max-w-md w-full hidden sm:block"
                        >
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                                size={16}
                            />
                            <input
                                type="text"
                                placeholder="Search medicine, batch, supplier, PO, movement..."
                                value={globalSearchQuery}
                                onFocus={() => setGlobalSearchOpen(true)}
                                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' &&
                                        flattenedGlobalSearchResults.length > 0
                                    ) {
                                        event.preventDefault();
                                        handleGlobalSearchSelect(flattenedGlobalSearchResults[0]);
                                    }
                                    if (event.key === 'Escape') {
                                        setGlobalSearchOpen(false);
                                    }
                                }}
                                className="w-full pl-9 pr-4 py-1.5 bg-white/95 border border-white/20 focus:bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all text-sm text-slate-800 placeholder:text-slate-500"
                            />
                            {globalSearchOpen && globalSearchQuery.trim().length >= 2 && (
                                <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                    {globalSearchLoading ? (
                                        <div className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                            Searching...
                                        </div>
                                    ) : globalSearchResultCount === 0 ? (
                                        <div className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                            No results found
                                        </div>
                                    ) : (
                                        <div className="max-h-[360px] overflow-y-auto p-2">
                                            {GLOBAL_SEARCH_GROUPS.map((group) => {
                                                const items = globalSearchResults[group.key];
                                                if (!items || items.length === 0) return null;

                                                return (
                                                    <div key={group.key} className="mb-2 last:mb-0">
                                                        <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            {group.label}
                                                        </p>
                                                        <div className="space-y-1">
                                                            {items.map((item) => (
                                                                <button
                                                                    key={`${group.key}-${item.id}`}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleGlobalSearchSelect(
                                                                            item,
                                                                        )
                                                                    }
                                                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <p className="text-xs font-black text-healthcare-dark truncate">
                                                                        {item.label}
                                                                    </p>
                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                                                                        {item.meta}
                                                                    </p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 font-sans ml-2">
                        <div className="hidden xs:flex items-center">
                            {showFacilityNameOnly ? (
                                <div className="px-2 md:px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 min-w-0 max-w-[120px] md:max-w-[180px]">
                                    <span
                                        className="truncate block text-[10px] md:text-xs font-bold text-white"
                                        title={
                                            currentFacility?.name ??
                                            facilities[0]?.name ??
                                            user?.facility?.name ??
                                            'Facility'
                                        }
                                    >
                                        {currentFacility?.name ??
                                            facilities[0]?.name ??
                                            (user as any)?.facility?.name ??
                                            '—'}
                                    </span>
                                </div>
                            ) : (
                                showSwitcher && (
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setSwitcherOpen(!switcherOpen)}
                                            className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-left min-w-0 max-w-[120px] md:max-w-[180px]"
                                        >
                                            <Building2
                                                size={14}
                                                className="text-white flex-shrink-0 md:size-4"
                                            />
                                            <span className="truncate text-[10px] md:text-xs font-bold text-white">
                                                {facilityId == null
                                                    ? 'All Facilities'
                                                    : switcherLabel}
                                            </span>
                                            <ChevronDown
                                                size={12}
                                                className="flex-shrink-0 text-slate-400 md:size-3.5"
                                            />
                                        </button>
                                        {switcherOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setSwitcherOpen(false)}
                                                />
                                                <div className="absolute right-0 top-full mt-1 z-20 w-64 py-2 bg-white rounded-xl shadow-lg border border-slate-200">
                                                    {organizations.length > 1 && (
                                                        <div className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                            Organization
                                                        </div>
                                                    )}
                                                    {organizations.map((org) => (
                                                        <button
                                                            key={org.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const run = async () => {
                                                                    setSwitcherOpen(false);
                                                                    if (isSuperAdminUser) {
                                                                        try {
                                                                            // Issue a scoped JWT containing organizationId
                                                                            // so scopeMiddleware allows org-scoped admin pages.
                                                                            const result =
                                                                                await adminOrganizationsService.impersonateOrganization(org.id);

                                                                            const tokens = result?.tokens;
                                                                            const ctx = result?.context;

                                                                            if (tokens?.accessToken) {
                                                                                localStorage.setItem(
                                                                                    'access_token',
                                                                                    tokens.accessToken,
                                                                                );
                                                                            }
                                                                            if (tokens?.refreshToken) {
                                                                                localStorage.setItem(
                                                                                    'refresh_token',
                                                                                    tokens.refreshToken,
                                                                                );
                                                                            }

                                                                            setOrganization(ctx?.organizationId ?? org.id);
                                                                            if (ctx?.facilityId) {
                                                                                setFacility(ctx.facilityId);
                                                                            } else {
                                                                                setFacility(null);
                                                                            }
                                                                            await refreshProfile();
                                                                        } catch (e) {
                                                                            console.error('Impersonation failed:', e);
                                                                            toast.error('Failed to switch organization context for Super Admin');
                                                                        }
                                                                        return;
                                                                    }

                                                                    setOrganization(org.id);
                                                                    refreshProfile();
                                                                };

                                                                void run();
                                                            }}
                                                            className={`w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-100 ${organizationId === org.id ? 'text-healthcare-primary bg-blue-50' : 'text-slate-700'}`}
                                                        >
                                                            {org.name} {org.code && `(${org.code})`}
                                                        </button>
                                                    ))}
                                                    {facilities.length > 0 && (
                                                        <div className="px-3 py-1.5 mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-t border-slate-200">
                                                            Facility
                                                        </div>
                                                    )}
                                                    {showAllFacilitiesOption && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFacility(null);
                                                                setSwitcherOpen(false);
                                                                refreshProfile();
                                                            }}
                                                            className={`w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-100 ${facilityId == null ? 'text-healthcare-primary bg-blue-50' : 'text-slate-700'}`}
                                                        >
                                                            🌐 All Facilities{' '}
                                                            {isSuperAdminUser && '(System-Wide)'}
                                                        </button>
                                                    )}
                                                    {facilities.map((fac) => (
                                                        <button
                                                            key={fac.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setFacility(fac.id);
                                                                setSwitcherOpen(false);
                                                                refreshProfile();
                                                            }}
                                                            className={`w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-100 ${facilityId === fac.id ? 'text-healthcare-primary bg-blue-50' : 'text-slate-700'}`}
                                                        >
                                                            {fac.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )
                            )}
                        </div>

                        <div className="flex items-center gap-1 md:gap-1.5">
                            <NotificationBell />

                            <button
                                onClick={toggleTheme}
                                className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
                            >
                                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-3 border-l border-white/25">
                            <div className="group flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-2.5 py-1.5 hover:bg-white/15 transition-colors max-w-[220px]">
                                <div className="relative shrink-0">
                                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                        {profileInitials}
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-white/80" />
                                </div>
                                <div className="hidden sm:flex flex-col min-w-0">
                                    <span className="font-semibold text-white text-xs tracking-tight truncate">
                                        {profileName}
                                    </span>
                                    <span className="text-[10px] text-blue-100/95 font-medium truncate">
                                        {profileRoleLabel}
                                    </span>
                                </div>
                                <ChevronDown
                                    size={14}
                                    className="hidden sm:block text-blue-100/90 group-hover:text-white transition-colors shrink-0"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="layout-content-panel flex-1 overflow-auto min-w-0">
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
                        {isLoading ? (
                            <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-6">
                                <RouteContentFallback />
                            </div>
                        ) : needsOnboarding && !window.location.pathname.includes('/onboarding') ? (
                            <>
                                <FacilityEmptyState
                                    onCreateClick={() => setShowSetupModal(true)}
                                    onJoinClick={() => setShowJoinModal(true)}
                                    noOrganization
                                />
                                {showSetupModal && (
                                    <SetupPharmacyModal
                                        onSuccess={() => {
                                            setShowSetupModal(false);
                                            refreshProfile();
                                        }}
                                        onClose={() => setShowSetupModal(false)}
                                    />
                                )}
                                <JoinOrganizationModal
                                    isOpen={showJoinModal}
                                    onClose={() => setShowJoinModal(false)}
                                />
                            </>
                        ) : isUnassignedAdmin &&
                          !window.location.pathname.includes('/onboarding') ? (
                            <>
                                <FacilityEmptyState
                                    onCreateClick={() => setShowCreateModal(true)}
                                    onJoinClick={() => setShowJoinModal(true)}
                                />
                                {showCreateModal && (
                                    <CreateFacilityModal
                                        onClose={() => setShowCreateModal(false)}
                                    />
                                )}
                                <JoinOrganizationModal
                                    isOpen={showJoinModal}
                                    onClose={() => setShowJoinModal(false)}
                                />
                            </>
                        ) : (
                            <Outlet key={facilityId ?? 'all'} />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
