import { Link } from '@tanstack/react-router';
import { FileCheck } from 'lucide-react';

export function TermsOfUsePage() {
    const effectiveDate = 'March 8, 2026';

    return (
        <div className="marketing-site min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="TangaCare" className="w-8 h-8 object-contain" />
                        <span className="font-black text-slate-900 dark:text-white">TangaCare</span>
                    </Link>
                    <Link
                        to={'/privacy-policy' as any}
                        search={{} as any}
                        className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-healthcare-primary"
                    >
                        Privacy Policy
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-healthcare-primary/10 text-healthcare-primary">
                            <FileCheck size={18} />
                        </div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">
                            Terms of Use
                        </h1>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
                        Effective Date: {effectiveDate}
                    </p>

                    <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                1. Service Access
                            </h2>
                            <p>
                                Access is provided to authorized users under your organization
                                account. You are responsible for account security and role
                                assignment.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                2. Acceptable Use
                            </h2>
                            <p>
                                You agree not to misuse the platform, attempt unauthorized access,
                                or use the system in ways that violate laws, regulations, or
                                professional obligations.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                3. Customer Responsibilities
                            </h2>
                            <p>
                                Customers are responsible for data accuracy, local regulatory
                                compliance, and operational procedures within their facilities.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                4. Availability and Changes
                            </h2>
                            <p>
                                We may update features to improve reliability, security, or
                                compliance. Scheduled maintenance and service notices are
                                communicated through standard support channels.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                5. Limitation of Liability
                            </h2>
                            <p>
                                The service is provided under applicable contractual limits. Nothing
                                in these terms removes liabilities that cannot be excluded by law.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                6. Contact
                            </h2>
                            <p>
                                Terms questions can be sent to{' '}
                                <a
                                    href="mailto:legal@tangacare.io"
                                    className="text-healthcare-primary font-bold"
                                >
                                    legal@tangacare.io
                                </a>
                                .
                            </p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
