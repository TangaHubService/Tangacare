import api from '../lib/api';

export const adminOrganizationsService = {
    async impersonateOrganization(
        organizationId: number,
        params?: {
            facilityId?: number | null;
        },
    ) {
        const facility_id = params?.facilityId ?? undefined;
        const res = await api.post(`/admin/organizations/${organizationId}/impersonate`, facility_id ? { facility_id } : {});
        return (res.data as any).data ?? res.data;
    },
};

