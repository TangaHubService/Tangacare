import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminBillingService } from '../../../services/admin-billing.service';

export function BillingTrialsPage() {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await adminBillingService.getTrials();
            setRows(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load trials');
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
                <h1 className="text-2xl font-black">Trials</h1>
                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="text-left p-3">Organization</th>
                                    <th className="text-left p-3">Trial End</th>
                                    <th className="text-left p-3">Days Left</th>
                                    <th className="text-left p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => {
                                    const end = r.trial_end_at ? new Date(r.trial_end_at) : null;
                                    const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                                    return (
                                        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="p-3">{r.organization?.name || '—'}</td>
                                            <td className="p-3">{end ? end.toLocaleDateString() : '—'}</td>
                                            <td className="p-3">{daysLeft != null ? daysLeft : '—'}</td>
                                            <td className="p-3">{r.status}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

