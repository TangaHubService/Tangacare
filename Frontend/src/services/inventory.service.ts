import api from '../lib/api';
import type {
    Batch,
    Stock,
    Supplier,
    PaginatedResponse,
    PhysicalCount,
    PhysicalCountItem,
    VarianceStatus,
    VarianceType,
    StockVariance,
} from '../types/pharmacy';
import { normalizePaginatedResponse } from './utils';

export const inventoryService = {
    async getBatches(params?: { medicine_id?: number; facility_id?: number }): Promise<Batch[]> {
        const response = await api.get<{ data: Batch[] }>('/pharmacy/batches', { params });
        return response.data.data;
    },

    async getStock(params?: {
        facility_id?: number;
        medicine_id?: number;
        page?: number;
        limit?: number;
        low_stock_only?: boolean;
    }): Promise<PaginatedResponse<Stock>> {
        const response = await api.get<any>('/pharmacy/stock', { params });
        return normalizePaginatedResponse<Stock>(response.data);
    },

    async getSuppliers(params?: {
        page?: number;
        limit?: number;
        search?: string;
        is_active?: boolean;
    }): Promise<PaginatedResponse<Supplier>> {
        const response = await api.get<any>('/pharmacy/suppliers', { params });
        return normalizePaginatedResponse<Supplier>(response.data);
    },

    async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
        const response = await api.post<{ data: Supplier }>('/pharmacy/suppliers', data);
        return response.data.data;
    },

    async updateSupplier(id: number, data: Partial<Supplier>): Promise<Supplier> {
        const response = await api.put<{ data: Supplier }>(`/pharmacy/suppliers/${id}`, data);
        return response.data.data;
    },

    async deleteSupplier(id: number): Promise<void> {
        await api.delete(`/pharmacy/suppliers/${id}`);
    },

    async transferStock(data: {
        facility_id: number;
        medicine_id: number;
        batch_id: number;
        source_department_id: number | null;
        target_department_id: number;
        source_location_id?: number | null;
        target_location_id?: number | null;
        quantity: number;
        notes?: string;
    }): Promise<any> {
        const response = await api.post('/pharmacy/stock/transfer', data);
        return response.data;
    },

    async adjustStock(data: {
        facility_id: number;
        batch_id: number;
        type: 'increase' | 'decrease' | 'damage' | 'expired' | 'return';
        quantity: number;
        reason:
            | 'physical_count'
            | 'damage'
            | 'expiry'
            | 'theft'
            | 'loss'
            | 'found'
            | 'correction'
            | 'transfer'
            | 'return_to_supplier'
            | 'customer_return'
            | 'sample'
            | 'donation'
            | 'other';
        notes?: string;
    }): Promise<any> {
        const response = await api.post('/pharmacy/stock/adjust', data);
        return response.data;
    },

    async startPhysicalCount(facilityId: number, medicineIds?: number[]): Promise<PhysicalCount> {
        const response = await api.post<any>('/pharmacy/physical-counts/start', {
            facility_id: facilityId,
            medicineIds,
        });
        return (response.data as any).data ?? response.data;
    },

    async getPhysicalCounts(facilityId: number): Promise<PhysicalCount[]> {
        const response = await api.get<any>('/pharmacy/physical-counts', {
            params: { facility_id: facilityId },
        });
        return (response.data as any).data ?? response.data;
    },

    async getPhysicalCount(countId: number): Promise<PhysicalCount> {
        const response = await api.get<any>(`/pharmacy/physical-counts/${countId}`);
        return (response.data as any).data ?? response.data;
    },

    async updatePhysicalCountItem(
        itemId: number,
        countedQuantity: number,
        notes?: string,
    ): Promise<PhysicalCountItem> {
        const response = await api.put<any>(`/pharmacy/physical-counts/items/${itemId}`, {
            countedQuantity,
            notes,
        });
        return (response.data as any).data ?? response.data;
    },

    async approvePhysicalCount(countId: number): Promise<PhysicalCount> {
        const response = await api.post<any>(`/pharmacy/physical-counts/${countId}/approve`);
        return (response.data as any).data ?? response.data;
    },

    async manualStockEntry(data: {
        facility_id: number;
        medicine_id: number;
        batches: Array<{
            batch_number: string;
            expiry_date: string;
            manufacturing_date?: string;
            quantity: number;
            unit_cost?: number;
        }>;
        storage_location_id?: number | null;
    }): Promise<any> {
        const response = await api.post('/pharmacy/stock/add-batches', data);
        return response.data;
    },

    async downloadStockTemplate(facilityId?: number): Promise<Blob> {
        const response = await api.get('/pharmacy/stock/template/download', {
            params: { facility_id: facilityId },
            responseType: 'blob',
        });
        return response.data;
    },

    async importStockBatches(
        file: File,
        facilityId: number,
    ): Promise<{ imported: number; errors: string[] }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('facility_id', facilityId.toString());
        const response = await api.post<any>('/pharmacy/stock/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return (response.data as any).data ?? response.data;
    },

    async getVariances(params?: {
        facility_id?: number;
        status?: VarianceStatus;
        type?: VarianceType;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<StockVariance>> {
        const response = await api.get<any>('/pharmacy/variances', { params });
        return normalizePaginatedResponse<StockVariance>(response.data);
    },

    async approveVariance(id: number): Promise<StockVariance> {
        const response = await api.post<any>(`/pharmacy/variances/${id}/approve`);
        return (response.data as any).data ?? response.data;
    },

    async rejectVariance(id: number, reason: string): Promise<StockVariance> {
        const response = await api.post<any>(`/pharmacy/variances/${id}/reject`, { reason });
        return (response.data as any).data ?? response.data;
    },

    async getRecalls(params?: {
        facility_id?: number;
        status?: any;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<any>> {
        const response = await api.get<any>('/pharmacy/recalls', { params });
        return normalizePaginatedResponse<any>(response.data);
    },

    async initiateRecall(data: {
        batch_id: number;
        reason: any;
        description: string;
    }): Promise<any> {
        const response = await api.post<any>('/pharmacy/recalls', data);
        return (response.data as any).data ?? response.data;
    },

    async getRecall(id: number): Promise<any> {
        const response = await api.get<any>(`/pharmacy/recalls/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async downloadRecallNotice(id: number): Promise<void> {
        const response = await api.get(`/pharmacy/recalls/${id}/notice`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Recall_Notice_${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },
};
