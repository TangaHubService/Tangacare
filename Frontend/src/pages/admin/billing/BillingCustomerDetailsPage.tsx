import { useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import { adminBillingService } from '../../../services/admin-billing.service';

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'expired', 'cancelled'];

export function BillingCustomerDetailsPage() {
    const { organizationId } = useParams({ from: '/app/admin/billing/customers/$organizationId' });
    const orgIdNum = useMemo(() => Number(organizationId), [organizationId]);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [trialDays, setTrialDays] = useState(7);
    const [status, setStatus] = useState('active');
    const [plans, setPlans] = useState<any[]>([]);
    const [targetPlanId, setTargetPlanId] = useState<number | null>(null);
    const [effectiveMode, setEffectiveMode] = useState<'immediate' | 'next_cycle'>('immediate');
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminBillingService.getCustomerByOrganizationId(orgIdNum);
            const plansRes = await adminBillingService.getPlans();
            setData(res || null);
            const planRows = plansRes?.data || plansRes || [];
            setPlans(planRows);
            if (res?.subscription?.status) setStatus(String(res.subscription.status));
            if (!targetPlanId && planRows.length > 0) {
                const fallback = planRows.find((p: any) => p.id !== res?.subscription?.subscription_plan_id) || planRows[0];
                setTargetPlanId(Number(fallback.id));
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load customer details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!Number.isNaN(orgIdNum) && orgIdNum > 0) {
            void load();
        }
    }, [orgIdNum]);

    return (
        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SUPER ADMIN', 'super_admin']} requireFacility={false}>
            <div className="p-6 space-y-4">
                <h1 className="text-2xl font-black">Customer Billing Details</h1>
                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : !data?.organization ? (
                    <p className="text-sm text-red-500">Customer not found.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                <p className="text-xs text-slate-500">Organization</p>
                                <p className="font-bold">{data.organization.name}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                <p className="text-xs text-slate-500">Current Plan</p>
                                <p className="font-bold">{data.subscription?.subscription_plan?.name || 'No subscription'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                <p className="text-xs text-slate-500">Status</p>
                                <p className="font-bold">{data.subscription?.status || 'none'}</p>
                            </div>
                        </div>
                        {data.pendingPlanChange && (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-900/20 p-4">
                                <p className="text-xs text-amber-700 dark:text-amber-300">Pending plan change</p>
                                <p className="font-bold text-amber-900 dark:text-amber-100">
                                    {data.pendingPlanChange.from_plan?.name || `Plan #${data.pendingPlanChange.from_plan_id}`}
                                    {' -> '}
                                    {data.pendingPlanChange.to_plan?.name || `Plan #${data.pendingPlanChange.to_plan_id}`}
                                </p>
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    Effective on {new Date(data.pendingPlanChange.effective_date).toLocaleString()}
                                </p>
                                {data.subscription && (
                                    <button
                                        className="mt-3 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold"
                                        onClick={() => setIsCancelConfirmOpen(true)}
                                    >
                                        Cancel pending change
                                    </button>
                                )}
                            </div>
                        )}

                        {data.subscription ? (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                                <h2 className="text-lg font-extrabold">Quick Actions</h2>
                                <div className="flex flex-wrap gap-2 items-end">
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500">Extend trial (days)</p>
                                        <input
                                            type="number"
                                            min={1}
                                            value={trialDays}
                                            onChange={(e) => setTrialDays(Number(e.target.value || 1))}
                                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 w-32"
                                        />
                                    </div>
                                    <button
                                        className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold"
                                        onClick={async () => {
                                            try {
                                                await adminBillingService.extendTrial(data.subscription.id, Math.max(1, trialDays));
                                                toast.success('Trial updated');
                                                await load();
                                            } catch (error: any) {
                                                toast.error(error?.response?.data?.message || 'Failed to extend trial');
                                            }
                                        }}
                                    >
                                        Apply Trial Extension
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 items-end">
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500">Set status</p>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value)}
                                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 min-w-40"
                                        >
                                            {STATUS_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        className="px-3 py-2 rounded-lg bg-healthcare-primary text-white text-sm font-bold"
                                        onClick={async () => {
                                            try {
                                                await adminBillingService.updateSubscriptionStatus(data.subscription.id, status);
                                                toast.success('Subscription status updated');
                                                await load();
                                            } catch (error: any) {
                                                toast.error(error?.response?.data?.message || 'Failed to update status');
                                            }
                                        }}
                                    >
                                        Update Status
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 items-end">
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500">Change plan</p>
                                        <select
                                            value={targetPlanId ?? ''}
                                            onChange={(e) => setTargetPlanId(Number(e.target.value))}
                                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 min-w-52"
                                        >
                                            {plans.map((plan: any) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name} ({plan.plan_code}) - RWF {Number(plan.price_rwf_monthly || 0).toLocaleString()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500">Effective mode</p>
                                        <select
                                            value={effectiveMode}
                                            onChange={(e) => setEffectiveMode(e.target.value as 'immediate' | 'next_cycle')}
                                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 min-w-40"
                                        >
                                            <option value="immediate">Immediate</option>
                                            <option value="next_cycle">Next billing cycle</option>
                                        </select>
                                    </div>
                                    <button
                                        className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
                                        disabled={!targetPlanId || targetPlanId === data.subscription.subscription_plan_id}
                                        onClick={async () => {
                                            try {
                                                if (!targetPlanId) return;
                                                await adminBillingService.changePlan(data.subscription.id, targetPlanId, effectiveMode);
                                                toast.success(
                                                    effectiveMode === 'immediate'
                                                        ? 'Plan changed successfully'
                                                        : 'Plan change scheduled for next cycle',
                                                );
                                                await load();
                                            } catch (error: any) {
                                                toast.error(error?.response?.data?.message || 'Failed to change plan');
                                            }
                                        }}
                                    >
                                        Apply Plan Change
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                <p className="text-sm text-slate-500">No subscription exists for this organization yet.</p>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="text-left p-3">Date</th>
                                        <th className="text-left p-3">Amount (RWF)</th>
                                        <th className="text-left p-3">Status</th>
                                        <th className="text-left p-3">Gateway</th>
                                        <th className="text-left p-3">Provider</th>
                                        <th className="text-left p-3">Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.payments || []).map((p: any) => (
                                        <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="p-3">{new Date(p.created_at).toLocaleString()}</td>
                                            <td className="p-3">{Number(p.amount_rwf || 0).toLocaleString()}</td>
                                            <td className="p-3">{p.status}</td>
                                            <td className="p-3">{p.gateway || '—'}</td>
                                            <td className="p-3">{p.provider || '—'}</td>
                                            <td className="p-3">{p.gateway_ref || '—'}</td>
                                        </tr>
                                    ))}
                                    {!data.payments?.length && (
                                        <tr>
                                            <td className="p-3 text-slate-500" colSpan={6}>
                                                No payment history for this customer.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
            <ConfirmModal
                isOpen={isCancelConfirmOpen}
                onClose={() => setIsCancelConfirmOpen(false)}
                onConfirm={async () => {
                    if (!data?.subscription?.id) return;
                    setCancelLoading(true);
                    try {
                        await adminBillingService.cancelPendingPlanChange(data.subscription.id);
                        toast.success('Pending plan change cancelled');
                        setIsCancelConfirmOpen(false);
                        await load();
                    } catch (error: any) {
                        toast.error(error?.response?.data?.message || 'Failed to cancel pending change');
                    } finally {
                        setCancelLoading(false);
                    }
                }}
                loading={cancelLoading}
                title="Cancel Pending Plan Change"
                message="Are you sure you want to cancel this scheduled plan change? The subscription will remain on the current plan."
                confirmText="Cancel change"
                variant="warning"
            />
        </ProtectedRoute>
    );
}
