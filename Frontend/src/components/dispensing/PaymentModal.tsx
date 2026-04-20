import { useState, useEffect } from 'react';
import {
    X,
    Plus,
    CreditCard,
    Banknote,
    Smartphone,
    CheckCircle2,
    AlertCircle,
    ShieldCheck,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { SalePaymentMethod, InsuranceProvider } from '../../types/pharmacy';
import { pharmacyService } from '../../services/pharmacy.service';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';
import { Drawer } from '../ui/Drawer';

interface Payment {
    id: string;
    method: SalePaymentMethod;
    amount: number;
    reference?: string;
}

interface PaymentModalProps {
    totalAmount: number;
    hasControlledDrugs?: boolean;
    onClose: () => void;
    onConfirm: (
        payments: { method: SalePaymentMethod; amount: number; reference?: string }[],
        patientIdType?: string,
        patientIdNumber?: string,
        insuranceProviderId?: number,
        patientInsuranceNumber?: string,
    ) => void;
    isProcessing?: boolean;
}

const PAYMENT_METHODS: { id: SalePaymentMethod; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { id: 'insurance', label: 'Insurance', icon: ShieldCheck },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'bank', label: 'Bank Transfer', icon: Banknote },
];

type CheckoutStep = 'tenders' | 'insurance' | 'review';

function roundMoneyAmount(amount: number, decimals: number): number {
    if (!Number.isFinite(amount)) return 0;
    if (decimals <= 0) return Math.round(amount);
    const factor = 10 ** decimals;
    return Math.round(amount * factor) / factor;
}

export function PaymentModal({
    totalAmount,
    hasControlledDrugs,
    onClose,
    onConfirm,
    isProcessing,
}: PaymentModalProps) {
    const { formatMoney, config } = useRuntimeConfig();
    const decimals = config?.currencyDecimals ?? 0;

    const [step, setStep] = useState<CheckoutStep>('tenders');
    const [payments, setPayments] = useState<Payment[]>([
        { id: '1', method: 'cash', amount: totalAmount },
    ]);
    const [patientIdType, setPatientIdType] = useState('National ID');
    const [patientIdNumber, setPatientIdNumber] = useState('');
    const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
    const [selectedInsuranceProviderId, setSelectedInsuranceProviderId] = useState<number | undefined>();
    const [patientInsuranceNumber, setPatientInsuranceNumber] = useState('');

    useEffect(() => {
        setStep('tenders');
    }, [totalAmount]);

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const providers = await pharmacyService.getInsuranceProviders();
                setInsuranceProviders(providers);
            } catch (error) {
                console.error('Failed to fetch insurance providers:', error);
            }
        };
        fetchProviders();
    }, []);

    useEffect(() => {
        const insurancePayment = payments.find((p) => p.method === 'insurance');
        if (insurancePayment && selectedInsuranceProviderId) {
            const provider = insuranceProviders.find((p) => p.id === selectedInsuranceProviderId);
            if (provider) {
                const coveragePercent = Number(provider.coverage_percentage);
                let calculatedInsurance = (totalAmount * coveragePercent) / 100;
                if (
                    provider.max_coverage_limit != null &&
                    calculatedInsurance > Number(provider.max_coverage_limit)
                ) {
                    calculatedInsurance = Number(provider.max_coverage_limit);
                }
                const roundedInsurance = roundMoneyAmount(calculatedInsurance, decimals);
                const copayAmount = roundMoneyAmount(totalAmount - roundedInsurance, decimals);
                setPayments([
                    { id: insurancePayment.id, method: 'insurance', amount: roundedInsurance },
                    {
                        id: 'copay-stable',
                        method: 'cash',
                        amount: copayAmount,
                    },
                ]);
            }
        }
    }, [selectedInsuranceProviderId, totalAmount, insuranceProviders, decimals]);

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = roundMoneyAmount(totalAmount - totalPaid, decimals);
    const hasInsurance = payments.some((p) => p.method === 'insurance');
    const selectedProvider = insuranceProviders.find((p) => p.id === selectedInsuranceProviderId);
    const insurancePortion = payments.find((p) => p.method === 'insurance')?.amount ?? 0;
    const patientPortion = roundMoneyAmount(
        payments.filter((p) => p.method !== 'insurance').reduce((s, p) => s + p.amount, 0),
        decimals,
    );

    const addPayment = () => {
        if (balance <= 0) return;
        const newPayment: Payment = {
            id: Math.random().toString(36).substr(2, 9),
            method: 'cash',
            amount: balance > 0 ? balance : 0,
        };
        setPayments([...payments, newPayment]);
    };

    const removePayment = (id: string) => {
        setPayments(payments.filter((p) => p.id !== id));
    };

    const updatePayment = (id: string, field: keyof Payment, value: string | number) => {
        setPayments(payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    };

    const tolerance = decimals <= 0 ? 0.5 : 0.5 / 10 ** decimals;

    const validateControlled = () => {
        if (hasControlledDrugs && !patientIdNumber.trim()) {
            toast.error('Patient ID Number is required for controlled drugs');
            return false;
        }
        return true;
    };

    const submitSale = () => {
        if (Math.abs(balance) > tolerance) {
            toast.error('Payment amount must match total');
            return;
        }
        if (!validateControlled()) return;
        if (hasInsurance && !selectedInsuranceProviderId) {
            toast.error('Insurance provider is required');
            return;
        }
        onConfirm(
            payments.map(({ method, amount, reference }) => ({ method, amount, reference })),
            hasControlledDrugs ? patientIdType : undefined,
            hasControlledDrugs ? patientIdNumber : undefined,
            hasInsurance ? selectedInsuranceProviderId : undefined,
            hasInsurance ? patientInsuranceNumber : undefined,
        );
    };

    const goNextFromTenders = () => {
        if (Math.abs(balance) > tolerance) {
            toast.error('Payment amount must match total');
            return;
        }
        if (hasInsurance) {
            setStep('insurance');
        } else {
            if (!validateControlled()) return;
            submitSale();
        }
    };

    const goNextFromInsurance = () => {
        if (!selectedInsuranceProviderId) {
            toast.error('Select an insurance provider');
            return;
        }
        setStep('review');
    };

    const stepTitle =
        step === 'tenders' ? 'Payment split' : step === 'insurance' ? 'Insurance details' : 'Review & confirm';

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="md"
            title="Checkout"
            subtitle={`${stepTitle} · Total ${formatMoney(totalAmount)}`}
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 w-full rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span className={step === 'tenders' ? 'text-healthcare-primary' : ''}>① Split</span>
                        <ChevronRight size={12} className="text-slate-300" />
                        <span className={step === 'insurance' ? 'text-healthcare-primary' : ''}>② Insurance</span>
                        <ChevronRight size={12} className="text-slate-300" />
                        <span className={step === 'review' ? 'text-healthcare-primary' : ''}>③ Confirm</span>
                    </div>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {step === 'tenders' && (
                        <>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Allocate the total across payment methods. If you use insurance, you will select the
                                provider and policy next; the server recalculates the exact insurance share.
                            </p>
                            <div className="space-y-3">
                                {payments.map((payment, index) => (
                                    <div
                                        key={payment.id}
                                        className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 relative group animate-in slide-in-from-left-2 duration-300"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex gap-3 mb-3">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                    Method
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={payment.method}
                                                        onChange={(e) =>
                                                            updatePayment(
                                                                payment.id,
                                                                'method',
                                                                e.target.value as SalePaymentMethod,
                                                            )
                                                        }
                                                        className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none appearance-none font-bold text-healthcare-dark dark:text-white"
                                                    >
                                                        {PAYMENT_METHODS.map((m) => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                        {(() => {
                                                            const Icon =
                                                                PAYMENT_METHODS.find((m) => m.id === payment.method)
                                                                    ?.icon || Banknote;
                                                            return <Icon size={14} />;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-1/3 space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                    Amount
                                                </label>
                                                <input
                                                    type="number"
                                                    value={payment.amount}
                                                    disabled={payment.method === 'insurance'}
                                                    onChange={(e) =>
                                                        updatePayment(
                                                            payment.id,
                                                            'amount',
                                                            Number(e.target.value),
                                                        )
                                                    }
                                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-right text-healthcare-dark dark:text-white disabled:opacity-70 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                                                />
                                            </div>
                                        </div>

                                        {(payment.method === 'mobile_money' ||
                                            payment.method === 'card' ||
                                            payment.method === 'bank') && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                    Reference / Transaction ID
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter reference number..."
                                                    value={payment.reference || ''}
                                                    onChange={(e) =>
                                                        updatePayment(payment.id, 'reference', e.target.value)
                                                    }
                                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none text-healthcare-dark dark:text-white"
                                                />
                                            </div>
                                        )}

                                        {payment.method === 'insurance' && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                                Provider and policy are set in the next step.
                                            </p>
                                        )}

                                        {payments.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removePayment(payment.id)}
                                                className="absolute -right-2 -top-2 bg-red-100 dark:bg-red-900/50 text-red-500 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {balance > 0 && (
                                <button
                                    type="button"
                                    onClick={addPayment}
                                    className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-healthcare-primary hover:border-healthcare-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-sm font-bold"
                                >
                                    <Plus size={16} />
                                    Add Payment Method
                                </button>
                            )}
                        </>
                    )}

                    {step === 'insurance' && (
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Coverage percentage comes from the provider profile (RSSB, MMI, private, etc.). The
                                register will show patient co-pay vs insurer portion after you confirm.
                            </p>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                    Insurance provider
                                </label>
                                <select
                                    value={selectedInsuranceProviderId ?? ''}
                                    onChange={(e) =>
                                        setSelectedInsuranceProviderId(
                                            e.target.value ? Number(e.target.value) : undefined,
                                        )
                                    }
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                >
                                    <option value="">Select provider…</option>
                                    {insuranceProviders.map((provider) => (
                                        <option key={provider.id} value={provider.id}>
                                            {provider.name} ({provider.type})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedProvider && (
                                <div className="rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 px-3 py-2 text-xs text-teal-900 dark:text-teal-100">
                                    <span className="font-bold">Coverage:</span>{' '}
                                    {Number(selectedProvider.coverage_percentage).toFixed(0)}% of invoice total
                                    {selectedProvider.max_coverage_limit != null && (
                                        <span>
                                            {' '}
                                            · Cap {formatMoney(selectedProvider.max_coverage_limit)}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                    Member / policy number
                                </label>
                                <input
                                    type="text"
                                    placeholder="Policy or card number"
                                    value={patientInsuranceNumber}
                                    onChange={(e) => setPatientInsuranceNumber(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none text-healthcare-dark dark:text-white"
                                />
                            </div>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                                <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Patient pays now
                                    </span>
                                    <span className="text-sm font-black text-healthcare-dark dark:text-white">
                                        {formatMoney(patientPortion)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center px-3 py-2.5">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                        <ShieldCheck size={14} className="text-teal-600" />
                                        Insurance (claim)
                                    </span>
                                    <span className="text-sm font-black text-teal-700 dark:text-teal-300">
                                        {formatMoney(insurancePortion)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
                                    <span className="text-sm font-black">{formatMoney(totalAmount)}</span>
                                </div>
                            </div>
                            {selectedProvider && (
                                <p className="text-[11px] text-slate-500">
                                    {selectedProvider.name} ·{' '}
                                    {Number(selectedProvider.coverage_percentage).toFixed(0)}% coverage
                                </p>
                            )}
                            {hasControlledDrugs && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle size={14} className="text-red-500" />
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                                            Controlled substance — patient ID
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                ID type
                                            </label>
                                            <select
                                                value={patientIdType}
                                                onChange={(e) => setPatientIdType(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                            >
                                                <option value="National ID">National ID</option>
                                                <option value="Passport">Passport</option>
                                                <option value="Health Card">Health Card</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                ID number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="ID number"
                                                value={patientIdNumber}
                                                onChange={(e) => setPatientIdNumber(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'tenders' && hasControlledDrugs && !hasInsurance && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertCircle size={14} className="text-red-500" />
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                                    Controlled substance — patient ID
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                        ID type
                                    </label>
                                    <select
                                        value={patientIdType}
                                        onChange={(e) => setPatientIdType(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                    >
                                        <option value="National ID">National ID</option>
                                        <option value="Passport">Passport</option>
                                        <option value="Health Card">Health Card</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                        ID number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ID number"
                                        value={patientIdNumber}
                                        onChange={(e) => setPatientIdNumber(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-bold">Allocated</span>
                        <span className="font-black text-healthcare-dark dark:text-white">
                            {formatMoney(totalPaid)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-bold">Balance</span>
                        <span
                            className={`font-black ${Math.abs(balance) <= tolerance ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                            {formatMoney(balance)}
                        </span>
                    </div>

                    <div className="flex flex-col gap-2">
                        {step !== 'tenders' && (
                            <button
                                type="button"
                                onClick={() => setStep(step === 'review' ? 'insurance' : 'tenders')}
                                disabled={isProcessing}
                                className="w-full py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                            >
                                <ChevronLeft size={16} />
                                Back
                            </button>
                        )}
                        {step === 'tenders' && (
                            <button
                                type="button"
                                onClick={goNextFromTenders}
                                disabled={Math.abs(balance) > tolerance || isProcessing}
                                className="w-full py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-healthcare-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-healthcare-primary/20 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    'Processing…'
                                ) : hasInsurance ? (
                                    <>
                                        Continue
                                        <ChevronRight size={18} />
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={18} />
                                        Complete sale
                                    </>
                                )}
                            </button>
                        )}
                        {step === 'insurance' && (
                            <button
                                type="button"
                                onClick={goNextFromInsurance}
                                disabled={isProcessing}
                                className="w-full py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-healthcare-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                Review split
                                <ChevronRight size={18} />
                            </button>
                        )}
                        {step === 'review' && (
                            <button
                                type="button"
                                onClick={submitSale}
                                disabled={Math.abs(balance) > tolerance || isProcessing}
                                className="w-full py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-healthcare-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-healthcare-primary/20 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    'Processing…'
                                ) : (
                                    <>
                                        <CheckCircle2 size={18} />
                                        Confirm sale
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Drawer>
    );
}
