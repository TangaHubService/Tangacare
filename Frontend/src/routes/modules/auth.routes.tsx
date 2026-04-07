import { createRoute, Navigate } from '@tanstack/react-router';
import { lazyNamed, withRouteSuspense } from '../lazy';
import { z } from 'zod';
const LoginPage = lazyNamed(() => import('../../pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('../../pages/auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyNamed(
    () => import('../../pages/auth/ForgotPasswordPage'),
    'ForgotPasswordPage',
);
const VerifyOtpPage = lazyNamed(() => import('../../pages/auth/VerifyOtpPage'), 'VerifyOtpPage');
const ResetPasswordPage = lazyNamed(
    () => import('../../pages/auth/ResetPasswordPage'),
    'ResetPasswordPage',
);
const SetPasswordPage = lazyNamed(
    () => import('../../pages/auth/SetPasswordPage'),
    'SetPasswordPage',
);

export const createAuthRoutes = (parentRoute: any, _rootRoute: any) => {
    const authIndexRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: '/',
        component: () => <Navigate to={'/auth/login' as any} search={{} as any} />,
    });

    const loginRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'login',
        component: () => withRouteSuspense(<LoginPage />),
        validateSearch: (search: Record<string, unknown>) => {
            return z
                .object({
                    redirect: z.string().optional(),
                })
                .parse(search);
        },
    });

    const registerRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'register',
        component: () => withRouteSuspense(<RegisterPage />),
        validateSearch: (search: Record<string, unknown>) => {
            return z
                .object({
                    role: z.string().optional(),
                    inviteCode: z.string().optional(),
                    redirect: z.string().optional(),
                })
                .parse(search);
        },
    });

    const forgotPasswordRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'forgot-password',
        component: () => withRouteSuspense(<ForgotPasswordPage />),
    });

    const verifyOtpRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'verify-otp',
        component: () => withRouteSuspense(<VerifyOtpPage />),
        validateSearch: (search: Record<string, unknown>) => {
            return z
                .object({
                    email: z.string().optional(),
                    type: z.string().optional(),
                    redirect: z.string().optional(),
                })
                .parse(search);
        },
    });

    const resetPasswordRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'reset-password',
        component: () => withRouteSuspense(<ResetPasswordPage />),
        validateSearch: (search: Record<string, unknown>) => {
            return z
                .object({
                    email: z.string().optional(),
                    otp: z.string().optional(),
                })
                .parse(search);
        },
    });

    const setPasswordRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'set-password',
        component: () => withRouteSuspense(<SetPasswordPage />),
    });

    return [
        authIndexRoute,
        loginRoute,
        registerRoute,
        forgotPasswordRoute,
        verifyOtpRoute,
        resetPasswordRoute,
        setPasswordRoute,
    ];
};
