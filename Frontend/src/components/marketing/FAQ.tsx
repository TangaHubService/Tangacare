import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const faqs = [
    {
        question: 'Is TangaCare suitable for small pharmacies?',
        answer: 'Yes! Our Starter plan is specifically designed for independent pharmacies and clinics with up to 1,000 items. It includes all the essential tools to stop manually tracking stock.',
    },
    {
        question: 'Can I manage multiple locations?',
        answer: "Absolutely. TangaCare's Pro and Enterprise plans allow you to connect multiple branches or hospital wards to a single management dashboard, with centralized reporting and inventory control.",
    },
    {
        question: 'How do expiry alerts work?',
        answer: 'The system monitors the expiration dates of all batches. You will receive notifications 30, 60, and 90 days before a product expires, allowing you to prioritize sales or return stock to vendors.',
    },
    {
        question: 'Do you integrate with hospital HMIS systems?',
        answer: 'Our Enterprise plan includes custom API integrations. We can work with your IT team to sync TangaCare with your existing hospital management information system.',
    },
    {
        question: 'Is my data secure?',
        answer: 'We take security seriously. TangaCare uses industry-standard encryption, regular backups, and role-based access control to ensure that sensitive inventory and patient data remain protected.',
    },
];

export function FAQ() {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    return (
        <section id="faq" className="py-24 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-base font-semibold text-teal-600 tracking-wide uppercase">
                        FAQ
                    </h2>
                    <p className="mt-2 text-2xl font-bold leading-8 tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        Frequently Asked Questions
                    </p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm"
                        >
                            <button
                                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                                className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-700"
                            >
                                <span className="font-bold text-gray-900 dark:text-white tracking-tight">
                                    {faq.question}
                                </span>
                                <ChevronDown
                                    className={cn(
                                        'h-5 w-5 text-gray-500 transition-transform duration-300',
                                        activeIndex === i ? 'rotate-180' : '',
                                    )}
                                />
                            </button>
                            <AnimatePresence>
                                {activeIndex === i && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="px-6 pb-6 text-gray-600 dark:text-zinc-400 text-sm leading-relaxed font-medium">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
