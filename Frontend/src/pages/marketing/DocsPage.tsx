import type { ComponentType } from 'react';
import { Link } from '@tanstack/react-router';
import {
    BookOpen,
    ClipboardCheck,
    Package,
    Database,
    ShoppingCart,
    Truck,
    Zap,
    Bell,
    ShieldAlert,
    BarChart3,
    Users,
    Settings,
    CheckCircle2,
    ArrowUpRight,
} from 'lucide-react';

interface DocSection {
    id: string;
    title: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    summary: string;
    steps: string[];
}

const quickStart = [
    'Open Dashboard and resolve critical low-stock/expiry alerts first.',
    'Use Inventory search to find medicines before any manual edits.',
    'Receive pending purchase orders before dispensing high-demand medicines.',
    'Use stock movements to trace quantity changes before adjustments.',
    'Run end-of-day reports and export for manager/auditor review.',
];

const sections: DocSection[] = [
    {
        id: 'setup',
        title: '1. Initial Setup',
        icon: ClipboardCheck,
        summary: 'Configure master settings correctly before daily operations start.',
        steps: [
            'Create organization and branch records.',
            'Invite users and assign roles with least-privilege permissions.',
            'Set medicine-level reorder points and minimum stock levels.',
            'Confirm tax, pricing, and dispensing defaults in settings.',
        ],
    },
    {
        id: 'navigation',
        title: '2. Navigation Model',
        icon: BookOpen,
        summary: 'Use the same workflow sequence every day for consistency.',
        steps: [
            'Dashboard for operational awareness.',
            'Inventory for medicines, batches, and stock integrity.',
            'Procurement for suppliers, purchase orders, and receiving.',
            'Sales/Dispensing for transactions and stock deduction.',
            'Reports and Management for compliance and oversight.',
        ],
    },
    {
        id: 'dashboard',
        title: '3. Dashboard Usage',
        icon: BarChart3,
        summary: 'Treat the dashboard as your control center, not just charts.',
        steps: [
            'Review today sales and inventory value.',
            'Check low stock, out-of-stock, expiring soon, and expired alerts.',
            'Prioritize urgent items before routine tasks.',
            'Use quick links to jump into corrective workflows.',
        ],
    },
    {
        id: 'medicines',
        title: '4. Medicines Management',
        icon: Package,
        summary: 'Accurate medicine master data improves safety and speed.',
        steps: [
            'Create medicine with code, brand/generic details, strength, and dosage form.',
            'Set selling price, reorder threshold, and minimum level.',
            'Mark controlled medicines explicitly.',
            'Update records through a single workflow to avoid duplicates.',
        ],
    },
    {
        id: 'batches',
        title: '5. Batch and Expiry Control',
        icon: Database,
        summary: 'Batch traceability is mandatory for pharmacy operations.',
        steps: [
            'Capture batch number, expiry date, quantity, and supplier on receiving.',
            'Follow FEFO when dispensing and transfers.',
            'Use expiry monitoring daily for risk visibility.',
            'Quarantine and remove expired batches immediately.',
        ],
    },
    {
        id: 'procurement',
        title: '6. Procurement and Purchase Orders',
        icon: ShoppingCart,
        summary: 'Keep ordering and receiving connected for auditability.',
        steps: [
            'Create PO from low-stock needs and supplier terms.',
            'Track statuses: pending, partially received, received, cancelled.',
            'Include expected delivery for planning and follow-up.',
            'Use row actions for quick view, receive, or cancel.',
        ],
    },
    {
        id: 'receiving',
        title: '7. Receiving Workflow',
        icon: Truck,
        summary: 'Receiving must validate quality and quantity before posting stock.',
        steps: [
            'Match supplier shipment to PO lines when PO exists.',
            'Validate expiry and duplicate batch warnings before submit.',
            'Confirm quantity and cost values carefully.',
            'Submit receipt and verify resulting stock updates.',
        ],
    },
    {
        id: 'dispensing',
        title: '8. Sales and Dispensing',
        icon: Zap,
        summary: 'Dispensing flow must remain fast and clinically safe.',
        steps: [
            'Search medicine by name, code, or barcode.',
            'Confirm dosage and controlled-drug requirements.',
            'Complete sale to auto-record stock movements.',
            'Use history to review, reconcile, or investigate transactions.',
        ],
    },
    {
        id: 'alerts',
        title: '9. Alerts and Safety Indicators',
        icon: Bell,
        summary: 'Alerts are operational tasks and should never be ignored.',
        steps: [
            'Monitor low stock and out-of-stock indicators continuously.',
            'Review near-expiry and expired alerts daily.',
            'Escalate controlled medicine anomalies immediately.',
            'Use clear color semantics for safe/attention/critical states.',
        ],
    },
    {
        id: 'movements',
        title: '10. Stock Movements and Adjustments',
        icon: ShieldAlert,
        summary: 'Manual stock changes require strict control and reasons.',
        steps: [
            'Filter stock movements by type, medicine, user, and date.',
            'Use adjustments only for damage, expiry removal, or correction.',
            'Always provide reason notes for every adjustment.',
            'Review movement history before and after high-risk changes.',
        ],
    },
    {
        id: 'reports',
        title: '11. Reports and Exports',
        icon: BarChart3,
        summary: 'Reports support operations, management, and compliance.',
        steps: [
            'Use inventory reports for valuation, low stock, and expiry risk.',
            'Use sales reports for trend and top-selling analysis.',
            'Use purchasing reports for supplier and lead-time performance.',
            'Export PDF/Excel and archive by policy.',
        ],
    },
    {
        id: 'roles',
        title: '12. Roles, Permissions, and Settings',
        icon: Users,
        summary: 'Role-based UX protects safety-critical actions.',
        steps: [
            'Owner/admin handles users, branches, and policy settings.',
            'Pharmacist and technician focus on dispensing/inventory operations.',
            'Cashier uses sales flows with restricted stock mutation.',
            'Auditor uses read-focused audit and report surfaces.',
        ],
    },
];

const dailyChecklist = [
    'Resolve all unresolved critical alerts.',
    'Verify received stock is posted with valid batch and expiry details.',
    'Review unusual stock adjustments and confirm reasons.',
    'Reconcile dispensing totals against stock movements.',
    'Export required daily management reports.',
];

export function DocsPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <img src="/logo.png" alt="TangaCare" className="w-9 h-9 object-contain" />
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                            TangaCare Docs
                        </span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link
                            to={'/auth/login' as any}
                            search={{} as any}
                            className="px-3 py-2 text-xs font-black uppercase tracking-wider rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Log In
                        </Link>
                        <Link
                            to={'/app' as any}
                            search={{} as any}
                            className="px-3 py-2 text-xs font-black uppercase tracking-wider rounded-lg bg-healthcare-primary text-white hover:bg-teal-700"
                        >
                            Open App
                        </Link>
                    </div>
                </div>
            </header>

            <main id="top" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-healthcare-primary/10 text-healthcare-primary">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-healthcare-dark dark:text-white">
                                Complete System Documentation
                            </h1>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
                                Full workflow guide for pharmacy operations across setup, inventory,
                                procurement, dispensing, safety, reporting, and multi-role
                                governance.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                        Daily Quick Start
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                        {quickStart.map((item) => (
                            <div
                                key={item}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3"
                            >
                                <p className="text-sm text-slate-700 dark:text-slate-200">{item}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sections.map((section) => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:border-healthcare-primary hover:text-healthcare-primary transition-colors"
                        >
                            {section.title}
                        </a>
                    ))}
                </section>

                <section className="space-y-4">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <article
                                id={section.id}
                                key={section.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
                            >
                                <h2 className="text-lg font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                                    <Icon size={18} className="text-healthcare-primary" />
                                    {section.title}
                                </h2>
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                    {section.summary}
                                </p>
                                <ol className="mt-3 space-y-2">
                                    {section.steps.map((step, idx) => (
                                        <li
                                            key={step}
                                            className="text-sm text-slate-700 dark:text-slate-200 flex items-start gap-2"
                                        >
                                            <span className="mt-0.5 h-5 min-w-5 rounded-full bg-healthcare-primary/10 text-healthcare-primary text-[11px] font-black flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </article>
                        );
                    })}
                </section>

                <section
                    id="daily-checklist"
                    className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4"
                >
                    <div className="space-y-2">
                        <h3 className="text-base font-black text-teal-800 dark:text-teal-200 flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            End-of-Day Checklist
                        </h3>
                        <ul className="space-y-1.5">
                            {dailyChecklist.map((item) => (
                                <li key={item} className="text-sm text-teal-700 dark:text-teal-300">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <a
                        href="#top"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-black uppercase tracking-wider hover:bg-teal-800"
                    >
                        Back to Top
                        <ArrowUpRight size={14} />
                    </a>
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-100 flex items-center gap-2 uppercase tracking-widest">
                        <Settings size={16} className="text-healthcare-primary" />
                        Documentation Notes
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        This documentation is hosted on the marketing web side (`/docs`) and is
                        intended as the primary training and reference manual for all teams.
                    </p>
                </section>
            </main>
        </div>
    );
}

export default DocsPage;
