import { createRoute } from '@tanstack/react-router';
import { RequirePermission } from '../../components/auth/RequirePermission';
import { PERMISSIONS } from '../../types/auth';
import { lazyNamed, withRouteSuspense } from '../lazy';
import { z } from 'zod';

const OrganizationsPage = lazyNamed(
    () => import('../../pages/organizations/OrganizationsPage'),
    'OrganizationsPage',
);
const FacilitiesPage = lazyNamed(
    () => import('../../pages/facilities/FacilitiesPage'),
    'FacilitiesPage',
);
const UsersPage = lazyNamed(() => import('../../pages/dashboard/UsersPage'), 'UsersPage');
const AuditLogsPage = lazyNamed(
    () => import('../../pages/dashboard/AuditLogsPage'),
    'AuditLogsPage',
);
const PatientsPage = lazyNamed(() => import('../../pages/dashboard/PatientsPage'), 'PatientsPage');
const BillingDashboardPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingDashboardPage'),
    'BillingDashboardPage',
);
const BillingCustomersPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingCustomersPage'),
    'BillingCustomersPage',
);
const BillingCustomerDetailsPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingCustomerDetailsPage'),
    'BillingCustomerDetailsPage',
);
const BillingSubscriptionsPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingSubscriptionsPage'),
    'BillingSubscriptionsPage',
);
const BillingPaymentsPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingPaymentsPage'),
    'BillingPaymentsPage',
);
const BillingTrialsPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingTrialsPage'),
    'BillingTrialsPage',
);
const BillingPlansPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingPlansPage'),
    'BillingPlansPage',
);
const BillingGatewaysPage = lazyNamed(
    () => import('../../pages/admin/billing/BillingGatewaysPage'),
    'BillingGatewaysPage',
);

export const createAdminRoutes = (parentRoute: any) => {
    const drawerSearchSchema = z.object({
        drawer: z.string().optional(),
        id: z.string().optional(),
    });

    const organizationsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'organizations',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.ORGANIZATION_MANAGE}>
                    <OrganizationsPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const facilitiesRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'facilities',
        component: () =>
            withRouteSuspense(
                <RequirePermission
                    permissions={[PERMISSIONS.FACILITY_READ, PERMISSIONS.FACILITY_MANAGE]}
                >
                    <FacilitiesPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const usersRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'users',
        component: () =>
            withRouteSuspense(
                <RequirePermission permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_MANAGE]}>
                    <UsersPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const auditLogsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'audit-logs',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.AUDIT_READ}>
                    <AuditLogsPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => {
            return z
                .object({
                    search: z.string().optional(),
                })
                .parse(search);
        },
    });

    const patientsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'patients',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.PATIENTS_READ}>
                    <PatientsPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const billingDashboardRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/dashboard',
        component: () => withRouteSuspense(<BillingDashboardPage />),
    });

    const adminDashboardRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/dashboard',
        component: () => withRouteSuspense(<BillingDashboardPage />),
    });

    const billingCustomersRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/customers',
        component: () => withRouteSuspense(<BillingCustomersPage />),
    });

    const billingCustomerDetailsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/customers/$organizationId',
        component: () => withRouteSuspense(<BillingCustomerDetailsPage />),
    });

    const billingSubscriptionsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/subscriptions',
        component: () => withRouteSuspense(<BillingSubscriptionsPage />),
    });

    const billingPaymentsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/payments',
        component: () => withRouteSuspense(<BillingPaymentsPage />),
    });

    const billingTrialsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/trials',
        component: () => withRouteSuspense(<BillingTrialsPage />),
    });

    const billingPlansRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/plans',
        component: () => withRouteSuspense(<BillingPlansPage />),
    });

    const billingGatewaysRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'admin/billing/gateways',
        component: () => withRouteSuspense(<BillingGatewaysPage />),
    });

    return [
        organizationsRoute,
        facilitiesRoute,
        usersRoute,
        auditLogsRoute,
        patientsRoute,
        billingDashboardRoute,
        adminDashboardRoute,
        billingCustomersRoute,
        billingCustomerDetailsRoute,
        billingSubscriptionsRoute,
        billingPaymentsRoute,
        billingTrialsRoute,
        billingPlansRoute,
        billingGatewaysRoute,
    ];
};
