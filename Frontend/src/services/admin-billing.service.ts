import api from '../lib/api';

export const adminBillingService = {
    async getOverview() {
        const res = await api.get('/admin/billing/overview');
        return (res.data as any).data ?? res.data;
    },
    async getCustomers(params?: Record<string, any>) {
        const res = await api.get('/admin/billing/customers', { params });
        return (res.data as any).data ?? res.data;
    },
    async getCustomerByOrganizationId(organizationId: number) {
        const res = await api.get(`/admin/billing/customers/${organizationId}`);
        return (res.data as any).data ?? res.data;
    },
    async getSubscriptions(params?: Record<string, any>) {
        const res = await api.get('/admin/billing/subscriptions', { params });
        return (res.data as any).data ?? res.data;
    },
    async getSubscription(id: number) {
        const res = await api.get(`/admin/billing/subscriptions/${id}`);
        return (res.data as any).data ?? res.data;
    },
    async updateSubscriptionStatus(id: number, status: string) {
        const res = await api.patch(`/admin/billing/subscriptions/${id}/status`, { status });
        return (res.data as any).data ?? res.data;
    },
    async extendTrial(id: number, days: number) {
        const res = await api.post(`/admin/billing/subscriptions/${id}/extend-trial`, { days });
        return (res.data as any).data ?? res.data;
    },
    async changePlan(id: number, to_plan_id: number, effective_mode: 'immediate' | 'next_cycle') {
        const res = await api.post(`/admin/billing/subscriptions/${id}/change-plan`, {
            to_plan_id,
            effective_mode,
        });
        return (res.data as any).data ?? res.data;
    },
    async cancelPendingPlanChange(id: number) {
        const res = await api.post(`/admin/billing/subscriptions/${id}/cancel-pending-plan-change`);
        return (res.data as any).data ?? res.data;
    },
    async getPayments(params?: Record<string, any>) {
        const res = await api.get('/admin/billing/payments', { params });
        return (res.data as any).data ?? res.data;
    },
    async getPayment(id: number) {
        const res = await api.get(`/admin/billing/payments/${id}`);
        return (res.data as any).data ?? res.data;
    },
    async getTrials() {
        const res = await api.get('/admin/billing/trials');
        return (res.data as any).data ?? res.data;
    },
    async getPlans() {
        const res = await api.get('/admin/billing/plans');
        return (res.data as any).data ?? res.data;
    },
    async createPlan(payload: Record<string, any>) {
        const res = await api.post('/admin/billing/plans', payload);
        return (res.data as any).data ?? res.data;
    },
    async updatePlan(id: number, payload: Record<string, any>) {
        const res = await api.patch(`/admin/billing/plans/${id}`, payload);
        return (res.data as any).data ?? res.data;
    },
    async getPlanFeatures(id: number) {
        const res = await api.get(`/admin/billing/plans/${id}/features`);
        return (res.data as any).data ?? res.data;
    },
    async updatePlanFeatures(id: number, features: Array<Record<string, any>>) {
        const res = await api.put(`/admin/billing/plans/${id}/features`, { features });
        return (res.data as any).data ?? res.data;
    },
    async getGateways() {
        const res = await api.get('/admin/billing/gateways');
        return (res.data as any).data ?? res.data;
    },
    async updateGateway(id: number, payload: Record<string, any>) {
        const res = await api.patch(`/admin/billing/gateways/${id}`, payload);
        return (res.data as any).data ?? res.data;
    },
};

