import api from '../lib/api';
import type {
    Medicine,
    CreateMedicineDto,
    PaginatedResponse,
    MedicineCategory,
} from '../types/pharmacy';
import { normalizePaginatedResponse } from './utils';

export const medicineService = {
    async getMedicines(params?: {
        page?: number;
        limit?: number;
        search?: string;
        facility_id?: number;
        start_date?: string;
        end_date?: string;
        sort_by?: string;
        min_stock?: number;
        category?: string;
        low_stock_only?: boolean;
        expiring_soon?: boolean;
        controlled_only?: boolean;
        supplier_name?: string;
    }): Promise<PaginatedResponse<Medicine>> {
        const response = await api.get<any>('/pharmacy/medicines', { params });
        return normalizePaginatedResponse<Medicine>(response.data);
    },

    async getMedicine(id: number): Promise<Medicine> {
        const response = await api.get<{ data: Medicine }>(`/pharmacy/medicines/${id}`);
        return response.data.data;
    },

    async createMedicine(data: CreateMedicineDto): Promise<Medicine> {
        const response = await api.post<{ data: Medicine }>('/pharmacy/medicines', data);
        return response.data.data;
    },

    async updateMedicine(id: number, data: Partial<Medicine>): Promise<Medicine> {
        const response = await api.put<{ data: Medicine }>(`/pharmacy/medicines/${id}`, data);
        return response.data.data;
    },

    async downloadMedicineTemplate(): Promise<Blob> {
        const response = await api.get('/pharmacy/medicines/template/download', {
            responseType: 'blob',
        });
        return response.data;
    },

    async importMedicines(
        file: File,
    ): Promise<{ imported: number; updated: number; errors: string[] }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<any>('/pharmacy/medicines/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return (response.data as any).data ?? response.data;
    },

    async validateMedicineImport(
        file: File,
    ): Promise<{ items: any[]; errors: string[]; total: number }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<any>('/pharmacy/medicines/import/validate', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return (response.data as any).data ?? response.data;
    },

    async getMedicineStatistics(): Promise<{
        totalItems: number;
        totalCategories: number;
        lowStock: number;
        expired: number;
    }> {
        const response = await api.get<any>('/pharmacy/medicines/statistics');
        return (response.data as any).data ?? response.data;
    },

    async exportMedicines(): Promise<void> {
        const response = await api.get('/pharmacy/medicines/export', {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute(
            'download',
            `medicine_inventory_${new Date().toISOString().split('T')[0]}.xlsx`,
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    async getCategories(): Promise<MedicineCategory[]> {
        const response = await api.get<any>('/pharmacy/categories');
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    async createCategory(data: {
        name: string;
        code: string;
        default_markup_percent?: number;
    }): Promise<MedicineCategory> {
        const response = await api.post<any>('/pharmacy/categories', data);
        return (response.data as any).data ?? response.data;
    },

    async updateCategory(id: number, data: Partial<MedicineCategory>): Promise<MedicineCategory> {
        const response = await api.patch<any>(`/pharmacy/categories/${id}`, data);
        return (response.data as any).data ?? response.data;
    },

    async deleteCategory(id: number): Promise<void> {
        await api.delete(`/pharmacy/categories/${id}`);
    },
};
