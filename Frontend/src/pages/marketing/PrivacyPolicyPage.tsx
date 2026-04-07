import { Link } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';

export function PrivacyPolicyPage() {
    const effectiveDate = 'March 8, 2026';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="TangaCare" className="w-8 h-8 object-contain" />
                        <span className="font-black text-slate-900 dark:text-white">TangaCare</span>
                    </Link>
                    <Link
                        to={'/terms-of-use' as any}
                        search={{} as any}
                        className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-healthcare-primary"
                    >
                        Terms of Use
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-healthcare-primary/10 text-healthcare-primary">
                            <ShieldCheck size={18} />
                        </div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">
                            Privacy Policy
                        </h1>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
                        Effective Date: {effectiveDate}
                    </p>

                    <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                1. Information We Collect
                            </h2>
                            <p>
                                We collect account information, facility configuration data,
                                inventory records, transaction logs, and support communications
                                needed to operate the platform.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                2. How We Use Data
                            </h2>
                            <p>
                                Data is used to provide system functionality, maintain security and
                                auditability, improve performance, and deliver support.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                3. Data Sharing
                            </h2>
                            <p>
                                We do not sell personal data. We may share information with
                                subprocessors or authorities only when required to deliver the
                                service or comply with law.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                4. Security
                            </h2>
                            <p>
                                We use access controls, audit logs, encrypted transport, and
                                operational safeguards to protect data from unauthorized access and
                                misuse.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                5. Retention
                            </h2>
                            <p>
                                Data is retained according to contractual and regulatory
                                requirements. Customers may request deletion where legally
                                permitted.
                            </p>
                        </section>
                        <section>
                            <h2 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                6. Contact
                            </h2>
                            <p>
                                Privacy questions can be sent to{' '}
                                <a
                                    href="mailto:privacy@tangacare.io"
                                    className="text-healthcare-primary font-bold"
                                >
                                    privacy@tangacare.io
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
