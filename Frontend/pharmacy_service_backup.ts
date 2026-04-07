import api from '../lib/api';
import type {
    DashboardStats,
    Transaction,
    Medicine,
    CreateMedicineDto,
    Facility,
    Organization,
    CreateOrganizationDto,
    Batch,
    Stock,
    Supplier,
    ProcurementOrder,
    Alert,
    PaginatedResponse,
    Sale,
    CreateSaleDto,
    ReturnStatus,
    RefundMethod,
    ReturnReason,
    ItemCondition,
    CustomerReturn,
    DailySalesReport,
    MonthlySalesReport,
    SalesByMedicineReport,
    ComprehensiveKPIs,
    FinancialKPIs,
    InventoryKPIs,
    OperationalKPIs,
    DashboardSummary,
    RecallStatus,
    RecallReason,
    BatchRecall,
    VarianceStatus,
    VarianceType,
    StockVariance,
    ReorderSuggestion,
    StorageLocation,
    CreateStorageLocationDto,
    InsuranceProvider,
    InsuranceClaim,
    CreateOnboardingSetupDto,
} from '../types/pharmacy';

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

export const pharmacyService = {
    async getDashboardStats(): Promise<DashboardStats> {
        const response = await api.get<{ data: DashboardStats }>('/pharmacy/stats');

        return (response.data as any).data ?? (response.data as any);
    },

    async getRecentSales(): Promise<Transaction[]> {
        const response = await api.get<{ data: Transaction[] }>('/pharmacy/transactions');
        return (response.data as any).data ?? (response.data as any);
    },

    async getTopSellingMedicines(
        order: 'ASC' | 'DESC' = 'DESC',
    ): Promise<{ name: string; value: number }[]> {
        const response = await api.get('/pharmacy/top-selling', { params: { order } });
        return (response.data as any).data ?? (response.data as any);
    },

    async getInventoryStatus(): Promise<any> {
        const response = await api.get('/pharmacy/inventory-status');
        return (response.data as any).data ?? (response.data as any);
    },

    async resolveAlert(
        id: number,
        data: { action_taken: string; action_reason: string },
    ): Promise<Alert> {
        const response = await api.put<{ data: Alert }>(`/pharmacy/alerts/${id}/resolve`, data);
        return (response.data as any).data ?? (response.data as any);
    },

    async getConsumptionTrends(days: number = 30): Promise<any> {
        const response = await api.get('/pharmacy/consumption-trends', { params: { days } });
        return (response.data as any).data ?? (response.data as any);
    },

    async getExpiryRisk(days: number = 90): Promise<any> {
        const response = await api.get('/pharmacy/expiry-risk', { params: { days } });
        return (response.data as any).data ?? (response.data as any);
    },

    async getStockReport(facilityId: number): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/stock/${facilityId}`);
        return (response.data as any).data ?? response.data;
    },

    async getSalesReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/sales-summary/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getProfitReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/profit/${facilityId}`, { params });
        return (response.data as any).data ?? response.data;
    },

    async getDeadStockReport(facilityId: number, params?: { days?: number }): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/dead-stock/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getControlledDrugReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/controlled-drugs/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getExpiryReport(facilityId: number, params?: { days?: number }): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/expiry/${facilityId}`, { params });
        return (response.data as any).data ?? response.data;
    },

    async getAuditLogs(params?: {
        facilityId?: number;
        entityType?: string;
        action?: string;
        page?: number;
        limit?: number;
    }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
        const response = await api.get<any>('/pharmacy/audit-logs', { params });
        const payload = (response.data as any).data ?? response.data;
        return {
            data: Array.isArray(payload.data) ? payload.data : [],
            total: payload.total ?? 0,
            page: payload.page ?? 1,
            limit: payload.limit ?? 50,
        };
    },

    async getStockMovements(params: {
        facilityId: number;
        start_date?: string;
        end_date?: string;
        page?: number;
        limit?: number;
    }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
        const response = await api.get<any>('/pharmacy/audit-logs/stock-movements', { params });
        const payload = (response.data as any).data ?? response.data;
        return {
            data: Array.isArray(payload.data) ? payload.data : [],
            total: payload.total ?? 0,
            page: payload.page ?? 1,
            limit: payload.limit ?? 50,
        };
    },

    async getStockRegisterReport(params: {
        facilityId: number;
        start_date?: string;
        end_date?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        period?: { start: string; end: string };
    }> {
        const { facilityId, ...rest } = params;
        const response = await api.get<any>(`/pharmacy/reports/stock-register/${facilityId}`, {
            params: rest,
        });
        const payload = (response.data as any).data ?? response.data;
        return {
            data: Array.isArray(payload.data) ? payload.data : [],
            total: payload.total ?? 0,
            page: payload.page ?? 1,
            limit: payload.limit ?? 100,
            period: payload.period,
        };
    },

    async getTaxSummary(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/tax-summary/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getCustomerLoyaltyReport(facilityId: number): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/customer-loyalty/${facilityId}`);
        return (response.data as any).data ?? response.data;
    },

    async getEmployeePerformanceReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(
            `/pharmacy/reports/employee-performance/${facilityId}`,
            {
                params,
            },
        );
        return (response.data as any).data ?? response.data;
    },

    async getVendorReturnsReport(facilityId: number): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/vendor-returns/${facilityId}`);
        return (response.data as any).data ?? response.data;
    },

    async getPurchaseReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/purchase/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async downloadReport(
        type: string,
        format: 'excel' | 'pdf',
        params?: { start_date?: string; end_date?: string; days?: number },
    ): Promise<void> {
        const response = await api.get(`/pharmacy/reports/export/${type}/${format}`, {
            params,
            responseType: 'blob',
        });

        const blob = new Blob([response.data], {
            type:
                format === 'excel'
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'application/pdf',
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `${type}_report_${timestamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    async createSale(payload: CreateSaleDto): Promise<Sale> {
        const response = await api.post<any>('/pharmacy/sales', payload);
        return (response.data as any).data ?? response.data;
    },

    async getSaleReceipt(id: number, facilityId: number): Promise<void> {
        const response = await api.get(`/pharmacy/sales/${id}/receipt`, {
            params: { facilityId },
            responseType: 'blob',
        });

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `receipt_${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    async getMedicines(params?: {
        page?: number;
        limit?: number;
        search?: string;
        facility_id?: number;
        start_date?: string;
        end_date?: string;
        sort_by?: string;
        min_stock?: number;
    }): Promise<PaginatedResponse<Medicine>> {
        const response = await api.get<any>('/pharmacy/medicines', { params });
        return normalizePaginatedResponse<Medicine>(response.data);
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

    async createFacility(data: import('../types/pharmacy').CreateFacilityDto): Promise<Facility> {
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

    async getCategories(params?: {
        organization_id?: number;
    }): Promise<import('../types/pharmacy').MedicineCategory[]> {
        const response = await api.get<any>('/pharmacy/categories', { params });
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    async createCategory(data: {
        name: string;
        code: string;
        default_markup_percent?: number;
        organization_id?: number;
    }): Promise<import('../types/pharmacy').MedicineCategory> {
        const response = await api.post<any>('/pharmacy/categories', data);
        return (response.data as any).data ?? response.data;
    },

    async updateCategory(
        id: number,
        data: Partial<import('../types/pharmacy').MedicineCategory>,
    ): Promise<import('../types/pharmacy').MedicineCategory> {
        const response = await api.patch<any>(`/pharmacy/categories/${id}`, data);
        return (response.data as any).data ?? response.data;
    },

    async deleteCategory(id: number): Promise<void> {
        await api.delete(`/pharmacy/categories/${id}`);
    },

    async getDepartments(params?: {
        facility_id: number;
    }): Promise<import('../types/pharmacy').Department[]> {
        const response = await api.get<any>('/pharmacy/departments', { params });
        const payload = response.data?.data;

        if (payload && Array.isArray(payload.data)) {
            return payload.data;
        }
        return Array.isArray(payload) ? payload : [];
    },

    async createDepartment(
        data: Partial<import('../types/pharmacy').Department>,
    ): Promise<import('../types/pharmacy').Department> {
        const response = await api.post<{ data: import('../types/pharmacy').Department }>(
            '/pharmacy/departments',
            data,
        );
        return response.data.data;
    },

    async updateDepartment(
        id: number,
        data: Partial<import('../types/pharmacy').Department>,
    ): Promise<import('../types/pharmacy').Department> {
        const response = await api.put<{ data: import('../types/pharmacy').Department }>(
            `/pharmacy/departments/${id}`,
            data,
        );
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

    async getBatches(params?: { medicine_id?: number; facility_id?: number }): Promise<Batch[]> {
        const response = await api.get<{ data: Batch[] }>('/pharmacy/batches', { params });
        return response.data.data;
    },

    async getStock(params?: {
        facility_id?: number;
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
        data: { received_items: any[]; received_date: string },
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

    async getAlerts(params?: {
        facility_id?: number;
        status?: string;
        limit?: number;
    }): Promise<PaginatedResponse<Alert>> {
        const response = await api.get<any>('/pharmacy/alerts', { params });
        return normalizePaginatedResponse<Alert>(response.data);
    },

    async getAlertSummary(): Promise<any> {
        const response = await api.get<any>('/pharmacy/alerts/summary');
        return response.data;
    },

    async acknowledgeAlert(alertId: number): Promise<any> {
        const response = await api.post<any>(`/pharmacy/alerts/${alertId}/acknowledge`);
        return response.data;
    },

    async generateAlerts(): Promise<any> {
        const response = await api.post<any>('/pharmacy/alerts/generate');
        return response.data;
    },

    async dispenseMedicine(data: {
        facility_id: number;
        medicine_id: number;
        batch_id: number;
        quantity: number;
        dispense_type: string;
        patient_id?: number;
        prescription_id?: number;
        unit_price: number;
    }): Promise<any> {
        const response = await api.post('/pharmacy/dispensing', data);
        return response.data;
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
        reason: string;
    }): Promise<any> {
        const response = await api.post('/pharmacy/stock/adjust', data);
        return response.data;
    },

    async getPatients(params?: {
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<import('../types/auth').User>> {
        const response = await api.get('/users', {
            params: {
                role: 'patient',
                ...params,
            },
        });
        return normalizePaginatedResponse(response.data);
    },

    async updatePatient(id: number, data: any): Promise<import('../types/auth').User> {
        const response = await api.put<{ data: import('../types/auth').User }>(
            `/users/${id}`,
            data,
        );
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

    // Advanced Analytics Methods
    async getAdvancedKPIs(): Promise<import('../types/pharmacy').AdvancedKPIs> {
        const response = await api.get<{ data: import('../types/pharmacy').AdvancedKPIs }>(
            '/pharmacy/analytics/kpis',
        );
        return (response.data as any).data ?? response.data;
    },

    async getCriticalMedicines(): Promise<{
        medicines: import('../types/pharmacy').CriticalMedicine[];
    }> {
        const response = await api.get<any>('/pharmacy/analytics/critical-medicines');
        return (response.data as any).data ?? response.data;
    },

    async getExpiryHeatMap(params: {
        start: string;
        end: string;
    }): Promise<import('../types/pharmacy').ExpiryHeatMapData> {
        const response = await api.get<any>('/pharmacy/analytics/expiry-heatmap', { params });
        return (response.data as any).data ?? response.data;
    },

    async getFEFOCompliance(
        days?: number,
    ): Promise<import('../types/pharmacy').FEFOComplianceData> {
        const response = await api.get<any>('/pharmacy/analytics/fefo-compliance', {
            params: { days },
        });
        return (response.data as any).data ?? response.data;
    },

    async getABCAnalysis(period?: number): Promise<import('../types/pharmacy').ABCAnalysisData> {
        const response = await api.get<any>('/pharmacy/analytics/abc-analysis', {
            params: { period },
        });
        return (response.data as any).data ?? response.data;
    },

    async getMultiLocationComparison(
        metric: string,
    ): Promise<import('../types/pharmacy').MultiLocationData> {
        const response = await api.get<any>('/pharmacy/analytics/multi-location', {
            params: { metric },
        });
        return (response.data as any).data ?? response.data;
    },

    async getOverstockReport(): Promise<import('../types/pharmacy').OverstockData> {
        const response = await api.get<any>('/pharmacy/analytics/overstock');
        return (response.data as any).data ?? response.data;
    },

    async recalculateConsumption(
        days?: number,
    ): Promise<{ updated_count: number; results: any[] }> {
        const response = await api.post<any>('/pharmacy/analytics/recalculate-consumption', {
            days,
        });
        return (response.data as any).data ?? response.data;
    },

    async getReorderSuggestions(facilityId: number | null): Promise<ReorderSuggestion[]> {
        const url = facilityId
            ? `/pharmacy/analytics/reorder-suggestions/${facilityId}`
            : '/pharmacy/analytics/reorder-suggestions';
        const response = await api.get<any>(url);
        const data = (response.data as any).data ?? response.data;
        return Array.isArray(data) ? data : data.suggestions || [];
    },

    async createDraftPOsFromSuggestions(facilityId: number): Promise<{ count: number }> {
        const response = await api.post<any>(`/pharmacy/procurement/auto-draft-pos`, {
            facility_id: facilityId,
        });
        return (response.data as any).data ?? response.data;
    },

    async getSupplierPerformance(): Promise<import('../types/pharmacy').SupplierPerformanceItem[]> {
        const response = await api.get<any>('/pharmacy/analytics/supplier-performance');
        return (response.data as any).data ?? response.data;
    },

    async getBatchTraceability(
        batchId: number,
    ): Promise<import('../types/pharmacy').BatchTraceabilityReport> {
        const response = await api.get<any>(`/pharmacy/reports/batch-traceability/${batchId}`);
        return (response.data as any).data ?? response.data;
    },

    async getControlledDrugRegister(
        facilityId: number,
        medicineId: number,
    ): Promise<import('../types/pharmacy').ControlledDrugRegisterReport> {
        const response = await api.get<any>(
            `/pharmacy/reports/controlled-drug-register/${facilityId}/${medicineId}`,
        );
        return (response.data as any).data ?? response.data;
    },

    // Physical Count & Stocktaking
    async startPhysicalCount(
        facilityId: number,
        medicineIds?: number[],
    ): Promise<import('../types/pharmacy').PhysicalCount> {
        const response = await api.post<any>('/pharmacy/physical-counts/start', {
            facility_id: facilityId,
            medicineIds,
        });
        return (response.data as any).data ?? response.data;
    },

    async getPhysicalCounts(
        facilityId: number,
    ): Promise<import('../types/pharmacy').PhysicalCount[]> {
        const response = await api.get<any>('/pharmacy/physical-counts', {
            params: { facility_id: facilityId },
        });
        return (response.data as any).data ?? response.data;
    },

    async getPhysicalCount(countId: number): Promise<import('../types/pharmacy').PhysicalCount> {
        const response = await api.get<any>(`/pharmacy/physical-counts/${countId}`);
        return (response.data as any).data ?? response.data;
    },

    async updatePhysicalCountItem(
        itemId: number,
        countedQuantity: number,
        notes?: string,
    ): Promise<import('../types/pharmacy').PhysicalCountItem> {
        const response = await api.put<any>(`/pharmacy/physical-counts/items/${itemId}`, {
            countedQuantity,
            notes,
        });
        return (response.data as any).data ?? response.data;
    },

    approvePhysicalCount(countId: number): Promise<import('../types/pharmacy').PhysicalCount> {
        return api
            .post<any>(`/pharmacy/physical-counts/${countId}/approve`)
            .then((res) => res.data.data);
    },

    // Returns System Methods
    async getReturns(params?: {
        facility_id?: number;
        status?: ReturnStatus;
        sale_number?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<CustomerReturn>> {
        const response = await api.get<any>('/pharmacy/returns', { params });
        return normalizePaginatedResponse<CustomerReturn>(response.data);
    },

    async getReturn(id: number): Promise<CustomerReturn> {
        const response = await api.get<any>(`/pharmacy/returns/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async createReturn(payload: {
        sale_id: number;
        facility_id: number;
        refund_method: RefundMethod;
        notes?: string;
        items: Array<{
            sale_item_id: number;
            quantity_returned: number;
            reason: ReturnReason;
            condition: ItemCondition;
        }>;
    }): Promise<CustomerReturn> {
        const response = await api.post<any>('/pharmacy/returns', payload);
        return (response.data as any).data ?? response.data;
    },

    async approveReturn(id: number): Promise<CustomerReturn> {
        const response = await api.post<any>(`/pharmacy/returns/${id}/approve`);
        return (response.data as any).data ?? response.data;
    },

    async rejectReturn(id: number, reason: string): Promise<CustomerReturn> {
        const response = await api.post<any>(`/pharmacy/returns/${id}/reject`, { reason });
        return (response.data as any).data ?? response.data;
    },

    async processRefund(id: number): Promise<CustomerReturn> {
        const response = await api.post<any>(`/pharmacy/returns/${id}/process-refund`);
        return (response.data as any).data ?? response.data;
    },

    // Detailed Sales Report Methods
    async getDailySalesReport(
        facilityId: number,
        params: { date: string },
    ): Promise<DailySalesReport> {
        const response = await api.get<any>(`/pharmacy/reports/sales/daily/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getMonthlySalesReport(
        facilityId: number,
        params: { year: number; month: number },
    ): Promise<MonthlySalesReport> {
        const response = await api.get<any>(`/pharmacy/reports/sales/monthly/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getSalesByMedicineReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<SalesByMedicineReport> {
        const response = await api.get<any>(`/pharmacy/reports/sales/by-medicine/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getSalesByCategoryReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/sales/by-category/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getSalesByCashierReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/sales/by-cashier/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getPaymentMethodSummary(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(
            `/pharmacy/reports/sales/payment-methods/${facilityId}`,
            {
                params,
            },
        );
        return (response.data as any).data ?? response.data;
    },

    async getGrossVsNetSalesReport(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<any> {
        const response = await api.get<any>(`/pharmacy/reports/sales/gross-vs-net/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    // KPI Methods
    async getComprehensiveKPIs(
        facilityId: number | null,
        params?: { start_date?: string; end_date?: string },
    ): Promise<ComprehensiveKPIs> {
        const url = facilityId
            ? `/pharmacy/kpis/comprehensive/${facilityId}`
            : '/pharmacy/kpis/comprehensive';
        const response = await api.get<any>(url, { params });
        return (response.data as any).data ?? response.data;
    },

    async getFinancialKPIs(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<FinancialKPIs> {
        const response = await api.get<any>(`/pharmacy/kpis/financial/${facilityId}`, { params });
        return (response.data as any).data ?? response.data;
    },

    async getInventoryKPIs(facilityId: number): Promise<InventoryKPIs> {
        const response = await api.get<any>(`/pharmacy/kpis/inventory/${facilityId}`);
        return (response.data as any).data ?? response.data;
    },

    async getOperationalKPIs(
        facilityId: number,
        params?: { start_date?: string; end_date?: string },
    ): Promise<OperationalKPIs> {
        const response = await api.get<any>(`/pharmacy/kpis/operational/${facilityId}`, {
            params,
        });
        return (response.data as any).data ?? response.data;
    },

    async getSale(id: number): Promise<Sale> {
        const response = await api.get<any>(`/pharmacy/sales/${id}`);
        return (response.data as any).data ?? response.data;
    },

    async getDashboardSummary(facilityId: number | null): Promise<DashboardSummary> {
        const url = facilityId ? `/pharmacy/kpis/summary/${facilityId}` : '/pharmacy/kpis/summary';
        const response = await api.get<any>(url);
        return (response.data as any).data ?? response.data;
    },

    // Recall Methods
    async getRecalls(params?: {
        facility_id?: number;
        status?: RecallStatus;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<BatchRecall>> {
        const response = await api.get<any>('/pharmacy/recalls', { params });
        return normalizePaginatedResponse<BatchRecall>(response.data);
    },

    async initiateRecall(data: {
        batch_id: number;
        reason: RecallReason;
        description: string;
    }): Promise<BatchRecall> {
        const response = await api.post<any>('/pharmacy/recalls', data);
        return (response.data as any).data ?? response.data;
    },

    async getRecall(id: number): Promise<BatchRecall> {
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

    // Stock Variance Methods
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

    // Insurance Management Methods
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

    // H-1: Download a PDF receipt for a specific sale and trigger browser download
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

    // H-6: Fetch recent sales for a specific patient (for PatientSummaryPanel)
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

    // H-2: Get facility-specific selling price for a medicine (falls back to medicine default)
    async getFacilityMedicinePrice(medicineId: number): Promise<number | null> {
        try {
            const response = await api.get<any>(
                `/pharmacy/facility-settings/medicine/${medicineId}/price`,
            );
            const payload = (response.data as any).data ?? response.data;
            return typeof payload?.selling_price === 'number' ? payload.selling_price : null;
        } catch {
            return null; // gracefully fall back to medicine default price
        }
    },
};
