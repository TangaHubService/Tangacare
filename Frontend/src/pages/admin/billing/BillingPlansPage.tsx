import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminBillingService } from '../../../services/admin-billing.service';

export function BillingPlansPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await adminBillingService.getPlans();
            setPlans(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load plans');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    return (
        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SUPER ADMIN', 'super_admin']} requireFacility={false}>
            <div className="p-6 space-y-4">
                <h1 className="text-2xl font-black">Plans</h1>
                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="text-left p-3">Name</th>
                                    <th className="text-left p-3">Code</th>
                                    <th className="text-left p-3">Price</th>
                                    <th className="text-left p-3">Trial Days</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plans.map((p: any) => (
                                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="p-3">{p.name}</td>
                                        <td className="p-3">{p.plan_code}</td>
                                        <td className="p-3">{p.price_rwf_monthly == null ? 'Custom' : `RWF ${Number(p.price_rwf_monthly).toLocaleString()}`}</td>
                                        <td className="p-3">{p.trial_days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

