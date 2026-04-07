import { Button } from '../ui/Button';
import { Check } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const plans = [
    {
        code: 'starter',
        name: 'Starter',
        price: '35,000',
        description: 'Perfect for small clinics and independent pharmacies.',
        features: [
            'Up to 1,000 items',
            'Basic Inventory Tracking',
            'Expiry Alerts',
            '1 User Account',
            'Email Support',
        ],
    },
    {
        code: 'pro',
        name: 'Pro',
        price: '75,000',
        description: 'For growing pharmacies needing advanced analytics.',
        highlight: true,
        features: [
            'Unlimited items',
            'Advanced Analytics & Reporting',
            'Supplier Management',
            'Up to 5 User Accounts',
            'Priority Support',
            'Multi-location ready',
        ],
    },
    {
        code: 'business',
        name: 'Business',
        price: '100,000',
        description: 'For established pharmacies with multiple locations.',
        features: [
            'Everything in Pro',
            'Advanced Multi-location',
            'Up to 15 User Accounts',
            'Custom Reports',
            'API Access',
            'Dedicated Support',
        ],
    },
    {
        code: 'test',
        name: 'Test Plan',
        price: '100',
        description: 'Low-cost sandbox plan for payment flow testing.',
        features: [
            'For QA and payment testing',
            'Single-user test scope',
            'Checkout and renewal flow validation',
            'Webhook confirmation testing',
        ],
    },
    {
        code: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        description: 'Tailored for hospital networks and chains.',
        features: [
            'Unlimited Everything',
            'Custom Integrations (HMIS)',
            'Dedicated Account Manager',
            'SLA Support',
            'On-premise deployment option',
        ],
    },
];

export function Pricing() {
    return (
        <section id="pricing" className="py-24 bg-white dark:bg-black">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-base font-semibold text-teal-600 tracking-wide uppercase">
                        Pricing
                    </h2>
                    <p className="mt-2 text-2xl font-bold leading-8 tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        Simple, transparent pricing
                    </p>
                    <p className="mt-4 text-gray-500 dark:text-zinc-400">
                        No hidden fees. Cancel anytime.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`rounded-3xl p-8 border ${
                                plan.highlight
                                    ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-900/10 shadow-xl relative'
                                    : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                            } flex flex-col transition-all duration-300 hover:-translate-y-2`}
                        >
                            {plan.highlight && (
                                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-teal-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-teal-600/30">
                                    Most Popular
                                </div>
                            )}
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {plan.name}
                            </h3>
                            <div className="mt-6 flex items-baseline">
                                <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                                    {plan.price === 'Custom' ? 'Custom' : `RWF ${plan.price}`}
                                </span>
                                {plan.price !== 'Custom' && (
                                    <span className="ml-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                                        /month
                                    </span>
                                )}
                            </div>
                            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                                {plan.description}
                            </p>

                            <ul className="mt-10 space-y-4 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start">
                                        <div className="bg-teal-100 dark:bg-teal-900/30 rounded-full p-0.5 mr-3 mt-0.5">
                                            <Check className="h-4 w-4 text-teal-600" />
                                        </div>
                                        <span className="text-sm text-slate-700 dark:text-zinc-300 font-medium">
                                            {feature}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-10">
                                <Link
                                    to={plan.price === 'Custom' ? '/' : '/checkout'}
                                    search={plan.price === 'Custom' ? undefined : { plan: plan.code, mode: 'purchase' } as any}
                                    hash={plan.price === 'Custom' ? 'contact' : undefined}
                                >
                                    <Button
                                        className={`w-full h-12 rounded-xl font-bold transition-all ${
                                            plan.highlight
                                                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20'
                                                : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
