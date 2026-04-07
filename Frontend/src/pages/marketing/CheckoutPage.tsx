import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { CreditCard, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    subscriptionService,
    type BillingDurationMonths,
    type PaymentMethodPreference,
    type SubscriptionPlanCode,
} from '../../services/subscription.service';

const PLAN_OPTIONS: Array<{ code: Exclude<SubscriptionPlanCode, 'enterprise'>; label: string; monthlyPriceRwf: number }> = [
    { code: 'starter', label: 'Starter', monthlyPriceRwf: 35000 },
    { code: 'pro', label: 'Pro', monthlyPriceRwf: 75000 },
    { code: 'business', label: 'Business', monthlyPriceRwf: 100000 },
    { code: 'test', label: 'Test Plan', monthlyPriceRwf: 100 },
];

const DURATION_OPTIONS: Array<{ value: BillingDurationMonths; label: string }> = [
    { value: 1, label: '1 Month' },
    { value: 3, label: '3 Months' },
    { value: 12, label: '12 Months (Save 20%)' },
];

export function CheckoutPage() {
    const redirectToLogin = () => {
        const checkoutPath = `/checkout?plan=${planCode}&mode=${requestedMode}`;
        navigate({ to: '/auth/login' as any, search: { redirect: checkoutPath } as any });
    };

    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const search = useSearch({ from: '/checkout' }) as any;
    const requestedPlan = (search?.plan as SubscriptionPlanCode | undefined) ?? 'starter';
    const requestedMode = (search?.mode as 'purchase' | 'renew' | undefined) ?? 'purchase';

    const [planCode, setPlanCode] = useState<SubscriptionPlanCode>(
        requestedPlan === 'enterprise' ? 'starter' : requestedPlan,
    );
    const [durationMonths, setDurationMonths] = useState<BillingDurationMonths>(1);
    const [summary, setSummary] = useState<any | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState(false);
    const [paymentInstruction, setPaymentInstruction] = useState<string | null>(null);
    const [paymentOutcome, setPaymentOutcome] = useState<'pending' | 'success' | 'failed' | null>(null);
    const [method, setMethod] = useState<PaymentMethodPreference>('mtn_momo');
    const [phone, setPhone] = useState((user as any)?.phone_number || (user as any)?.phoneNumber || '');

    useEffect(() => {
        if (requestedPlan === 'enterprise') {
            toast('Enterprise plan is handled by sales. Contact us for onboarding.', { icon: '📩' });
            navigate({ to: '/' as any, hash: 'contact', search: {} as any });
            return;
        }
        if (!PLAN_OPTIONS.some((p) => p.code === requestedPlan)) {
            setPlanCode('starter');
            return;
        }
        setPlanCode(requestedPlan);
    }, [requestedPlan, navigate]);

    useEffect(() => {
        const loadSummary = async () => {
            if (!isAuthenticated) return;
            try {
                setLoadingSummary(true);
                const response = await subscriptionService.getCheckoutSummary({
                    plan_code: planCode,
                    duration_months: durationMonths,
                });
                setSummary(response);
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Failed to load checkout summary');
                setSummary(null);
            } finally {
                setLoadingSummary(false);
            }
        };
        void loadSummary();
    }, [isAuthenticated, planCode, durationMonths]);

    const fallbackSummary = useMemo(() => {
        const selectedPlan = PLAN_OPTIONS.find((p) => p.code === planCode) || PLAN_OPTIONS[0];
        const base = selectedPlan.monthlyPriceRwf * durationMonths;
        const discountPercent = durationMonths === 12 ? 20 : 0;
        const discountAmount = Math.round(base * (discountPercent / 100));
        return {
            plan_name: selectedPlan.label,
            monthly_price_rwf: selectedPlan.monthlyPriceRwf,
            base_amount_rwf: base,
            discount_percent: discountPercent,
            discount_amount_rwf: discountAmount,
            total_amount_rwf: base - discountAmount,
            duration_months: durationMonths,
        };
    }, [planCode, durationMonths]);

    const checkoutSummary = summary ?? fallbackSummary;
    const canPaySelectedPlan = !!checkoutSummary && Number(checkoutSummary.total_amount_rwf || 0) > 0;

    const confirmPay = async () => {
        if (!isAuthenticated) {
            toast.error('Please login to complete payment');
            redirectToLogin();
            return;
        }
        if (!phone.trim()) {
            toast.error('Phone number is required');
            return;
        }
        if (!canPaySelectedPlan) {
            toast.error('Selected plan is not payable online. Please contact sales.');
            return;
        }

        try {
            setSubmitting(true);
            const normalizedPhone = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
            const toE164Rwanda = (value: string) => {
                if (value.startsWith('+')) return value;
                if (value.startsWith('0')) return `+250${value.slice(1)}`;
                if (value.startsWith('250')) return `+${value}`;
                return value;
            };
            const e164Phone = toE164Rwanda(normalizedPhone);
            const result = await subscriptionService.payNow({
                plan_code: planCode,
                phone_number: e164Phone,
                payment_method_preference: method,
                duration_months: durationMonths,
            });
            setPaymentModalOpen(false);
            setPaymentStatusModalOpen(true);
            setPaymentInstruction((result?.instruction as string | undefined) ?? null);
            setPaymentOutcome(null);

            toast('Payment initiated. Please confirm the popup request on your phone.', { icon: '📱' });

            const status = String(result?.payment_status || '').toLowerCase();
            if (status === 'success' || status === 'successful') {
                setPaymentOutcome('success');
                toast.success(requestedMode === 'renew' ? 'Renewal successful' : 'Subscription activated');
                setTimeout(() => {
                    navigate({ to: '/app' as any, search: {} as any });
                }, 900);
                return;
            }

            if (status === 'failed' || status === 'failure') {
                setPaymentOutcome('failed');
                toast.error('Payment failed. No successful payment record was created.');
                return;
            }

            // Wait for webhook-driven status updates by polling payment records.
            const ref = result?.ref as string | undefined;
            if (!ref) {
                setPaymentOutcome('pending');
                toast.error('Payment is pending. Please refresh billing later.');
                return;
            }

            const timeoutMs = 3 * 60 * 1000;
            const intervalMs = 3000;
            const timeoutAt = Date.now() + timeoutMs;
            let finalOutcome: 'pending' | 'success' | 'failed' = 'pending';

            while (Date.now() < timeoutAt) {
                const payments = await subscriptionService.getMyPayments();
                const matched = payments.find((p: any) => p.gateway_ref === ref);
                const paymentStatus = String(matched?.status || '').toLowerCase();
                if (paymentStatus === 'success') {
                    finalOutcome = 'success';
                    break;
                }
                if (paymentStatus === 'failed') {
                    finalOutcome = 'failed';
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }

            setPaymentOutcome(finalOutcome);
            if (finalOutcome === 'success') {
                toast.success(requestedMode === 'renew' ? 'Renewal successful' : 'Subscription activated');
                setTimeout(() => {
                    navigate({ to: '/app' as any, search: {} as any });
                }, 900);
            } else if (finalOutcome === 'failed') {
                toast.error('Payment failed. Transaction was not confirmed.');
            } else {
                toast.error('Still waiting for webhook confirmation. You can retry or check billing page.');
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Payment failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">Subscription checkout</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {requestedMode === 'renew' ? 'Renew your plan in a few clicks.' : 'Complete your purchase in one step.'}
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Plan</label>
                            <select
                                value={planCode}
                                onChange={(e) => setPlanCode(e.target.value as SubscriptionPlanCode)}
                                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800"
                            >
                                {PLAN_OPTIONS.map((p) => (
                                    <option key={p.code} value={p.code}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Billing period</label>
                            <select
                                value={durationMonths}
                                onChange={(e) => setDurationMonths(Number(e.target.value) as BillingDurationMonths)}
                                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800"
                            >
                                {DURATION_OPTIONS.map((d) => (
                                    <option key={d.value} value={d.value}>
                                        {d.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (!isAuthenticated) {
                                    toast.error('Please login to continue');
                                    redirectToLogin();
                                    return;
                                }
                                if (!canPaySelectedPlan) {
                                    toast.error('Selected plan is not payable online. Please contact sales.');
                                    return;
                                }
                                setPaymentModalOpen(true);
                            }}
                            disabled={submitting || loadingSummary}
                            className="w-full py-3 rounded-xl bg-healthcare-primary text-white font-bold disabled:opacity-60"
                        >
                            {submitting ? 'Processing payment...' : canPaySelectedPlan ? 'Continue' : 'Contact sales'}
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <h2 className="font-black text-healthcare-dark dark:text-white">Order summary</h2>
                        {loadingSummary ? (
                            <p className="text-sm text-slate-500 mt-3">Loading summary...</p>
                        ) : !checkoutSummary ? (
                            <p className="text-sm text-slate-500 mt-3">Plan pricing unavailable.</p>
                        ) : (
                            <div className="space-y-2 mt-3 text-sm">
                                <div className="flex justify-between">
                                    <span>Plan</span>
                                    <span className="font-semibold">{checkoutSummary.plan_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Duration</span>
                                    <span className="font-semibold">{checkoutSummary.duration_months} month(s)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Base price</span>
                                    <span>RWF {Number(checkoutSummary.base_amount_rwf || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Discount</span>
                                    <span>
                                        {checkoutSummary.discount_percent}% (-RWF{' '}
                                        {Number(checkoutSummary.discount_amount_rwf || 0).toLocaleString()})
                                    </span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-black">
                                    <span>Total</span>
                                    <span>RWF {Number(checkoutSummary.total_amount_rwf || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {paymentModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                        <h3 className="text-lg font-black text-healthcare-dark dark:text-white">Payment method</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setMethod('mtn_momo')}
                                className={`p-3 rounded-xl border-2 flex items-center gap-2 ${method === 'mtn_momo' ? 'border-healthcare-primary/50 bg-healthcare-primary/5' : 'border-slate-200 dark:border-slate-700'}`}
                            >
                                <Smartphone size={16} /> MTN MoMo
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('mobile_money')}
                                className={`p-3 rounded-xl border-2 flex items-center gap-2 ${method === 'mobile_money' ? 'border-healthcare-primary/50 bg-healthcare-primary/5' : 'border-slate-200 dark:border-slate-700'}`}
                            >
                                <Smartphone size={16} /> Airtel Money
                            </button>
                            <button
                                type="button"
                                disabled
                                aria-disabled="true"
                                className="p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 opacity-60 cursor-not-allowed"
                                title="Card payment coming soon"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <CreditCard size={16} />
                                    Card
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Coming soon
                                </span>
                            </button>
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-wider font-bold text-slate-500">Phone number</label>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="07XXXXXXXX or +2507XXXXXXXX"
                                className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">
                                Rwanda format accepted: <span className="font-semibold">07...</span>,{' '}
                                <span className="font-semibold">2507...</span>, or{' '}
                                <span className="font-semibold">+2507...</span>.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentModalOpen(false)}
                                disabled={submitting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmPay()}
                                disabled={submitting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-healthcare-primary text-white font-bold inline-flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Paying...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={16} />
                                        Confirm payment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {paymentStatusModalOpen && (
                <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                        <h3 className="text-lg font-black text-healthcare-dark dark:text-white">Payment status</h3>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800 text-sm">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">
                                Confirm the payment popup request on your phone.
                            </p>
                            <p className="text-slate-500 mt-1">
                                {paymentInstruction ||
                                    (method === 'mtn_momo'
                                        ? 'Dial *182*7*1# to approve if prompted.'
                                        : 'Approve Airtel Money cash-in prompt on your phone.')}
                            </p>
                        </div>

                        {paymentOutcome === null && (
                            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <span className="w-5 h-5 border-2 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
                                Waiting for payment confirmation...
                            </div>
                        )}
                        {paymentOutcome === 'success' && (
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                Payment confirmed and recorded successfully. Redirecting...
                            </p>
                        )}
                        {paymentOutcome === 'failed' && (
                            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                                Payment failed. No confirmed transaction was recorded.
                            </p>
                        )}
                        {paymentOutcome === 'pending' && (
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                                Payment confirmation is still pending. Check billing page or retry.
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentStatusModalOpen(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"
                                disabled={submitting && paymentOutcome === null}
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate({ to: '/app/billing' as any, search: {} as any })}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-healthcare-primary text-white font-bold"
                            >
                                Open billing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

