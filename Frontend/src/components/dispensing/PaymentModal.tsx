import { useState, useEffect } from 'react';
import { X, Plus, CreditCard, Banknote, Smartphone, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
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

const PAYMENT_METHODS: { id: SalePaymentMethod; label: string; icon: any }[] = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { id: 'insurance', label: 'Insurance', icon: ShieldCheck },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'bank', label: 'Bank Transfer', icon: Banknote },
];

export function PaymentModal({
    totalAmount,
    hasControlledDrugs,
    onClose,
    onConfirm,
    isProcessing,
}: PaymentModalProps) {
    const { formatMoney } = useRuntimeConfig();
    const [payments, setPayments] = useState<Payment[]>([
        { id: '1', method: 'cash', amount: totalAmount },
    ]);
    const [patientIdType, setPatientIdType] = useState('National ID');
    const [patientIdNumber, setPatientIdNumber] = useState('');
    const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
    const [selectedInsuranceProviderId, setSelectedInsuranceProviderId] = useState<
        number | undefined
    >();
    const [patientInsuranceNumber, setPatientInsuranceNumber] = useState('');

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

    // Handle insurance calculation logic
    useEffect(() => {
        const insurancePayment = payments.find((p) => p.method === 'insurance');
        if (insurancePayment && selectedInsuranceProviderId) {
            const provider = insuranceProviders.find((p) => p.id === selectedInsuranceProviderId);
            if (provider) {
                const coveragePercent = Number(provider.coverage_percentage);
                let CalculatedInsuranceAmount = (totalAmount * coveragePercent) / 100;

                if (
                    provider.max_coverage_limit &&
                    CalculatedInsuranceAmount > Number(provider.max_coverage_limit)
                ) {
                    CalculatedInsuranceAmount = Number(provider.max_coverage_limit);
                }

                const roundedInsurance = Math.round(CalculatedInsuranceAmount);
                const copayAmount = totalAmount - roundedInsurance;

                // Update payments: Ensure we have insurance and co-pay (cash)
                setPayments([
                    { id: insurancePayment.id, method: 'insurance', amount: roundedInsurance },
                    {
                        id: 'copay-' + Math.random().toString(36).substr(2, 4),
                        method: 'cash',
                        amount: copayAmount,
                    },
                ]);
            }
        }
    }, [selectedInsuranceProviderId, totalAmount, insuranceProviders.length]);

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = totalAmount - totalPaid;

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

    const updatePayment = (id: string, field: keyof Payment, value: any) => {
        setPayments(payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    };

    const handleConfirm = () => {
        if (Math.abs(balance) > 0.01) {
            toast.error('Payment amount must match total');
            return;
        }
        if (hasControlledDrugs && !patientIdNumber) {
            toast.error('Patient ID Number is required for controlled drugs');
            return;
        }

        const hasInsurance = payments.some((p) => p.method === 'insurance');
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

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="md"
            title="Process Payment"
            subtitle={`Total Due: ${formatMoney(totalAmount)}`}
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 w-full rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
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
                                                        e.target.value,
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
                                                        PAYMENT_METHODS.find(
                                                            (m) => m.id === payment.method,
                                                        )?.icon || Banknote;
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
                                                updatePayment(
                                                    payment.id,
                                                    'reference',
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none text-healthcare-dark dark:text-white"
                                        />
                                    </div>
                                )}

                                {payment.method === 'insurance' && (
                                    <div className="space-y-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 border-dashed">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                Insurance Provider
                                            </label>
                                            <select
                                                value={selectedInsuranceProviderId}
                                                onChange={(e) =>
                                                    setSelectedInsuranceProviderId(
                                                        Number(e.target.value),
                                                    )
                                                }
                                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                            >
                                                <option value="">Select Provider...</option>
                                                {insuranceProviders.map((provider) => (
                                                    <option key={provider.id} value={provider.id}>
                                                        {provider.name} ({provider.type})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                                Insurance / Policy Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Enter insurance number..."
                                                value={patientInsuranceNumber}
                                                onChange={(e) =>
                                                    setPatientInsuranceNumber(e.target.value)
                                                }
                                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none text-healthcare-dark dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                {payments.length > 1 && (
                                    <button
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
                            onClick={addPayment}
                            className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-healthcare-primary hover:border-healthcare-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-sm font-bold"
                        >
                            <Plus size={16} />
                            Add Payment Method
                        </button>
                    )}

                    {hasControlledDrugs && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertCircle size={14} className="text-red-500" />
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                                    Controlled Substance - Passenger ID Required
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                        ID Type
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
                                        ID Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter ID number..."
                                        value={patientIdNumber}
                                        onChange={(e) => setPatientIdNumber(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-healthcare-primary outline-none font-bold text-healthcare-dark dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-bold">Paid</span>
                        <span className="font-black text-healthcare-dark dark:text-white">
                            {totalPaid.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-bold">Balance</span>
                        <span
                            className={`font-black ${balance === 0 ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                            {balance.toLocaleString()}
                        </span>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={Math.abs(balance) > 0.01 || isProcessing}
                        className="w-full py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-healthcare-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-healthcare-primary/20 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            'Processing...'
                        ) : (
                            <>
                                <CheckCircle2 size={18} />
                                Complete Sale
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Drawer>
    );
}
