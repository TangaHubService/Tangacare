import api from '../lib/api';
import type { User } from '../types/auth';
import type { PaginatedResponse } from '../types/pharmacy';

const normalizePaginatedResponse = <T>(body: any): PaginatedResponse<T> => {
    const result: PaginatedResponse<T> = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
    };

    if (!body) return result;

    if (Array.isArray(body.data) && body.meta) {
        return body as PaginatedResponse<T>;
    }

    let payload = body.success && body.data ? body.data : body;

    if (Array.isArray(payload.data)) {
        result.data = payload.data;
    } else if (Array.isArray(payload)) {
        result.data = payload;
    }

    result.meta.total = typeof payload.total === 'number' ? payload.total : result.data.length;
    result.meta.page = typeof payload.page === 'number' ? payload.page : 1;
    result.meta.limit = typeof payload.limit === 'number' ? payload.limit : 10;
    result.meta.totalPages =
        typeof payload.totalPages === 'number'
            ? payload.totalPages
            : Math.ceil(result.meta.total / result.meta.limit) || 1;

    return result;
};

export const STAFF_ROLES = [
    'facility_admin',
    'pharmacist',
    'store_manager',
    'auditor',
    'cashier',
] as const;

export type CreateStaffPayload = {
    email: string;
    first_name: string;
    last_name: string;

    password?: string;
    role: (typeof STAFF_ROLES)[number];
    facility_id?: number;
};

export const userService = {
    async createUser(data: CreateStaffPayload): Promise<User> {
        const response = await api.post<{ data: User }>('/users', data);
        return response.data.data;
    },

    async getUsers(params?: {
        page?: number;
        limit?: number;
        role?: string;
        search?: string;
        facility_id?: number;
        status?: 'active' | 'inactive';
    }): Promise<PaginatedResponse<User>> {
        const response = await api.get<any>('/users', { params });
        return normalizePaginatedResponse<User>(response.data);
    },

    async getUser(id: number): Promise<User> {
        const response = await api.get<{ data: User }>(`/users/${id}`);
        return response.data.data;
    },

    async updateUser(id: number, data: Partial<User>): Promise<User> {
        const response = await api.put<{ data: User }>(`/users/${id}`, data);
        return response.data.data;
    },

    async deleteUser(id: number): Promise<void> {
        await api.delete(`/users/${id}`);
    },
};
