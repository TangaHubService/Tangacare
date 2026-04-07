import { Skeleton } from '../ui/Skeleton';
import { SkeletonTable } from '../ui/SkeletonTable';

export function StatCardSkeleton() {
    return (
        <div className="tc-stat-card">
            <div className="tc-stat-card-header">
                <Skeleton className="w-16 h-2.5 rounded-md" />
                <Skeleton className="w-6 h-6 rounded-md" />
            </div>
            <div className="tc-stat-card-foot">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-2.5 w-12" />
            </div>
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="glass-card p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center">
            <div className="w-full flex justify-between mb-6">
                <Skeleton className="h-6 w-1/3" />
            </div>
            <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
    );
}

export function TableSkeleton() {
    return <SkeletonTable rows={5} columns={5} />;
}
