import api from '../lib/api';

export type SubscriptionPlanCode = 'starter' | 'pro' | 'business' | 'enterprise' | 'test';

export type PaymentMethodPreference = 'mtn_momo' | 'mobile_money';
export type BillingDurationMonths = 1 | 3 | 12;

export const subscriptionService = {
    async getMySubscription(): Promise<any | null> {
        const response = await api.get<any>('/subscriptions/me');
        return (response.data as any).data ?? response.data ?? null;
    },

    async payNow(data: {
        plan_code?: SubscriptionPlanCode;
        phone_number: string;
        payment_method_preference?: PaymentMethodPreference;
        duration_months?: BillingDurationMonths;
        idempotency_key?: string;
    }): Promise<any> {
        const response = await api.post<any>('/subscriptions/pay-now', data);
        return (response.data as any).data ?? response.data;
    },

    async getCheckoutSummary(params: {
        plan_code: SubscriptionPlanCode;
        duration_months: BillingDurationMonths;
    }): Promise<any> {
        const response = await api.get<any>('/subscriptions/checkout-summary', { params });
        return (response.data as any).data ?? response.data;
    },

    async startSubscription(data: {
        plan_code: SubscriptionPlanCode;
        phone_number: string;
        payment_method_preference?: PaymentMethodPreference;
    }): Promise<any> {
        const response = await api.post<any>('/subscriptions/start', data);
        return (response.data as any).data ?? response.data;
    },

    async getMyLimits(): Promise<any> {
        const response = await api.get<any>('/subscriptions/me/limits');
        return (response.data as any).data ?? response.data;
    },

    async renewSubscription(data: {
        plan_code?: SubscriptionPlanCode;
        phone_number?: string;
        payment_method_preference?: PaymentMethodPreference;
    }): Promise<any> {
        const response = await api.post<any>('/subscriptions/renew', data);
        return (response.data as any).data ?? response.data;
    },

    async getMyPayments(): Promise<any[]> {
        const response = await api.get<any>('/subscriptions/me/payments');
        const payload = (response.data as any).data ?? response.data;
        return Array.isArray(payload) ? payload : [];
    },

    async getExpirationWarning(): Promise<any> {
        const response = await api.get<any>('/subscriptions/me/expiration-warning');
        return (response.data as any).data ?? response.data;
    },

    async getBillingOverview(): Promise<any> {
        const response = await api.get<any>('/subscriptions/me/billing-overview');
        return (response.data as any).data ?? response.data;
    },

    async downloadPaymentInvoice(paymentId: number): Promise<Blob> {
        const response = await api.get(`/subscriptions/me/payments/${paymentId}/invoice`, {
            responseType: 'blob',
        });
        return response.data as Blob;
    },
};

