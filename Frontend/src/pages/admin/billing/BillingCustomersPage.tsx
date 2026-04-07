import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminBillingService } from '../../../services/admin-billing.service';

export function BillingCustomersPage() {
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminBillingService.getCustomers({ search, page: 1, limit: 50 });
            setCustomers(res?.data || []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load customers');
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
                <h1 className="text-2xl font-black">Customers Billing</h1>
                <div className="flex gap-2">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search organization..."
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                    <button onClick={() => void load()} className="px-3 py-2 rounded-lg bg-healthcare-primary text-white text-sm font-bold">
                        Search
                    </button>
                </div>
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
                                    <th className="text-left p-3">Trial End</th>
                                    <th className="text-left p-3">Next Billing</th>
                                    <th className="text-left p-3">Last Payment</th>
                                    <th className="text-left p-3">Payments</th>
                                    <th className="text-left p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c: any) => (
                                    <tr key={c.organization.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="p-3">{c.organization.name}</td>
                                        <td className="p-3">{c.subscription?.subscription_plan?.name || '—'}</td>
                                        <td className="p-3">{c.subscription?.status || 'none'}</td>
                                        <td className="p-3">{c.subscription?.trial_end_at ? new Date(c.subscription.trial_end_at).toLocaleDateString() : '—'}</td>
                                        <td className="p-3">{c.subscription?.next_billing_at ? new Date(c.subscription.next_billing_at).toLocaleDateString() : '—'}</td>
                                        <td className="p-3">{c.lastPaymentDate ? new Date(c.lastPaymentDate).toLocaleDateString() : '—'}</td>
                                        <td className="p-3">{c.totalPayments}</td>
                                        <td className="p-3">
                                            <a
                                                href={`/app/admin/billing/customers/${c.organization.id}`}
                                                className="text-xs font-bold text-healthcare-primary underline"
                                            >
                                                View details
                                            </a>
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

