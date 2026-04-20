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

const tableOfContents = [
    { id: 'quick-start', title: 'Daily Quick Start' },
    ...sections.map((section) => ({ id: section.id, title: section.title })),
    { id: 'daily-checklist', title: 'End-of-Day Checklist' },
    { id: 'documentation-notes', title: 'Documentation Notes' },
];

export function DocsPage() {
    return (
        <div className="marketing-site min-h-screen bg-slate-50 dark:bg-slate-950">
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

            <main id="top" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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

                <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="lg:sticky lg:top-24 self-start space-y-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                                Table of Contents
                            </p>
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                                Jump through the guide from setup to daily closing without the card
                                grid.
                            </p>
                            <nav aria-label="Documentation sections" className="mt-5">
                                <ol className="space-y-1.5">
                                    {tableOfContents.map((item, index) => (
                                        <li key={item.id}>
                                            <a
                                                href={`#${item.id}`}
                                                className="group flex items-start gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-healthcare-primary dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white transition-colors"
                                            >
                                                <span className="mt-0.5 min-w-7 text-[11px] font-black tracking-wider text-slate-400 group-hover:text-healthcare-primary">
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                                <span className="font-semibold leading-5">
                                                    {item.title}
                                                </span>
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </nav>
                        </div>

                        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-teal-800 dark:text-teal-200">
                                Reading Flow
                            </h2>
                            <p className="mt-2 text-sm text-teal-700 dark:text-teal-300">
                                Start with quick start, follow the numbered workflows, then finish
                                with the end-of-day checklist.
                            </p>
                            <a
                                href="#top"
                                className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-800 dark:text-teal-200"
                            >
                                Back to Top
                                <ArrowUpRight size={14} />
                            </a>
                        </div>
                    </aside>

                    <div className="space-y-4">
                        <article
                            id="quick-start"
                            className="scroll-mt-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm"
                        >
                            <h2 className="text-lg font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                                <BookOpen size={18} className="text-healthcare-primary" />
                                Daily Quick Start
                            </h2>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                Use this short sequence when opening the system so urgent work is
                                handled before routine tasks.
                            </p>
                            <ol className="mt-4 space-y-3">
                                {quickStart.map((item, idx) => (
                                    <li
                                        key={item}
                                        className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200"
                                    >
                                        <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-healthcare-primary/10 text-[11px] font-black text-healthcare-primary">
                                            {idx + 1}
                                        </span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ol>
                        </article>

                        {sections.map((section) => {
                            const Icon = section.icon;
                            return (
                                <article
                                    id={section.id}
                                    key={section.id}
                                    className="scroll-mt-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
                                >
                                    <h2 className="text-lg font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                                        <Icon size={18} className="text-healthcare-primary" />
                                        {section.title}
                                    </h2>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                        {section.summary}
                                    </p>
                                    <ol className="mt-4 space-y-2.5">
                                        {section.steps.map((step, idx) => (
                                            <li
                                                key={step}
                                                className="text-sm text-slate-700 dark:text-slate-200 flex items-start gap-2.5"
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

                        <section
                            id="daily-checklist"
                            className="scroll-mt-24 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-5"
                        >
                            <h3 className="text-base font-black text-teal-800 dark:text-teal-200 flex items-center gap-2">
                                <CheckCircle2 size={16} />
                                End-of-Day Checklist
                            </h3>
                            <ul className="mt-3 space-y-2">
                                {dailyChecklist.map((item) => (
                                    <li
                                        key={item}
                                        className="text-sm text-teal-700 dark:text-teal-300"
                                    >
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section
                            id="documentation-notes"
                            className="scroll-mt-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
                        >
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-100 flex items-center gap-2 uppercase tracking-widest">
                                <Settings size={16} className="text-healthcare-primary" />
                                Documentation Notes
                            </h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                This documentation is hosted on the marketing web side (`/docs`)
                                and is intended as the primary training and reference manual for
                                all teams.
                            </p>
                        </section>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default DocsPage;
