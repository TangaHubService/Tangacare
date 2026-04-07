import { Link } from '@tanstack/react-router';
import { Button } from '../ui/Button';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    ShieldCheck,
    ScanLine,
    Clock3,
    Sparkles,
    Pill,
    Snowflake,
    Activity,
} from 'lucide-react';

export function Hero() {
    return (
        <section className="relative isolate overflow-hidden pt-20 pb-24 lg:pt-32 lg:pb-36 bg-slate-50 dark:bg-zinc-950">
            <div className="absolute inset-0 z-0">
                <img
                    src="/hero-bg.png"
                    alt="Hero background"
                    className="absolute inset-0 h-full w-full object-cover object-center opacity-40 dark:opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/72 to-cyan-50/78 dark:from-black/82 dark:via-black/70 dark:to-zinc-900/80" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(20,184,166,0.22),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(6,182,212,0.20),transparent_42%)]" />
                <div className="absolute -top-20 left-[-6rem] h-80 w-80 rounded-full border border-teal-500/20 bg-white/35 dark:bg-zinc-900/30 backdrop-blur-xl" />
                <div className="absolute bottom-[-7rem] right-[-5rem] h-96 w-96 rounded-full border border-cyan-500/20 bg-white/25 dark:bg-zinc-900/25 backdrop-blur-xl" />
                <div className="absolute top-14 right-16 h-24 w-24 rotate-12 rounded-2xl border border-teal-500/30 bg-white/45 dark:bg-zinc-900/40 backdrop-blur" />
                <div className="absolute bottom-16 left-16 h-16 w-16 -rotate-12 rounded-xl border border-cyan-500/30 bg-white/50 dark:bg-zinc-900/40 backdrop-blur" />
                <div
                    className="absolute inset-0 opacity-[0.07] dark:opacity-[0.05]"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, #0f766e 1px, transparent 1px), linear-gradient(to bottom, #0f766e 1px, transparent 1px)',
                        backgroundSize: '52px 52px',
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/20 to-white/85 dark:from-black/35 dark:via-black/18 dark:to-black/55" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
                    <motion.div
                        initial={{ opacity: 0, y: 26 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                        className="text-center"
                    >
                        <div className="inline-flex items-center rounded-full border border-teal-600/20 bg-white/80 dark:bg-zinc-900/70 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400 shadow-sm backdrop-blur">
                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                            Modern Pharmacy Command Center
                        </div>

                        <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl leading-[1.1]">
                            Move From Reactive
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-cyan-500 to-blue-600">
                                To Predictable Pharmacy Growth
                            </span>
                        </h1>

                        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 dark:text-zinc-400 sm:text-lg leading-relaxed">
                            Unify inventory, dispensing, procurement, and audit compliance in one
                            fast workflow. Cut expiry loss, detect stock risk early, and keep every
                            decision measurable.
                        </p>

                        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                            <TrustCard label="Traceability" value="99.9%" />
                            <TrustCard label="Stock Lookup" value="< 2 min" />
                            <TrustCard label="Cold-Chain" value="Live" />
                        </div>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs font-bold text-slate-600 dark:text-zinc-400">
                            <HeroTag
                                icon={<ShieldCheck className="h-4 w-4" />}
                                text="Audit-ready logs"
                            />
                            <HeroTag
                                icon={<ScanLine className="h-4 w-4" />}
                                text="Barcode workflows"
                            />
                            <HeroTag icon={<Clock3 className="h-4 w-4" />} text="Fast onboarding" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20, rotate: 2 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ duration: 0.75, ease: 'easeOut' }}
                        className="relative"
                    >
                        <div className="relative rounded-3xl border border-white/60 dark:border-zinc-800/90 bg-white/75 dark:bg-zinc-900/75 p-2 shadow-2xl backdrop-blur">
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 aspect-[16/10]">
                                <img
                                    src="/dashboard-main.png"
                                    alt="TangaCare Dashboard Preview"
                                    className="w-full h-full object-cover object-top"
                                />
                                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
                            </div>
                        </div>

                        <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                            className="hidden sm:flex absolute -top-6 -left-6 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 p-3 shadow-xl items-center gap-3"
                        >
                            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                    Today
                                </p>
                                <p className="text-sm font-black text-slate-900 dark:text-white">
                                    127 Dispenses Processed
                                </p>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 7, 0] }}
                            transition={{
                                repeat: Infinity,
                                duration: 4.5,
                                ease: 'easeInOut',
                                delay: 0.8,
                            }}
                            className="hidden sm:flex absolute -bottom-7 -right-5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 p-3 shadow-xl items-center gap-3"
                        >
                            <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 flex items-center justify-center">
                                <Snowflake className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                    Cold Chain
                                </p>
                                <p className="text-sm font-black text-slate-900 dark:text-white">
                                    98.7% Within Range
                                </p>
                            </div>
                        </motion.div>

                        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                            <MetricChip
                                icon={<Pill className="h-3.5 w-3.5" />}
                                label="Stockouts"
                                value="-32%"
                            />
                            <MetricChip
                                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                                label="Compliance"
                                value="Up"
                            />
                            <MetricChip
                                icon={<Clock3 className="h-3.5 w-3.5" />}
                                label="Processing"
                                value="Faster"
                            />
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="mt-10 pt-6 border-t border-slate-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row gap-3 justify-center"
                >
                    <Link to={'/subscribe' as any} search={{} as any}>
                        <Button
                            size="lg"
                            className="h-12 px-7 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-lg shadow-teal-600/25 transition-all hover:scale-[1.02] active:scale-95 group"
                        >
                            Start Free Trial
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                    <a href="#contact">
                        <Button
                            size="lg"
                            variant="outline"
                            className="h-12 px-7 rounded-full border-2 font-black text-sm bg-white/70 dark:bg-zinc-900/70 backdrop-blur"
                        >
                            Book a Demo
                        </Button>
                    </a>
                    <Link to={'/docs' as any} search={{} as any}>
                        <Button
                            size="lg"
                            variant="ghost"
                            className="h-12 px-6 rounded-full font-black text-sm border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        >
                            Documentation
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}

function TrustCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200/90 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/75 px-3 py-2 backdrop-blur-sm">
            <p className="text-base font-black text-slate-900 dark:text-white">{value}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500 dark:text-zinc-400">
                {label}
            </p>
        </div>
    );
}

function HeroTag({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 px-3 py-1.5">
            <span className="text-teal-600 dark:text-teal-400">{icon}</span>
            <span>{text}</span>
        </div>
    );
}

function MetricChip({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/75 dark:bg-zinc-900/75 px-2 py-2">
            <div className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 mb-1">
                {icon}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                {label}
            </p>
            <p className="text-xs font-black text-slate-900 dark:text-white">{value}</p>
        </div>
    );
}
