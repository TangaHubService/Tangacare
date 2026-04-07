import { motion } from 'framer-motion';
import { BarChart3, PackageCheck, Truck, Zap, Building2, Users } from 'lucide-react';

const features = [
    {
        title: 'Real-time Stock Tracking',
        description:
            'Know exactly what you have on the shelf at any moment. Updates instantly with every sale.',
        icon: PackageCheck,
        className: 'md:col-span-1',
    },
    {
        title: 'Multi-Location Support',
        description:
            'Manage multiple pharmacies or hospital wards from a single dashboard. Centralized control.',
        icon: Building2,
        className: 'md:col-span-1',
    },
    {
        title: 'Smart Reordering',
        description:
            'AI-driven suggestions tell you exactly what to order and when, based on historical usage.',
        icon: Zap,
        className: 'md:col-span-1',
    },
    {
        title: 'Supplier & Procurement',
        description:
            'Track vendor performance, lead times, and fulfillment rates to optimize procurement.',
        icon: Truck,
        className: 'md:col-span-2',
    },
    {
        title: 'Patient Management',
        description:
            'Track patient history, manage prescriptions, and build loyalty with integrated CRM features.',
        icon: Users,
        className: 'md:col-span-1',
    },
    {
        title: 'Analytics & Reporting',
        description:
            'Comprehensive financial reports, sales trends, and ABC analysis exportable in one click.',
        icon: BarChart3,
        className: 'md:col-span-3',
    },
];

export function Features() {
    return (
        <section id="features" className="py-24 bg-slate-50 dark:bg-zinc-900/30 transition-colors">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-base font-semibold text-teal-600 tracking-wide uppercase">
                        Features
                    </h2>
                    <p className="mt-2 text-2xl font-bold leading-8 tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        Everything you need to run a modern pharmacy
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    {features.map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className={`bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-all ${feature.className || ''}`}
                        >
                            <div className="h-10 w-10 bg-teal-50 dark:bg-teal-900/30 rounded-lg flex items-center justify-center mb-6 text-teal-600">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                                {feature.title}
                            </h3>
                            <p className="text-gray-500 dark:text-zinc-400 leading-relaxed text-sm lg:text-base font-medium">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Secondary Product Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-2xl"
                >
                    <img
                        src="/dashboard-secondary.png"
                        alt="TangaCare Features Preview"
                        className="w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                    <div className="absolute bottom-10 left-10">
                        <p className="text-white text-2xl font-black italic tracking-tighter opacity-80 select-none">
                            TangaCare Analytics
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
