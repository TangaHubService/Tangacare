import { Button } from '../ui/Button';
import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function CTA() {
    return (
        <section className="bg-teal-600 py-32 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-teal-500 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-teal-700 rounded-full opacity-20 blur-3xl"></div>

            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
                <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl mb-8 leading-tight">
                    Start Your 14-Day Free <br className="hidden sm:block" /> Trial Today
                </h2>
                <p className="text-xl text-teal-50 max-w-2xl mx-auto mb-12 leading-relaxed opacity-90 font-medium">
                    Join hundreds of forward-thinking pharmacies and hospitals using TangaCare to
                    optimize inventory, eliminate waste, and boost profitability.
                </p>
                <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
                    <Link to={'/subscribe' as any} search={{} as any}>
                        <Button
                            size="lg"
                            className="h-16 px-12 rounded-2xl bg-white text-teal-600 hover:bg-slate-50 font-black text-xl shadow-2xl transition-all hover:scale-105 active:scale-95 group"
                        >
                            Get Started Now
                            <ArrowRight className="ml-3 h-6 w-6 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                    <a href="#contact">
                        <Button
                            size="lg"
                            variant="outline"
                            className="h-16 px-12 rounded-2xl border-white/30 text-white hover:bg-white/10 font-bold text-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
                        >
                            Talk to an Expert
                        </Button>
                    </a>
                </div>

                <p className="mt-10 text-teal-200/60 text-sm font-bold uppercase tracking-widest">
                    No credit card required • Cancel anytime • Full feature access
                </p>
            </div>
        </section>
    );
}
