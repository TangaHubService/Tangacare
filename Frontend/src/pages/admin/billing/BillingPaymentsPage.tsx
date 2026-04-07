import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminBillingService } from '../../../services/admin-billing.service';

export function BillingPaymentsPage() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<any[]>([]);
    const [status, setStatus] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminBillingService.getPayments({ page: 1, limit: 50, status: status || undefined });
            setRows(res?.data || []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load payments');
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
                <h1 className="text-2xl font-black">Payments</h1>
                <div className="flex gap-2">
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                        <option value="">All statuses</option>
                        <option value="pending">pending</option>
                        <option value="success">success</option>
                        <option value="failed">failed</option>
                    </select>
                    <button onClick={() => void load()} className="px-3 py-2 rounded bg-healthcare-primary text-white text-sm font-bold">Apply</button>
                </div>
                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="text-left p-3">Organization</th>
                                    <th className="text-left p-3">Amount</th>
                                    <th className="text-left p-3">Gateway</th>
                                    <th className="text-left p-3">Provider</th>
                                    <th className="text-left p-3">Transaction Ref</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">Paid At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="p-3">{r.subscription?.organization?.name || '—'}</td>
                                        <td className="p-3">RWF {Number(r.amount_rwf || 0).toLocaleString()}</td>
                                        <td className="p-3">{r.gateway}</td>
                                        <td className="p-3">{r.provider || '—'}</td>
                                        <td className="p-3 font-mono text-xs">{r.gateway_ref}</td>
                                        <td className="p-3">{r.status}</td>
                                        <td className="p-3">{r.paid_at ? new Date(r.paid_at).toLocaleString() : '—'}</td>
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

