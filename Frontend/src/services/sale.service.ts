import api from '../lib/api';
import type { AxiosRequestConfig } from 'axios';
import type { Sale, CreateSaleDto, CreateSaleResult, PaginatedResponse } from '../types/pharmacy';
import { normalizePaginatedResponse } from './utils';

export const saleService = {
    async createSale(payload: CreateSaleDto, config?: AxiosRequestConfig): Promise<CreateSaleResult> {
        const response = await api.post<any>('/pharmacy/sales', payload, config);
        const body = response.data as {
            success?: boolean;
            data?: Sale;
            warnings?: string[];
            message?: string;
        };
        const sale = (body?.data ?? response.data) as Sale;
        const warnings = Array.isArray(body?.warnings) ? body.warnings : [];
        return { sale, warnings };
    },

    async getSale(id: number): Promise<Sale> {
        const response = await api.get<any>(`/pharmacy/sales/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async getSales(params?: {
        page?: number;
        limit?: number;
        patient_id?: number;
        search?: string;
    }): Promise<PaginatedResponse<Sale>> {
        const response = await api.get<any>('/pharmacy/sales', { params });
        return normalizePaginatedResponse<Sale>(response.data);
    },

    async getSaleReceipt(id: number, facilityId: number): Promise<void> {
        const response = await api.get(`/pharmacy/sales/${id}/receipt`, {
            params: { facilityId },
            responseType: 'blob',
        });

        const data = response.data as Blob;
        if (!data || !(data instanceof Blob)) {
            throw new Error('Invalid receipt response');
        }
        if (data.type === 'application/json' || data.size < 100) {
            const text = await data.text();
            let message = 'Failed to download receipt';
            try {
                const json = JSON.parse(text);
                message = json?.message || json?.error || message;
            } catch {
                if (text) message = text;
            }
            throw new Error(message);
        }

        const blob = new Blob([data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt_SALE-${String(id).padStart(6, '0')}.pdf`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    async downloadReceipt(saleId: number): Promise<void> {
        const response = await api.get(`/pharmacy/sales/${saleId}/receipt`, {
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `receipt_${saleId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    async getPatientSales(patientId: number, limit = 3): Promise<Sale[]> {
        const response = await api.get<any>('/pharmacy/sales', {
            params: { patient_id: patientId, limit },
        });
        const payload = (response.data as any).data ?? response.data;
        const items = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];
        return items.slice(0, limit) as Sale[];
    },

    async getSubstitutionRecommendations(
        medicineId: number,
        facilityId?: number,
    ): Promise<
        Array<{
            id: number;
            name: string;
            selling_price: number;
            total_stock: number;
            reason: string;
        }>
    > {
        const response = await api.get<any>(`/pharmacy/dispensing/substitutions/${medicineId}`, {
            params: facilityId ? { facilityId } : undefined,
        });
        const payload = (response.data as any).data ?? response.data;
        const alternatives = Array.isArray(payload?.alternatives)
            ? payload.alternatives
            : Array.isArray(payload)
              ? payload
              : [];

        return alternatives.map((item: any) => ({
            id: Number(item?.id ?? item?.medicine_id ?? 0),
            name: String(item?.name ?? item?.medicine_name ?? 'Unknown'),
            selling_price: Number(item?.selling_price ?? 0),
            total_stock: Number(item?.total_stock ?? 0),
            reason: String(item?.reason ?? 'Same therapeutic category with available stock'),
        }));
    },

    async getFacilityMedicinePrice(medicineId: number): Promise<number | null> {
        try {
            const response = await api.get<any>(
                `/pharmacy/facility-settings/medicine/${medicineId}/price`,
            );
            const payload = (response.data as any).data ?? response.data;
            return typeof payload?.selling_price === 'number' ? payload.selling_price : null;
        } catch {
            return null;
        }
    },

    // Return Management
    async getReturns(params?: {
        facility_id?: number;
        status?: any;
        sale_number?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<any>> {
        const response = await api.get<any>('/pharmacy/returns', { params });
        return normalizePaginatedResponse<any>(response.data);
    },

    async getReturn(id: number): Promise<any> {
        const response = await api.get<any>(`/pharmacy/returns/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async createReturn(payload: any): Promise<any> {
        const response = await api.post<any>('/pharmacy/returns', payload);
        return (response.data as any).data ?? response.data;
    },

    async approveReturn(id: number): Promise<any> {
        const response = await api.post<any>(`/pharmacy/returns/${id}/approve`);
        return (response.data as any).data ?? response.data;
    },

    async rejectReturn(id: number, reason: string): Promise<any> {
        const response = await api.post<any>(`/pharmacy/returns/${id}/reject`, { reason });
        return (response.data as any).data ?? response.data;
    },

    async processRefund(id: number): Promise<any> {
        const response = await api.post<any>(`/pharmacy/returns/${id}/process-refund`);
        return (response.data as any).data ?? response.data;
    },
};
