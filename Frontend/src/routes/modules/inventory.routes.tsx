import { createRoute, Navigate } from '@tanstack/react-router';
import { z } from 'zod';
import { RequirePermission } from '../../components/auth/RequirePermission';
import { PERMISSIONS } from '../../types/auth';
import { lazyNamed, withRouteSuspense } from '../lazy';
const InventoryPage = lazyNamed(
    () => import('../../pages/dashboard/InventoryPage'),
    'InventoryPage',
);
const MedicineDetailsPage = lazyNamed(
    () => import('../../pages/dashboard/MedicineDetailsPage'),
    'MedicineDetailsPage',
);
const BatchStockPage = lazyNamed(
    () => import('../../pages/dashboard/BatchStockPage'),
    'BatchStockPage',
);
const StockMovementsPage = lazyNamed(
    () => import('../../pages/dashboard/StockMovementsPage'),
    'StockMovementsPage',
);
const PhysicalCountPage = lazyNamed(
    () => import('../../pages/dashboard/PhysicalCountPage'),
    'PhysicalCountPage',
);
const VarianceTrackingPage = lazyNamed(
    () => import('../../pages/dashboard/VarianceTrackingPage'),
    'VarianceTrackingPage',
);
const BatchRecallPage = lazyNamed(
    () => import('../../pages/dashboard/BatchRecallPage'),
    'BatchRecallPage',
);
const ReorderDashboardPage = lazyNamed(
    () => import('../../pages/dashboard/ReorderDashboardPage'),
    'ReorderDashboardPage',
);

export const createInventoryRoutes = (parentRoute: any) => {
    const drawerSearchSchema = z.object({
        drawer: z.string().optional(),
        id: z.string().optional(),
    });

    const inventoryRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'inventory',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.INVENTORY_READ}>
                    <InventoryPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const stockRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'stock',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.INVENTORY_READ}>
                    <BatchStockPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const medicineDetailsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'inventory/$medicineId',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.INVENTORY_READ}>
                    <MedicineDetailsPage />
                </RequirePermission>,
            ),
        validateSearch: (search: Record<string, unknown>) => drawerSearchSchema.parse(search),
    });

    const stockMovementsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'stock-movements',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.STOCK_MOVEMENTS_READ}>
                    <StockMovementsPage />
                </RequirePermission>,
            ),
    });

    const stocktakingRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'stocktaking',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.INVENTORY_WRITE}>
                    <PhysicalCountPage />
                </RequirePermission>,
            ),
    });

    const variancesRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'variances',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.INVENTORY_READ}>
                    <VarianceTrackingPage />
                </RequirePermission>,
            ),
    });

    const recallsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'recalls',
        component: () =>
            withRouteSuspense(
                <RequirePermission permission={PERMISSIONS.INVENTORY_READ}>
                    <BatchRecallPage />
                </RequirePermission>,
            ),
    });

    const replenishRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'replenish',
        component: () =>
            withRouteSuspense(
                <RequirePermission
                    permissions={[PERMISSIONS.PROCUREMENT_READ, PERMISSIONS.INVENTORY_WRITE]}
                >
                    <ReorderDashboardPage />
                </RequirePermission>,
            ),
    });

    const reorderDashboardLegacyRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'reorder-dashboard',
        component: () => <Navigate to={'/app/replenish' as any} replace search={{} as any} />,
    });

    const stockRegisterRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'stock-register',
        component: () => <Navigate to={'/app/stock-movements' as any} search={{} as any} />,
    });

    return [
        inventoryRoute,
        medicineDetailsRoute,
        stockRoute,
        stockMovementsRoute,
        stocktakingRoute,
        variancesRoute,
        recallsRoute,
        replenishRoute,
        reorderDashboardLegacyRoute,
        stockRegisterRoute,
    ];
};
