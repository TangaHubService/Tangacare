import { RotateCcw } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { ReturnManagement } from '../../components/pharmacy/returns/ReturnManagement';
import { useAuth } from '../../context/AuthContext';

export function ReturnsPage() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;

    return (
        <ProtectedRoute
            allowedRoles={[
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'CASHIER',
                'PHARMACIST',
                'AUDITOR',
            ]}
            requireFacility
        >
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight text-healthcare-dark dark:text-white">
                        <RotateCcw size={22} className="text-healthcare-primary" />
                        Returns
                    </h1>
                </div>

                {effectiveFacilityId ? (
                    <ReturnManagement facilityId={effectiveFacilityId} />
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                        Facility context is required to manage returns.
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
