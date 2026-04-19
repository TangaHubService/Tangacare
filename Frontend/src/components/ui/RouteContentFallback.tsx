/**
 * Lazy-route / layout loading: transparent pulse header (logo + bars), centered in the main column.
 */
import { TangacarePulseHeader } from './TangacarePulseHeader';

export function RouteContentFallback() {
    return (
        <div
            className="flex w-full min-h-[min(60vh,calc(100dvh-14rem))] flex-col items-center justify-center py-8 motion-reduce:animate-none animate-in fade-in duration-200"
            aria-busy="true"
            aria-label="Loading page"
        >
            <div className="flex w-full max-w-lg flex-col items-center space-y-8 text-center">
                <TangacarePulseHeader />

                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Preparing this page…
                </p>
            </div>
        </div>
    );
}

/** Compact pulse header for auth/permission gates while session resolves. */
export function CompactRouteSkeleton() {
    return (
        <div
            className="flex w-full max-w-md flex-col items-center space-y-6 text-center"
            aria-busy="true"
            aria-label="Loading"
        >
            <TangacarePulseHeader compact />

            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Preparing this page…
            </p>
        </div>
    );
}
