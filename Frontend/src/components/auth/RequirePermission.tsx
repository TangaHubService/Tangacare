import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from '@tanstack/react-router';
import { isSuperAdmin } from '../../types/auth';
import type { Permission } from '../../types/auth';

interface RequirePermissionProps {
    permission?: Permission;
    permissions?: Permission[];
    children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
    permission,
    permissions,
    children,
}) => {
    const { can, user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-healthcare-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        const Nav = Navigate as any;
        return <Nav to="/auth/login" search={{}} />;
    }

    // Super Admins and Owners bypass all permission checks
    if (isSuperAdmin(user.role) || user.role?.toString().toUpperCase() === 'OWNER') {
        return <>{children}</>;
    }

    // Check permissions
    const requiredList = permissions || (permission ? [permission] : []);
    const hasAny = requiredList.some((p) => can(p));

    if (requiredList.length > 0 && !hasAny) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-healthcare-surface p-10">
                <div className="glass-card p-10 max-w-md w-full text-center space-y-4 rounded-2xl border-2 border-red-100">
                    <div className="flex justify-center">
                        <div className="p-3 bg-red-100 rounded-full text-red-600">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-8 h-8"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                                />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-healthcare-dark">Access Denied</h2>
                        <p className="text-slate-500 text-sm mt-2">
                            You do not have permission to access this resource. Required permission:{' '}
                            <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                                {requiredList.join(' OR ')}
                            </code>
                        </p>
                    </div>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-black hover:bg-slate-200 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
