import { type ReactNode } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface TableToolbarProps {
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    onReset?: () => void;
    filters?: ReactNode;
    actions?: ReactNode;
    className?: string;
    layout?: 'inline' | 'stacked';
}

export function TableToolbar({
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Search...',
    onReset,
    filters,
    actions,
    className,
    layout = 'inline',
}: TableToolbarProps) {
    const hasSearch = typeof searchValue === 'string' && !!onSearchChange;
    const isStacked = layout === 'stacked';
    const searchField = hasSearch ? (
        <div
            className={cn(
                'relative flex-1 w-full',
                !isStacked && 'xl:min-w-[340px] xl:max-w-[560px] xl:flex-[1_1_420px]',
            )}
        >
            <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={15}
            />
            <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-11 sm:h-10 pl-10 pr-4 bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-healthcare-primary focus:ring-4 focus:ring-healthcare-primary/10 rounded-2xl sm:rounded-xl text-sm sm:text-xs font-bold text-slate-900 dark:text-white transition-all outline-none shadow-sm"
            />
        </div>
    ) : null;
    const resetButton = onReset ? (
        <button
            onClick={onReset}
            className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 inline-flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-all shadow-sm touch-manipulation"
            title="Reset filters"
        >
            <RefreshCw size={16} />
        </button>
    ) : null;

    return (
        <div
            className={cn(
                isStacked
                    ? 'flex flex-col gap-3 bg-gradient-to-br from-white via-white to-slate-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-3 sm:p-4 border border-slate-200 dark:border-slate-800 rounded-2xl '
                    : 'flex flex-col xl:flex-row xl:flex-nowrap xl:items-center gap-3 bg-gradient-to-br from-white via-white to-slate-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-3 sm:p-4 border border-slate-200 dark:border-slate-800 rounded-2xl ',
                className,
            )}
        >
            {searchField}

            {isStacked ? (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:overflow-x-auto xl:whitespace-nowrap pb-1 xl:pb-0">
                        {filters}
                        <span className="hidden xl:inline-block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
                        <div className="flex items-center gap-2 xl:ml-auto shrink-0">
                            {resetButton}
                            {actions}
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className={cn(
                        'w-full flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-2.5 py-2',
                        !isStacked &&
                            'xl:w-auto xl:flex-1 xl:flex-nowrap xl:justify-end xl:overflow-x-auto xl:whitespace-nowrap',
                    )}
                >
                    {filters}
                    {resetButton}
                    {actions}
                </div>
            )}
        </div>
    );
}

export default TableToolbar;
