import { motion } from 'framer-motion';
import { XCircle, CheckCircle } from 'lucide-react';

export function Problems() {
    return (
        <section className="py-24 bg-white dark:bg-black">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-base font-semibold text-teal-600 tracking-wide uppercase">
                        Why TangaCare?
                    </h2>
                    <p className="mt-2 text-2xl font-bold leading-8 tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        Is your current process costing you?
                    </p>
                    <p className="mt-4 max-w-2xl text-xl text-gray-500 dark:text-zinc-400 mx-auto">
                        Traditional inventory methods are prone to error and waste. See the
                        difference.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                    {/* The Old Way */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-8 border border-red-100 dark:border-red-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <XCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                The Old Way
                            </h3>
                        </div>
                        <ul className="space-y-4">
                            {[
                                'Manual Excel spreadsheets',
                                'Unexpected stockouts',
                                'Expired medicine losses',
                                'Hours spent on reordering',
                                'Guesswork based purchasing',
                            ].map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3 text-gray-700 dark:text-zinc-300"
                                >
                                    <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                                    <span className="text-sm lg:text-base font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* The TangaCare Way */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-teal-50 dark:bg-teal-900/10 rounded-2xl p-8 border border-teal-100 dark:border-teal-900/30 relative overflow-hidden transition-colors"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CheckCircle className="h-32 w-32 text-teal-600" />
                        </div>
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                <CheckCircle className="h-6 w-6 text-teal-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                The TangaCare Way
                            </h3>
                        </div>
                        <ul className="space-y-4 relative z-10">
                            {[
                                'Automated real-time tracking',
                                'Smart reorder alerts',
                                'FEFO-based dispensing',
                                'One-click purchase orders',
                                'Data-driven insights',
                            ].map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3 text-gray-700 dark:text-zinc-300"
                                >
                                    <CheckCircle className="h-5 w-5 text-teal-500 shrink-0" />
                                    <span className="text-sm lg:text-base font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
