import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from '@tanstack/react-router';
import { ManagementOverviewPage } from './ManagementOverviewPage';

/**
 * Primary dashboard landing: management overview with KPIs and trends.
 */
export function DashboardPage() {
    const { user } = useAuth();

    const normalizedOnboardingRole = (user?.role || '').toString().toLowerCase().replace(/[\s_]+/g, '');
    if (normalizedOnboardingRole === 'user') {
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
                'STORE_KEEPER',
                'STORE KEEPER',
                'AUDITOR',
                'DOCTOR',
            ]}
        >
            <ManagementOverviewPage />
        </ProtectedRoute>
    );
}
