import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
    subscriptionService,
    type SubscriptionPlanCode,
} from '../../services/subscription.service';

export function BillingPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanCode>('starter');

    const searchParams = useSearch({ from: '/app/billing' }) as any;
    const requestedPlanCode = searchParams?.plan_code as SubscriptionPlanCode | undefined;

    const loadData = async () => {
        setLoading(true);
        try {
            const overview = await subscriptionService.getBillingOverview();
            const sub = overview?.current_subscription ?? null;
            const pays = Array.isArray(overview?.payment_history) ? overview.payment_history : [];
            setSubscription(sub);
            setPayments(pays);
            setSelectedPlan(
                (requestedPlanCode as SubscriptionPlanCode | undefined) ||
                    (sub?.subscription_plan?.plan_code as SubscriptionPlanCode) ||
                    'starter',
            );
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to load billing data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    useEffect(() => {
        if (requestedPlanCode) {
            setSelectedPlan(requestedPlanCode);
        }
    }, [requestedPlanCode]);

    const handlePrintInvoice = async (paymentId: number) => {
        try {
            const pdfBlob = await subscriptionService.downloadPaymentInvoice(paymentId);
            const fileUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = `invoice-${paymentId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(fileUrl);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to print invoice');
        }
    };

    return (
        <ProtectedRoute
            allowedRoles={['SUPER_ADMIN', 'SUPER ADMIN', 'super_admin', 'OWNER']}
            requireFacility={false}
        >
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">
                        Billing & Subscription
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        View current subscription and invoice history, then renew or buy a plan.
                    </p>
                </div>

                {loading ? (
                    <div className="text-sm text-slate-500">Loading billing details...</div>
                ) : (
                    <>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                            <div className="grid md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                                        Current status
                                    </p>
                                    <p className="text-lg font-black text-healthcare-dark dark:text-white mt-1">
                                        {subscription?.status || 'No subscription'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                                        Current plan
                                    </p>
                                    <p className="text-lg font-black text-healthcare-dark dark:text-white mt-1">
                                        {subscription?.subscription_plan?.name || 'Not subscribed'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                                        Next billing date
                                    </p>
                                    <p className="text-lg font-black text-healthcare-dark dark:text-white mt-1">
                                        {subscription?.next_billing_at
                                            ? new Date(subscription.next_billing_at).toLocaleDateString()
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                                        Expiry
                                    </p>
                                    <p className="text-lg font-black text-healthcare-dark dark:text-white mt-1">
                                        {subscription?.current_period_end_at
                                            ? new Date(subscription.current_period_end_at).toLocaleDateString()
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <CreditCard size={16} />
                                    <h2 className="font-black">Invoices / Payments</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate({
                                            to: '/checkout' as any,
                                            search: {
                                                mode: 'renew',
                                                plan:
                                                    (subscription?.subscription_plan?.plan_code as SubscriptionPlanCode | undefined) ||
                                                    selectedPlan,
                                            } as any,
                                        } as any)
                                    }
                                    className="px-4 py-2.5 bg-healthcare-primary text-white rounded-xl font-bold text-sm"
                                >
                                    Renew current subscription
                                </button>
                            </div>
                            {payments.length === 0 ? (
                                <p className="text-sm text-slate-500">No invoices yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {payments.map((p) => (
                                        <div
                                            key={p.id}
                                            className="flex flex-wrap items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-xl"
                                        >
                                            <div>
                                                <p className="font-bold text-sm">
                                                    Invoice #{p.id}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {p.status} • {p.provider || 'provider pending'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-black">
                                                    RWF {Number(p.amount_rwf || 0).toLocaleString()}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handlePrintInvoice(Number(p.id))}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
                                                >
                                                    Print invoice
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate({
                                                            to: '/checkout' as any,
                                                            search: {
                                                                mode: 'renew',
                                                                plan:
                                                                    (subscription?.subscription_plan?.plan_code as SubscriptionPlanCode | undefined) ||
                                                                    selectedPlan,
                                                            } as any,
                                                        } as any)
                                                    }
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
                                                >
                                                    Renew
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}

