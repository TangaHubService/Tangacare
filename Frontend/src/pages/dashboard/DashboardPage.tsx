import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { DashboardOwner } from '../../components/dashboard/DashboardOwner';
import { Navigate } from '@tanstack/react-router';

export function DashboardPage() {
    const { user, facilityId, organizationId } = useAuth();

    const ownerRoles = [
        'OWNER',
        'ADMIN',
        'FACILITY_ADMIN',
        'FACILITY ADMIN',
        'STORE_MANAGER',
        'STORE MANAGER',
        'SUPER_ADMIN',
        'Admin',
        'Super Admin',
    ];

    const userRole = user?.role?.toUpperCase() || '';
    const isOwnerView = ownerRoles.some((role) => role.toUpperCase() === userRole);
    const operationalRouteByRole: Record<string, string> = {
        PHARMACIST: '/app/dispensing',
        CASHIER: '/app/dispensing',
        AUDITOR: '/app/stock-movements',
        DOCTOR: '/app/inventory',
    };
    const operationalRoute = operationalRouteByRole[userRole] || '/app/inventory';

    if (userRole === 'USER' || userRole === 'user') {
        return <Navigate to="/app/onboarding" />;
    }

    return (
        <ProtectedRoute
            allowedRoles={[
                'Admin',
                'Pharmacist',
                'Super Admin',
                'ADMIN',
                'PHARMACIST',
                'SUPER_ADMIN',
                'OWNER',
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'CASHIER',
                'STORE_MANAGER',
                'STORE MANAGER',
                'AUDITOR',
                'USER',
                'user',
            ]}
        >
            {isOwnerView ? (
                facilityId && organizationId ? (
                    <DashboardOwner facilityId={facilityId} />
                ) : organizationId || user?.organization_id ? (
                    <DashboardOwner facilityId={null} />
                ) : (
                    <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="w-20 h-20 bg-healthcare-primary/10 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl text-healthcare-primary font-black">!</span>
                        </div>
                        <h2 className="text-2xl font-black text-healthcare-dark dark:text-white uppercase tracking-tight">
                            Organization Context Required
                        </h2>
                        <p className="text-slate-500 max-w-sm mt-2 font-bold uppercase text-xs tracking-widest">
                            Please ensure you are within an organization context to view analytics.
                        </p>
                    </div>
                )
            ) : (
                <Navigate to={operationalRoute as any} search={{} as any} />
            )}
        </ProtectedRoute>
    );
}
