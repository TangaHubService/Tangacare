import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-slate-700', className)}
            {...props}
        />
    );
}

export { Skeleton };
