import { motion } from 'framer-motion';
import { Box, BarChart, Settings } from 'lucide-react';

const steps = [
    {
        number: '01',
        title: 'Connect Your Inventory',
        description:
            'Import your existing stock list via Excel or connect directly to your suppliers.',
        icon: Box,
    },
    {
        number: '02',
        title: 'Track in Real-Time',
        description:
            'Every sale updates your stock instantly. Low stock alerts trigger automatically.',
        icon: Settings,
    },
    {
        number: '03',
        title: 'Optimize & Grow',
        description: 'Use analytics to cut waste, reduce expiry losses, and order efficiently.',
        icon: BarChart,
    },
];

export function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="py-24 bg-white dark:bg-black relative overflow-hidden"
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-20">
                    <h2 className="text-base font-semibold text-teal-600 tracking-wide uppercase">
                        How It Works
                    </h2>
                    <p className="mt-2 text-2xl font-bold leading-8 tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        Three steps to a smarter pharmacy
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gray-100 dark:bg-zinc-800 -z-10"></div>

                    {steps.map((step, i) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.2 }}
                            className="relative flex flex-col items-center text-center"
                        >
                            <div className="w-24 h-24 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-lg flex items-center justify-center mb-8 relative z-10">
                                <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600">
                                    <step.icon className="w-8 h-8" />
                                </div>
                                <div className="absolute -top-3 -right-3 w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-bold border-4 border-white dark:border-zinc-900">
                                    {step.number}
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                {step.title}
                            </h3>
                            <p className="text-gray-500 dark:text-zinc-400 max-w-xs text-sm leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
