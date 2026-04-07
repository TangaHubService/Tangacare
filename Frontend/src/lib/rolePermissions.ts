/**
 * Default permissions per role — keep in sync with tangacare-backend/src/config/permissions.ts
 * Used when API user payload omits `permissions` (e.g. cached localStorage).
 */
import type { User } from '../types/auth';

const ROLE_DEFAULT_PERMISSIONS: Record<string, readonly string[]> = {
    user: [],
    patient: [],
    doctor: ['inventory:read', 'dispensing:read', 'patients:read'],
    admin: [
        'inventory:read',
        'inventory:write',
        'dispensing:read',
        'dispensing:write',
        'procurement:read',
        'procurement:write',
        'reports:read',
        'reports:financial',
        'audit:read',
        'stock_movements:read',
        'pricing:manage',
        'suppliers:read',
        'suppliers:write',
        'alerts:read',
        'alerts:write',
        'patients:read',
    ],
    super_admin: [
        'inventory:read',
        'inventory:write',
        'dispensing:read',
        'dispensing:write',
        'procurement:read',
        'procurement:write',
        'reports:read',
        'reports:financial',
        'facility:manage',
        'organization:manage',
        'pricing:manage',
        'audit:read',
        'stock_movements:read',
        'users:manage',
        'suppliers:read',
        'suppliers:write',
        'alerts:read',
        'alerts:write',
        'patients:read',
    ],
    facility_admin: [
        'inventory:read',
        'inventory:write',
        'dispensing:read',
        'dispensing:write',
        'procurement:read',
        'procurement:write',
        'reports:read',
        'reports:financial',
        'facility:manage',
        'pricing:manage',
        'audit:read',
        'stock_movements:read',
        'users:manage',
        'suppliers:read',
        'suppliers:write',
        'alerts:read',
        'alerts:write',
        'patients:read',
    ],
    owner: [
        'inventory:read',
        'inventory:write',
        'dispensing:read',
        'dispensing:write',
        'procurement:read',
        'procurement:write',
        'reports:read',
        'reports:financial',
        'facility:manage',
        'pricing:manage',
        'audit:read',
        'stock_movements:read',
        'users:manage',
        'suppliers:read',
        'suppliers:write',
        'alerts:read',
        'alerts:write',
        'patients:read',
    ],
    cashier: [
        'inventory:read',
        'dispensing:read',
        'dispensing:write',
        'reports:read',
        'patients:read',
    ],
    pharmacist: [
        'inventory:read',
        'inventory:write',
        'dispensing:read',
        'dispensing:write',
        'reports:read',
        'audit:read',
        'stock_movements:read',
        'patients:read',
    ],
    technician: [
        'inventory:read',
        'dispensing:read',
        'dispensing:write',
        'stock_movements:read',
        'patients:read',
    ],
    store_manager: [
        'inventory:read',
        'inventory:write',
        'procurement:read',
        'procurement:write',
        'reports:read',
        'audit:read',
        'stock_movements:read',
        'suppliers:read',
        'suppliers:write',
        'alerts:read',
        'alerts:write',
        'patients:read',
    ],
    store_keeper: [
        'inventory:read',
        'inventory:write',
        'procurement:read',
        'procurement:write',
        'stock_movements:read',
        'suppliers:read',
        'alerts:read',
    ],
    auditor: [
        'inventory:read',
        'dispensing:read',
        'procurement:read',
        'reports:read',
        'reports:financial',
        'audit:read',
        'stock_movements:read',
        'users:read',
        'facility:read',
        'pricing:read',
        'alerts:read',
        'patients:read',
    ],
};

function normalizeRoleKey(role?: string | null): string {
    if (!role || typeof role !== 'string') return '';
    return role.toLowerCase().replace(/[\s-]+/g, '_');
}

export function getDefaultPermissionsForRole(role?: string | null): string[] {
    const key = normalizeRoleKey(role);
    const list = ROLE_DEFAULT_PERMISSIONS[key];
    return list ? [...list] : [];
}

/** Effective permission list: JWT/profile array when present, otherwise role defaults. */
export function getEffectivePermissions(user: User | null | undefined): string[] {
    if (!user) return [];
    const fromApi = user.permissions;
    if (Array.isArray(fromApi) && fromApi.length > 0) {
        return fromApi;
    }
    return getDefaultPermissionsForRole(user.role ?? user.user_role);
}

export function userHasPermission(user: User | null | undefined, permission: string): boolean {
    if (!user) return false;
    return getEffectivePermissions(user).includes(permission);
}
