import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const MAX_VISIBLE_PAGES = 5;

const buildPageItems = (currentPage: number, totalPages: number): Array<number | '...'> => {
    if (totalPages <= MAX_VISIBLE_PAGES) {
        return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const pages: Array<number | '...'> = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('...');
    for (let page = start; page <= end; page += 1) {
        pages.push(page);
    }
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);

    return pages;
};

interface PaginationProps {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    pageSizeLabel?: string;
    loading?: boolean;
    className?: string;
}

export function Pagination({
    page,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions,
    pageSizeLabel = 'Show',
    loading = false,
    className,
}: PaginationProps) {
    const safeTotalPages = Math.max(1, totalPages || 1);
    const safePage = Math.min(Math.max(1, page || 1), safeTotalPages);
    const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);
    const pageItems = buildPageItems(safePage, safeTotalPages);
    const disablePrev = loading || safePage <= 1;
    const disableNext = loading || safePage >= safeTotalPages;

    return (
        <div
            className={cn(
                'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm',
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Showing {from} to {to} of {totalItems}
                </span>
                {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            {pageSizeLabel}
                        </span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
                <button
                    onClick={() => onPageChange(Math.max(safePage - 1, 1))}
                    disabled={disablePrev}
                    className="p-2 border rounded-xl disabled:opacity-50 text-slate-500 hover:text-healthcare-primary transition-colors"
                    aria-label="Previous page"
                >
                    <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-1">
                    {pageItems.map((item, idx) =>
                        item === '...' ? (
                            <span key={`sep-${idx}`} className="px-2 text-slate-400 font-bold">
                                ...
                            </span>
                        ) : (
                            <button
                                key={item}
                                onClick={() => onPageChange(item)}
                                disabled={loading}
                                className={cn(
                                    'w-9 h-9 flex items-center justify-center rounded-xl text-[11px] font-black transition-all',
                                    safePage === item
                                        ? 'bg-healthcare-primary text-white shadow-md shadow-teal-500/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400',
                                )}
                                aria-label={`Go to page ${item}`}
                            >
                                {item}
                            </button>
                        ),
                    )}
                </div>
                <button
                    onClick={() => onPageChange(Math.min(safePage + 1, safeTotalPages))}
                    disabled={disableNext}
                    className="p-2 border rounded-xl disabled:opacity-50 text-slate-500 hover:text-healthcare-primary transition-colors"
                    aria-label="Next page"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
