import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminBillingService } from '../../../services/admin-billing.service';

export function BillingSubscriptionsPage() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<any[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminBillingService.getSubscriptions({ page: 1, limit: 50 });
            setRows(res?.data || []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load subscriptions');
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
                <h1 className="text-2xl font-black">Subscriptions</h1>
                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="text-left p-3">Organization</th>
                                    <th className="text-left p-3">Plan</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">Current Period</th>
                                    <th className="text-left p-3">Next Billing</th>
                                    <th className="text-left p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="p-3">{r.organization?.name || r.organization_id}</td>
                                        <td className="p-3">{r.subscription_plan?.name || r.subscription_plan_id}</td>
                                        <td className="p-3">{r.status}</td>
                                        <td className="p-3">{r.current_period_start_at || r.current_period_end_at ? `${r.current_period_start_at ? new Date(r.current_period_start_at).toLocaleDateString() : '—'} - ${r.current_period_end_at ? new Date(r.current_period_end_at).toLocaleDateString() : '—'}` : '—'}</td>
                                        <td className="p-3">{r.next_billing_at ? new Date(r.next_billing_at).toLocaleDateString() : '—'}</td>
                                        <td className="p-3 flex gap-2">
                                            <button
                                                className="px-2 py-1 rounded bg-slate-100 text-xs font-bold"
                                                onClick={async () => {
                                                    try {
                                                        await adminBillingService.extendTrial(r.id, 7);
                                                        toast.success('Trial extended');
                                                        await load();
                                                    } catch (e: any) {
                                                        toast.error(e?.response?.data?.message || 'Failed to extend trial');
                                                    }
                                                }}
                                            >
                                                +7d Trial
                                            </button>
                                            <button
                                                className="px-2 py-1 rounded bg-healthcare-primary text-white text-xs font-bold"
                                                onClick={async () => {
                                                    try {
                                                        await adminBillingService.updateSubscriptionStatus(r.id, 'active');
                                                        toast.success('Marked active');
                                                        await load();
                                                    } catch (e: any) {
                                                        toast.error(e?.response?.data?.message || 'Failed to update status');
                                                    }
                                                }}
                                            >
                                                Mark Active
                                            </button>
                                        </td>
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

