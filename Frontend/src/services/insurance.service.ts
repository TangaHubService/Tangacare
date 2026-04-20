import api from '../lib/api';
import type { InsuranceProvider, InsuranceClaim, InsuranceDashboardSummary } from '../types/pharmacy';

export const insuranceService = {
    async getInsuranceProviders(): Promise<InsuranceProvider[]> {
        const response = await api.get<any>('/pharmacy/insurance/providers');
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    async createInsuranceProvider(data: Partial<InsuranceProvider>): Promise<InsuranceProvider> {
        const response = await api.post<any>('/pharmacy/insurance/providers', data);
        return (response.data as any).data ?? response.data;
    },

    async updateInsuranceProvider(
        id: number,
        data: Partial<InsuranceProvider>,
    ): Promise<InsuranceProvider> {
        const response = await api.put<any>(`/pharmacy/insurance/providers/${id}`, data);
        return (response.data as any).data ?? response.data;
    },

    async getInsuranceClaims(params?: {
        status?: string;
        provider_id?: number;
        facility_id?: number;
        start_date?: string;
        end_date?: string;
    }): Promise<InsuranceClaim[]> {
        const response = await api.get<any>('/pharmacy/insurance/claims', { params });
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    async updateInsuranceClaim(id: number, data: Partial<InsuranceClaim>): Promise<InsuranceClaim> {
        const response = await api.put<any>(`/pharmacy/insurance/claims/${id}`, data);
        return (response.data as any).data ?? response.data;
    },

    async createInsuranceClaim(data: Partial<InsuranceClaim>): Promise<InsuranceClaim> {
        const response = await api.post<any>('/pharmacy/insurance/claims', data);
        return (response.data as any).data ?? response.data;
    },

    async getInsuranceSummary(params: { start_date: string; end_date: string }): Promise<InsuranceDashboardSummary> {
        const response = await api.get<any>('/pharmacy/insurance/summary', { params });
        return (response.data as any).data ?? response.data;
    },
};
