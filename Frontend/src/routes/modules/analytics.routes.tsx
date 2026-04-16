import { createRoute, Outlet, Navigate } from '@tanstack/react-router';
import { RequirePermission } from '../../components/auth/RequirePermission';
import { PERMISSIONS } from '../../types/auth';
import { lazyNamed, withRouteSuspense } from '../lazy';

const ReportsPage = lazyNamed(() => import('../../pages/dashboard/ReportsPage'), 'ReportsPage');
const ReturnsPage = lazyNamed(() => import('../../pages/dashboard/ReturnsPage'), 'ReturnsPage');

export const createAnalyticsRoutes = (parentRoute: any) => {
    const analyticsRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'analytics',
        component: () => (
            <RequirePermission
                permissions={[PERMISSIONS.REPORTS_READ, PERMISSIONS.AUDIT_READ]}
            >
                <Outlet />
            </RequirePermission>
        ),
    });

    const analyticsIndexRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: '/',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/analytics/sales" search={{}} />;
        },
    });

    const analyticsOperationsRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'operations',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/analytics/sales" search={{}} />;
        },
    });

    const analyticsIntelligenceRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'intelligence',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/replenish" search={{}} replace />;
        },
    });

    const analyticsComplianceRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'compliance',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/analytics/performance" search={{}} />;
        },
    });

    const analyticsSalesRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'sales',
        component: () => withRouteSuspense(<ReportsPage defaultTab="sales" />),
    });

    const analyticsReturnsRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'returns',
        component: () => withRouteSuspense(<ReturnsPage />),
    });

    const analyticsInventoryRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'inventory',
        component: () => withRouteSuspense(<ReportsPage defaultTab="stock" />),
    });

    const analyticsPerformanceRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'performance',
        component: () => withRouteSuspense(<ReportsPage defaultTab="performance" />),
    });

    const analyticsProcurementRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'procurement',
        component: () => withRouteSuspense(<ReportsPage defaultTab="procurement" />),
    });

    const analyticsLoyaltyRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'loyalty',
        component: () => withRouteSuspense(<ReportsPage defaultTab="loyalty" />),
    });

    const analyticsTaxRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'tax',
        component: () => withRouteSuspense(<ReportsPage defaultTab="tax" />),
    });

    const analyticsRecallRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'recall',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/recalls" search={{}} replace />;
        },
    });

    const analyticsProfitRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'profit',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/analytics/sales" search={{}} />;
        },
    });

    const analyticsLowStockRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'low-stock',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/analytics/inventory" search={{}} replace />;
        },
    });

    const analyticsMovementRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'movement',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/stock-movements" search={{}} replace />;
        },
    });

    const analyticsFastMovingRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'fast-moving',
        component: () => withRouteSuspense(<ReportsPage defaultTab="fast-moving" />),
    });

    const analyticsDemandForecastRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'demand-forecast',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/replenish" search={{}} replace />;
        },
    });

    const analyticsForecastReorderRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'forecast-reorder',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/replenish" search={{}} replace />;
        },
    });

    const analyticsNearExpiryActionsRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'near-expiry-actions',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/recalls" search={{}} replace />;
        },
    });

    const analyticsParRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'par',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/replenish" search={{}} replace />;
        },
    });

    const analyticsAuditLogsRoute = createRoute({
        getParentRoute: () => analyticsRoute,
        path: 'audit-logs',
        component: () => {
            const Nav = Navigate as any;
            return <Nav to="/app/audit-logs" search={{}} replace />;
        },
    });

    return [
        analyticsRoute.addChildren([
            analyticsIndexRoute,
            analyticsOperationsRoute,
            analyticsIntelligenceRoute,
            analyticsComplianceRoute,
            analyticsSalesRoute,
            analyticsReturnsRoute,
            analyticsInventoryRoute,
            analyticsPerformanceRoute,
            analyticsProcurementRoute,
            analyticsLoyaltyRoute,
            analyticsTaxRoute,
            analyticsRecallRoute,
            analyticsProfitRoute,
            analyticsLowStockRoute,
            analyticsMovementRoute,
            analyticsFastMovingRoute,
            analyticsDemandForecastRoute,
            analyticsForecastReorderRoute,
            analyticsNearExpiryActionsRoute,
            analyticsParRoute,
            analyticsAuditLogsRoute,
        ]),
    ];
};
