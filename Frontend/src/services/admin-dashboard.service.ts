import api from '../lib/api';

export const adminDashboardService = {
    async getDashboard() {
        const res = await api.get('/admin/dashboard');
        return (res.data as any).data ?? res.data;
    },
};

