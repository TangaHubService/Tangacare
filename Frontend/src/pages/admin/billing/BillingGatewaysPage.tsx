import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminBillingService } from '../../../services/admin-billing.service';

export function BillingGatewaysPage() {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await adminBillingService.getGateways();
            setRows(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load gateways');
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
                <h1 className="text-2xl font-black">Payment Gateways</h1>
                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="text-left p-3">Name</th>
                                    <th className="text-left p-3">Code</th>
                                    <th className="text-left p-3">Active</th>
                                    <th className="text-left p-3">Updated</th>
                                    <th className="text-left p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="p-3">{r.name}</td>
                                        <td className="p-3">{r.code}</td>
                                        <td className="p-3">{r.is_active ? 'Yes' : 'No'}</td>
                                        <td className="p-3">{r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}</td>
                                        <td className="p-3">
                                            <button
                                                className="px-2 py-1 rounded bg-healthcare-primary text-white text-xs font-bold"
                                                onClick={async () => {
                                                    try {
                                                        await adminBillingService.updateGateway(r.id, { is_active: !r.is_active });
                                                        toast.success('Gateway updated');
                                                        await load();
                                                    } catch (e: any) {
                                                        toast.error(e?.response?.data?.message || 'Failed to update gateway');
                                                    }
                                                }}
                                            >
                                                {r.is_active ? 'Disable' : 'Enable'}
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

