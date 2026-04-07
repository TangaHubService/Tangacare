import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div className={cn('animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md', className)} />
    );
}

export function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="glass-card p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center gap-4"
                >
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-6 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}
