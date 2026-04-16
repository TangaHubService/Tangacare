import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { DashboardOwner } from '../../components/dashboard/DashboardOwner';

/**
 * Analytics-focused management dashboard (KPIs, trends). Staff daily landing is Operations Today (`/`).
 */
export function ManagementOverviewPage() {
    const { user, facilityId, organizationId } = useAuth();

    return (
        <ProtectedRoute
            allowedRoles={[
                'Admin',
                'Super Admin',
                'ADMIN',
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'OWNER',
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'STORE_MANAGER',
                'STORE MANAGER',
            ]}
        >
            {facilityId && organizationId ? (
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
            )}
        </ProtectedRoute>
    );
}
