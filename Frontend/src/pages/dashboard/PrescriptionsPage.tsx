import { Link } from '@tanstack/react-router';
import { ArrowRight, ClipboardList, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

const steps = [
    'Open Dispensing and select the patient profile.',
    'Scan or search medicines, then confirm the FEFO-selected batch.',
    'Enter prescription ID (required for controlled medicines).',
    'Review payment split, confirm dispense, and print receipt.',
    'Use reports to monitor controlled-drug and variance trends.',
];

export function PrescriptionsPage() {
    return (
        <ProtectedRoute
            allowedRoles={[
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'OWNER',
                'PHARMACIST',
                'CASHIER',
                'ADMIN',
                'AUDITOR',
            ]}
            requireFacility
        >
            <div className="p-6 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">
                            Prescriptions Workflow
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Safe Dispensing and Traceability
                        </p>
                    </div>
                    <Link
                        to={'/app/sell' as any}
                        search={{} as any}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-healthcare-primary text-white text-xs font-black uppercase tracking-wider hover:bg-teal-700 transition-colors"
                    >
                        Open Dispensing
                        <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                        <h2 className="text-lg font-black text-healthcare-dark dark:text-white mb-4 flex items-center gap-2">
                            <ClipboardList size={18} />
                            Standard Prescription Flow
                        </h2>
                        <ol className="space-y-3">
                            {steps.map((step, index) => (
                                <li key={step} className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-healthcare-primary/10 text-healthcare-primary text-xs font-black">
                                        {index + 1}
                                    </span>
                                    <span className="text-sm text-slate-600 dark:text-slate-300">
                                        {step}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                            <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                <ShieldAlert size={16} />
                                Controlled Drug Rule
                            </h3>
                            <p className="text-xs mt-2 text-amber-700 dark:text-amber-200 leading-relaxed">
                                A valid prescription ID is required before checkout when controlled
                                items are in cart.
                            </p>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
                            <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                                <CheckCircle2 size={16} />
                                Operational Checklist
                            </h3>
                            <ul className="text-xs mt-2 space-y-1 text-emerald-700 dark:text-emerald-200">
                                <li>Use barcode scan whenever available.</li>
                                <li>Confirm patient identity before payment.</li>
                                <li>Document exception notes for any adjustment.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
