import api from '../lib/api';
import type { PaginatedResponse } from '../types/pharmacy';
import type { User } from '../types/auth';
import { normalizePaginatedResponse } from './utils';

export const patientService = {
    async getPatients(params?: {
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<User>> {
        const response = await api.get('/users', {
            params: {
                role: 'patient',
                ...params,
            },
        });
        return normalizePaginatedResponse<User>(response.data);
    },

    async updatePatient(id: number, data: any): Promise<User> {
        const response = await api.put<{ data: User }>(`/users/${id}`, data);
        return (response.data as any).data ?? response.data;
    },
};
