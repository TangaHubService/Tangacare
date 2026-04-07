interface QuickOption {
    value: string;
    label: string;
}

interface TableQuickControlsProps {
    presetLabel?: string;
    presetValue: string;
    presetOptions: QuickOption[];
    onPresetChange: (value: string) => void;
    sortLabel?: string;
    sortValue: string;
    sortOptions: QuickOption[];
    onSortChange: (value: string) => void;
}

export function TableQuickControls({
    presetLabel = 'Preset',
    presetValue,
    presetOptions,
    onPresetChange,
    sortLabel = 'Sort',
    sortValue,
    sortOptions,
    onSortChange,
}: TableQuickControlsProps) {
    return (
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex h-10 items-center px-2 rounded-lg bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                {presetLabel}
            </span>
            <select
                value={presetValue}
                onChange={(e) => onPresetChange(e.target.value)}
                className="h-11 sm:h-10 min-w-[150px] px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all touch-manipulation"
            >
                {presetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            <span className="hidden sm:inline-flex h-10 items-center px-2 rounded-lg bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                {sortLabel}
            </span>
            <select
                value={sortValue}
                onChange={(e) => onSortChange(e.target.value)}
                className="h-11 sm:h-10 min-w-[170px] px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all touch-manipulation"
            >
                {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default TableQuickControls;
