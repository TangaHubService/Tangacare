import React from 'react';
import { Navigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin, type UserRole } from '../../types/auth';

interface ProtectedRouteProps {
    children: React.ReactNode;

    allowedRoles?: (UserRole | string)[];

    requiredPermissions?: string[];

    requireFacility?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requiredPermissions,
    requireFacility,
}) => {
    const { isAuthenticated, isLoading, user, facilityId, can } = useAuth();
    const location = useLocation();
    const role = (user?.role ?? '').toString().toUpperCase().replace(/\s+/g, ' ');
    const isFacilityAdmin = role === 'FACILITY_ADMIN' || role === 'FACILITY ADMIN';
    const isSuperAdminUser = isSuperAdmin(user?.role);
    const isOwner = role === 'OWNER';

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-healthcare-surface">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin"></div>
                    <p className="text-healthcare-dark font-black text-sm animate-pulse">
                        VERIFYING SESSION...
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        const Nav = Navigate as any;
        return <Nav to="/auth/login" search={{ redirect: location.pathname }} />;
    }

    // Redirect users with baseline USER role to onboarding
    if (user && role === 'USER' && !location.pathname.includes('/onboarding')) {
        return <Navigate to="/app/onboarding" />;
    }

    if (requireFacility && isFacilityAdmin && !isSuperAdminUser && user) {
        const hasFacility = facilityId != null || user.facility_id != null;
        if (!hasFacility) {
            return (
                <div className="h-screen w-full flex items-center justify-center bg-healthcare-surface p-10">
                    <div className="glass-card p-10 max-w-md w-full text-center space-y-4">
                        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-8 w-8"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-black text-healthcare-dark">
                            Facility required
                        </h2>
                        <p className="text-slate-500 text-sm">
                            You need to be assigned to a facility to access this page.
                        </p>
                        <a
                            href="/app"
                            className="inline-block px-6 py-2 bg-healthcare-primary text-white rounded-lg text-xs font-black hover:bg-teal-700 transition-all shadow-md"
                        >
                            Go to Dashboard
                        </a>
                    </div>
                </div>
            );
        }
    }

    if (
        requiredPermissions &&
        requiredPermissions.length > 0 &&
        !isSuperAdminUser &&
        !isOwner &&
        !requiredPermissions.some((p) => can(p))
    ) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-healthcare-surface p-10">
                <div className="glass-card p-10 max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-black text-healthcare-dark">Access Denied</h2>
                    <p className="text-slate-500 text-sm">
                        You do not have permission to access this page.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-healthcare-primary text-white rounded-lg text-xs font-black hover:bg-teal-700 transition-all shadow-md"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (
        allowedRoles &&
        allowedRoles.length > 0 &&
        user &&
        !isOwner &&
        !allowedRoles.some((role) => {
            const r1 = String(role)
                .toUpperCase()
                .replace(/[\s_]+/g, ' ');
            const r2 = (user.role || '').toUpperCase().replace(/[\s_]+/g, ' ');
            return r1 === r2;
        })
    ) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-healthcare-surface p-10">
                <div className="glass-card p-10 max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-black text-healthcare-dark">Access Denied</h2>
                    <p className="text-slate-500 text-sm">
                        You do not have the necessary permissions to access this pharmacy module.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-healthcare-primary text-white rounded-lg text-xs font-black hover:bg-teal-700 transition-all shadow-md"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
