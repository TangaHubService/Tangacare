import { Outlet } from '@tanstack/react-router';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { PERMISSIONS } from '../../types/auth';

export function ProcurementLayout() {
    return (
        <ProtectedRoute
            requiredPermissions={[PERMISSIONS.PROCUREMENT_READ]}
            requireFacility
        >
            <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </ProtectedRoute>
    );
}
