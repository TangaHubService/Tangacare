export const UserRole = {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    ADMIN: 'admin',

    SUPER_ADMIN: 'super_admin',
    FACILITY_ADMIN: 'facility_admin',
    OWNER: 'owner',
    CASHIER: 'cashier',
    PHARMACIST: 'pharmacist',
    STORE_MANAGER: 'store_manager',
    AUDITOR: 'auditor',
    USER: 'user',
} as const;

export const SUPER_ADMIN_ROLE = 'super_admin';

export function isSuperAdmin(role?: string): boolean {
    if (!role || typeof role !== 'string') return false;
    const normalized = role.toLowerCase().replace(/[\s_]+/g, '_');
    return normalized === 'super_admin';
}

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface Organization {
    id: number;
    name: string;
    code?: string;
    type?: string;
}

export type Permission = string;

export const PERMISSIONS = {
    INVENTORY_READ: 'inventory:read',
    INVENTORY_WRITE: 'inventory:write',
    DISPENSING_READ: 'dispensing:read',
    DISPENSING_WRITE: 'dispensing:write',
    PROCUREMENT_READ: 'procurement:read',
    PROCUREMENT_WRITE: 'procurement:write',
    REPORTS_READ: 'reports:read',
    REPORTS_FINANCIAL: 'reports:financial',
    FACILITY_MANAGE: 'facility:manage',
    ORGANIZATION_MANAGE: 'organization:manage',
    PRICING_MANAGE: 'pricing:manage',
    AUDIT_READ: 'audit:read',
    STOCK_MOVEMENTS_READ: 'stock_movements:read',
    USERS_MANAGE: 'users:manage',
    SUPPLIERS_READ: 'suppliers:read',
    SUPPLIERS_WRITE: 'suppliers:write',
    ALERTS_READ: 'alerts:read',
    ALERTS_WRITE: 'alerts:write',
    USERS_READ: 'users:read',
    FACILITY_READ: 'facility:read',
    PRICING_READ: 'pricing:read',
    PATIENTS_READ: 'patients:read',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export interface User {
    id: number;
    userId?: string;
    phone_number?: string;
    phoneNumber?: string;
    email: string;
    first_name?: string;
    firstName?: string;
    last_name?: string;
    lastName?: string;
    role: UserRole;
    user_role?: UserRole;
    permissions?: Permission[];
    gender?: 'male' | 'female' | 'other';
    date_of_birth?: string;
    address?: string;
    avatar_url?: string;
    is_active?: boolean;
    isActive?: boolean;
    created_at?: string;
    updated_at?: string;
    organization_id?: number;
    facility_id?: number;
    facility?: {
        id: number;
        name: string;
        type: string;
    };
    organizations?: Organization[];
    facilities?: Array<{ id: number; name: string; type?: string; organization_id?: number }>;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse {
    status: string;
    message: string;
    data: {
        user: User;
        tokens: AuthTokens;
    };
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    role?: UserRole;
    gender?: string;
    date_of_birth?: string;
}
