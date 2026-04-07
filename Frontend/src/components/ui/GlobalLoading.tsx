import { Loader2 } from 'lucide-react';

import logo from '../../assets/tanga-logo.png';

export function GlobalLoading() {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center w-full min-h-full bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="relative">
                <div className="absolute inset-0 bg-healthcare-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xl relative z-10 border border-slate-100 dark:border-slate-800">
                    <img
                        src={logo}
                        alt="Loading..."
                        className="w-12 h-12 object-contain animate-bounce"
                    />
                </div>
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-healthcare-primary animate-spin" />
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                        Loading TangaCare
                    </span>
                </div>
            </div>
        </div>
    );
}
