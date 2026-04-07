import api from '../lib/api';
import type {
    Facility,
    Organization,
    CreateOrganizationDto,
    CreateOnboardingSetupDto,
    Department,
    StorageLocation,
    CreateStorageLocationDto,
    ColdChainOverview,
    ColdChainTelemetry,
    ColdChainExcursion,
    ColdChainExcursionStatus,
    PaginatedResponse,
} from '../types/pharmacy';
import { normalizePaginatedResponse } from './utils';

export const facilityService = {
    async getOrganizations(params?: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<PaginatedResponse<Organization>> {
        const response = await api.get<any>('/pharmacy/organizations', { params });
        return normalizePaginatedResponse<Organization>(response.data);
    },

    async getOrganization(id: number): Promise<Organization> {
        const response = await api.get<{ data: Organization }>(`/pharmacy/organizations/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async createOrganization(data: CreateOrganizationDto): Promise<Organization> {
        const response = await api.post<any>('/pharmacy/organizations', data);
        return (response.data as any).data ?? response.data;
    },

    async updateOrganization(id: number, data: Partial<Organization>): Promise<Organization> {
        const response = await api.put<any>(`/pharmacy/organizations/${id}`, data);
        return (response.data as any).data ?? response.data;
    },

    async deleteOrganization(id: number): Promise<void> {
        await api.delete(`/pharmacy/organizations/${id}`);
    },

    async createOnboardingOrganization(data: {
        organization_name: string;
        legal_name?: string;
        registration_number?: string;
        medical_license?: string;
        city?: string;
        country?: string;
    }): Promise<{ organization: Organization }> {
        const response = await api.post<any>('/pharmacy/onboarding/organization', data);
        return (response.data as any).data ?? response.data;
    },

    async setupOnboarding(
        data: CreateOnboardingSetupDto,
    ): Promise<{ organization: Organization; facility: Facility }> {
        const response = await api.post<any>('/pharmacy/onboarding/setup', data);
        return (response.data as any).data ?? response.data;
    },

    async getFacilities(params?: {
        page?: number;
        limit?: number;
        search?: string;
        organization_id?: number;
    }): Promise<PaginatedResponse<Facility>> {
        const response = await api.get<any>('/pharmacy/facilities', { params });
        return normalizePaginatedResponse<Facility>(response.data);
    },

    async getFacility(id: number): Promise<Facility> {
        const response = await api.get<{ data: Facility }>(`/pharmacy/facilities/${id}`);
        return response.data.data;
    },

    async createFacility(data: any): Promise<Facility> {
        const response = await api.post<{ data: Facility }>('/pharmacy/facilities', data);
        return response.data.data;
    },

    async updateFacility(id: number, data: Partial<Facility>): Promise<Facility> {
        const response = await api.put<{ data: Facility }>(`/pharmacy/facilities/${id}`, data);
        return response.data.data;
    },

    async deleteFacility(id: number): Promise<void> {
        await api.delete(`/pharmacy/facilities/${id}`);
    },

    async getDepartments(params?: { facility_id: number }): Promise<Department[]> {
        const response = await api.get<any>('/pharmacy/departments', { params });
        const payload = response.data?.data;

        if (payload && Array.isArray(payload.data)) {
            return payload.data;
        }
        return Array.isArray(payload) ? payload : [];
    },

    async createDepartment(data: Partial<Department>): Promise<Department> {
        const response = await api.post<{ data: Department }>('/pharmacy/departments', data);
        return response.data.data;
    },

    async updateDepartment(id: number, data: Partial<Department>): Promise<Department> {
        const response = await api.put<{ data: Department }>(`/pharmacy/departments/${id}`, data);
        return response.data.data;
    },

    async deleteDepartment(id: number): Promise<void> {
        await api.delete(`/pharmacy/departments/${id}`);
    },

    async getStorageLocations(params?: { facility_id?: number }): Promise<StorageLocation[]> {
        const response = await api.get<any>('/pharmacy/storage-locations', { params });
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    async createStorageLocation(data: CreateStorageLocationDto): Promise<StorageLocation> {
        const response = await api.post<any>('/pharmacy/storage-locations', data);
        return (response.data as any).data ?? response.data;
    },

    async updateStorageLocation(
        id: number,
        data: Partial<StorageLocation>,
    ): Promise<StorageLocation> {
        const response = await api.put<any>(`/pharmacy/storage-locations/${id}`, data);
        return (response.data as any).data ?? response.data;
    },

    async deleteStorageLocation(id: number): Promise<void> {
        await api.delete(`/pharmacy/storage-locations/${id}`);
    },

    async getColdChainOverview(): Promise<ColdChainOverview> {
        const response = await api.get<any>('/pharmacy/cold-chain/overview');
        return (response.data as any).data ?? response.data;
    },

    async getColdChainExcursions(params?: {
        status?: ColdChainExcursionStatus;
        location_id?: number;
        limit?: number;
    }): Promise<ColdChainExcursion[]> {
        const response = await api.get<any>('/pharmacy/cold-chain/excursions', { params });
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    async acknowledgeColdChainExcursion(id: number, notes?: string): Promise<ColdChainExcursion> {
        const response = await api.patch<any>(`/pharmacy/cold-chain/excursions/${id}/acknowledge`, {
            notes,
        });
        return (response.data as any).data ?? response.data;
    },

    async resolveColdChainExcursion(
        id: number,
        payload: { action_taken: string; notes?: string },
    ): Promise<ColdChainExcursion> {
        const response = await api.patch<any>(
            `/pharmacy/cold-chain/excursions/${id}/resolve`,
            payload,
        );
        return (response.data as any).data ?? response.data;
    },

    async logColdChainTelemetry(
        locationId: number,
        payload: {
            temperature_c: number;
            humidity_percent?: number;
            source?: 'manual' | 'sensor';
            notes?: string;
            recorded_at?: string;
        },
    ): Promise<{
        telemetry: ColdChainTelemetry;
        excursion: ColdChainExcursion | null;
        within_range: boolean;
    }> {
        const response = await api.post<any>(
            `/pharmacy/cold-chain/locations/${locationId}/telemetry`,
            payload,
        );
        return (response.data as any).data ?? response.data;
    },

    async getColdChainTelemetryHistory(
        locationId: number,
        params?: { limit?: number },
    ): Promise<ColdChainTelemetry[]> {
        const response = await api.get<any>(
            `/pharmacy/cold-chain/locations/${locationId}/telemetry`,
            { params },
        );
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },
};
