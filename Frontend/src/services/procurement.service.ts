import api from '../lib/api';
import type { ProcurementOrder, PaginatedResponse } from '../types/pharmacy';
import { normalizePaginatedResponse } from './utils';

export const procurementService = {
    async getProcurementOrders(params?: {
        facility_id?: number;
        status?: string;
        search?: string;
        start_date?: string;
        end_date?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<ProcurementOrder>> {
        const response = await api.get<any>('/pharmacy/procurement', { params });
        return normalizePaginatedResponse<ProcurementOrder>(response.data);
    },

    async createProcurementOrder(data: any): Promise<ProcurementOrder> {
        const response = await api.post<{ data: ProcurementOrder }>('/pharmacy/procurement', data);
        return response.data.data;
    },

    async getProcurementOrder(id: number): Promise<ProcurementOrder> {
        const response = await api.get<{ data: ProcurementOrder }>(`/pharmacy/procurement/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async updateProcurementOrder(id: number, data: any): Promise<ProcurementOrder> {
        const response = await api.put<{ data: ProcurementOrder }>(
            `/pharmacy/procurement/${id}`,
            data,
        );
        return response.data.data;
    },

    async receiveProcurementOrder(
        id: number,
        data: {
            received_items: Array<any & { selling_price?: number }>;
            received_date: string;
            notes?: string;
        },
    ): Promise<ProcurementOrder & { skippedItems?: any[] }> {
        const response = await api.post<any>(`/pharmacy/procurement/${id}/receive`, data);

        const result = response.data.data;
        if (result && result.order) {
            return { ...result.order, skippedItems: result.skippedItems };
        }
        return result;
    },

    async downloadProcurementTemplate(): Promise<Blob> {
        const response = await api.get('/pharmacy/procurement/template', {
            responseType: 'blob',
        });
        return response.data;
    },

    async importProcurementExcel(supplierId: number, file: File): Promise<ProcurementOrder> {
        const formData = new FormData();
        formData.append('supplier_id', supplierId.toString());
        formData.append('file', file);
        const response = await api.post<any>('/pharmacy/procurement/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return (response.data as any).data ?? response.data;
    },

    async validateProcurementImport(file: File): Promise<{ items: any[]; total_amount: number }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<any>('/pharmacy/procurement/import/validate', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return (response.data as any).data ?? response.data;
    },

    async submitProcurementOrder(id: number): Promise<ProcurementOrder> {
        const response = await api.post<any>(`/pharmacy/procurement/${id}/submit`);
        return (response.data as any).data ?? response.data;
    },

    async approveProcurementOrder(id: number): Promise<ProcurementOrder> {
        const response = await api.post<any>(`/pharmacy/procurement/${id}/approve`);
        return (response.data as any).data ?? response.data;
    },

    async cancelProcurementOrder(id: number): Promise<ProcurementOrder> {
        const response = await api.post<any>(`/pharmacy/procurement/${id}/cancel`);
        return (response.data as any).data ?? response.data;
    },

    async exportProcurementOrder(id: number): Promise<void> {
        const response = await api.get(`/pharmacy/procurement/${id}/export`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `PO_${id}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    async quoteProcurementOrder(id: number, items: any[]): Promise<ProcurementOrder> {
        const response = await api.patch<{ data: ProcurementOrder }>(
            `/pharmacy/procurement/${id}/quote`,
            { items },
        );
        return response.data.data;
    },

    async reviewQuotation(id: number, items: any[]): Promise<ProcurementOrder> {
        const response = await api.patch<{ data: ProcurementOrder }>(
            `/pharmacy/procurement/${id}/review`,
            { items },
        );
        return response.data.data;
    },

    async getPriceSuggestions(supplierId: number, medicineId: number): Promise<any> {
        const response = await api.get('/pharmacy/procurement/price-suggestions', {
            params: { supplier_id: supplierId, medicine_id: medicineId },
        });
        return response.data.data;
    },
};
