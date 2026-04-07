import {
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    Navigate,
} from '@tanstack/react-router';
import React from 'react';
import { GlobalLoading } from '../components/ui/GlobalLoading';
import { z } from 'zod';
import { RequirePermission } from '../components/auth/RequirePermission';
import { PERMISSIONS } from '../types/auth';
import { lazyNamed, withRouteSuspense } from './lazy';
import { WhatsAppFloatingButton } from '../components/shared/WhatsAppFloatingButton';

import { createInventoryRoutes } from './modules/inventory.routes';
import { createAuthRoutes } from './modules/auth.routes';
import { createSalesRoutes } from './modules/sales.routes';
import { createProcurementRoutes } from './modules/procurement.routes';
import { createAdminRoutes } from './modules/admin.routes';
import { createAnalyticsRoutes } from './modules/analytics.routes';

const MainLayout = lazyNamed(() => import('../components/layout/MainLayout'), 'MainLayout');
const AuthLayout = lazyNamed(() => import('../components/layout/AuthLayout'), 'AuthLayout');
const DashboardPage = lazyNamed(() => import('../pages/dashboard/DashboardPage'), 'DashboardPage');
const LandingPage = lazyNamed(() => import('../pages/marketing/LandingPage'), 'LandingPage');
const DocsPage = lazyNamed(() => import('../pages/marketing/DocsPage'), 'DocsPage');
const PrivacyPolicyPage = lazyNamed(
    () => import('../pages/marketing/PrivacyPolicyPage'),
    'PrivacyPolicyPage',
);
const TermsOfUsePage = lazyNamed(
    () => import('../pages/marketing/TermsOfUsePage'),
    'TermsOfUsePage',
);
const PublicPurchaseOrder = lazyNamed(
    () => import('../pages/public/PublicPurchaseOrder'),
    'PublicPurchaseOrder',
);
const OnboardingPage = lazyNamed(() => import('../pages/auth/OnboardingPage'), 'OnboardingPage');
const AlertsPage = lazyNamed(() => import('../pages/dashboard/AlertsPage'), 'AlertsPage');
const BillingPage = lazyNamed(() => import('../pages/dashboard/BillingPage'), 'BillingPage');
const CheckoutPage = lazyNamed(() => import('../pages/marketing/CheckoutPage'), 'CheckoutPage');
const SubscribeRedirectPage = lazyNamed(
    () => import('../pages/marketing/SubscribeRedirectPage'),
    'SubscribeRedirectPage',
);

const RootComponent = () => (
    <React.Fragment>
        <WhatsAppFloatingButton />
        <Outlet />
    </React.Fragment>
);

const rootRoute = createRootRoute({
    component: RootComponent,
    notFoundComponent: () => (
        <div className="h-screen w-full flex items-center justify-center bg-healthcare-surface p-10">
            <div className="glass-card p-10 max-w-md w-full text-center space-y-4 rounded-2xl border-2">
                <h2 className="text-xl font-black text-healthcare-dark">404 - Not Found</h2>
                <p className="text-slate-500 text-sm">
                    The page you are looking for does not exist.
                </p>
                <button
                    onClick={() => (window.location.href = '/app')}
                    className="px-6 py-2 bg-healthcare-primary text-white rounded-lg text-xs font-black hover:bg-teal-700 transition-all shadow-md"
                >
                    Go to app
                </button>
            </div>
        </div>
    ),
});

const rootIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => withRouteSuspense(<LandingPage />),
});

const docsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/docs',
    component: () => withRouteSuspense(<DocsPage />),
});

const subscribeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/subscribe',
    component: () => withRouteSuspense(<SubscribeRedirectPage />),
});

const checkoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/checkout',
    component: () => withRouteSuspense(<CheckoutPage />),
    validateSearch: (search: Record<string, unknown>) => {
        return z
            .object({
                plan: z.enum(['starter', 'pro', 'business', 'enterprise', 'test']).optional(),
                mode: z.enum(['purchase', 'renew']).optional(),
            })
            .parse(search);
    },
});

const privacyPolicyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/privacy-policy',
    component: () => withRouteSuspense(<PrivacyPolicyPage />),
});

const termsOfUseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/terms-of-use',
    component: () => withRouteSuspense(<TermsOfUsePage />),
});

const loginFallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <Navigate to={'/auth/login' as any} search={{} as any} />,
});

const appLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/app',
    component: () => withRouteSuspense(<MainLayout />),
});

const indexRoute = createRoute({
    getParentRoute: () => appLayoutRoute,
    path: '/',
    component: () => withRouteSuspense(<DashboardPage />),
});

const alertsRoute = createRoute({
    getParentRoute: () => appLayoutRoute,
    path: 'alerts',
    component: () =>
        withRouteSuspense(
            <RequirePermission permission={PERMISSIONS.ALERTS_READ}>
                <AlertsPage />
            </RequirePermission>,
        ),
    validateSearch: (search: Record<string, unknown>) => {
        return z
            .object({
                search: z.string().optional(),
                type: z.enum(['all', 'low_stock', 'expiry']).optional(),
                status: z.enum(['active', 'resolved']).optional(),
                alertId: z.string().optional(),
            })
            .parse(search);
    },
});

const employeeRoute = createRoute({
    getParentRoute: () => appLayoutRoute,
    path: 'employees',
    component: () => <Navigate to={'/app/users' as any} search={{} as any} />,
});

const onboardingRoute = createRoute({
    getParentRoute: () => appLayoutRoute,
    path: 'onboarding',
    component: () => withRouteSuspense(<OnboardingPage />),
});

const billingRoute = createRoute({
    getParentRoute: () => appLayoutRoute,
    path: 'billing',
    component: () => withRouteSuspense(<BillingPage />),
});

const appRouteTree = appLayoutRoute.addChildren([
    indexRoute,
    alertsRoute,
    employeeRoute,
    onboardingRoute,
    billingRoute,
    ...createInventoryRoutes(appLayoutRoute),
    ...createSalesRoutes(appLayoutRoute),
    ...createProcurementRoutes(appLayoutRoute),
    ...createAdminRoutes(appLayoutRoute),
    ...createAnalyticsRoutes(appLayoutRoute),
]);

const authLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth',
    component: () => withRouteSuspense(<AuthLayout />),
});

const authRouteTree = authLayoutRoute.addChildren(createAuthRoutes(authLayoutRoute, rootRoute));

// Public Routes
const publicRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/public',
    component: () => <Outlet />,
});

const publicPORoute = createRoute({
    getParentRoute: () => publicRoute,
    path: 'po/$token',
    component: () => withRouteSuspense(<PublicPurchaseOrder />),
});

const publicRouteTree = publicRoute.addChildren([publicPORoute]);

const routeTree = rootRoute.addChildren([
    rootIndexRoute,
    docsRoute,
    subscribeRoute,
    checkoutRoute,
    privacyPolicyRoute,
    termsOfUseRoute,
    loginFallbackRoute,
    appRouteTree,
    authRouteTree,
    publicRouteTree,
]);

export const router = createRouter({
    routeTree,
    defaultPendingComponent: GlobalLoading,
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
