import { createRoute } from '@tanstack/react-router';
import { RequirePermission } from '../../components/auth/RequirePermission';
import { PERMISSIONS } from '../../types/auth';
import { lazyNamed, withRouteSuspense } from '../lazy';
const DispensingPage = lazyNamed(
    () => import('../../pages/dashboard/DispensingPage'),
    'DispensingPage',
);
const InsurancePage = lazyNamed(
    () => import('../../pages/dashboard/InsurancePage'),
    'InsurancePage',
);
const PrescriptionsPage = lazyNamed(
    () => import('../../pages/dashboard/PrescriptionsPage'),
    'PrescriptionsPage',
);

export const createSalesRoutes = (parentRoute: any) => {
    /** Browse catalog with read; checkout still requires `dispensing:write` inside the page. */
    const dispensingRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'dispensing',
        component: () =>
            withRouteSuspense(
                <RequirePermission
                    permissions={[PERMISSIONS.DISPENSING_READ, PERMISSIONS.DISPENSING_WRITE]}
                >
                    <DispensingPage />
                </RequirePermission>,
            ),
    });

    /** Pharmacy-first alias — same POS flow as `dispensing` (primary outbound stock path is `Sale` / createSale). */
    const sellRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'sell',
        component: () =>
            withRouteSuspense(
                <RequirePermission
                    permissions={[PERMISSIONS.DISPENSING_READ, PERMISSIONS.DISPENSING_WRITE]}
                >
                    <DispensingPage />
                </RequirePermission>,
            ),
    });

    const insuranceRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'insurance',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.DISPENSING_READ}>
                    <InsurancePage />
                </RequirePermission>,
            ),
    });

    const prescriptionsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'prescriptions',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.DISPENSING_READ}>
                    <PrescriptionsPage />
                </RequirePermission>,
            ),
    });

    return [dispensingRoute, sellRoute, insuranceRoute, prescriptionsRoute];
};
