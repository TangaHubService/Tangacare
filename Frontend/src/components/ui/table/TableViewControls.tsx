import { useRef, useMemo, useState } from 'react';
import { Columns3, Download, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { TableViewColumn } from '../../../hooks/useTableViewState';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface TableViewControlsProps {
    tableLabel: string;
    columns: TableViewColumn[];
    activeView: string;
    savedViews: Array<{ name: string; columns: string[] }>;
    visibleColumnSet: Set<string>;
    onToggleColumn: (columnKey: string) => void;
    onApplyView: (viewName: string) => void;
    onSaveView: (viewName: string) => void;
    onDeleteView: (viewName: string) => void;
    onReset: () => void;
    onExportViews: () => string;
    onImportViews: (raw: string) => { ok: boolean; error?: string };
    className?: string;
}

export function TableViewControls({
    tableLabel,
    columns,
    activeView,
    savedViews,
    visibleColumnSet,
    onToggleColumn,
    onApplyView,
    onSaveView,
    onDeleteView,
    onReset,
    onExportViews,
    onImportViews,
    className,
}: TableViewControlsProps) {
    const [showColumnsMenu, setShowColumnsMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const hiddenColumnsCount = useMemo(
        () => columns.filter((column) => !visibleColumnSet.has(column.key)).length,
        [columns, visibleColumnSet],
    );

    return (
        <div
            className={cn(
                'relative flex items-center gap-2 max-w-full overflow-x-auto pb-1 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 px-2 py-2',
                'shrink-0',
                className,
            )}
        >
            <select
                value={activeView}
                onChange={(e) => onApplyView(e.target.value)}
                className="h-11 sm:h-10 shrink-0 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all touch-manipulation"
                title={`${tableLabel} view`}
            >
                <option value="default">Default view</option>
                {savedViews.map((view) => (
                    <option key={view.name} value={view.name}>
                        {view.name}
                    </option>
                ))}
            </select>

            <button
                type="button"
                onClick={() => {
                    const suggestedName = `${tableLabel} view`;
                    const viewName = window.prompt('Save current view as:', suggestedName);
                    if (viewName) onSaveView(viewName);
                }}
                className="h-11 sm:h-10 shrink-0 inline-flex items-center gap-1.5 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors touch-manipulation"
                title="Save current view"
            >
                <Save size={12} />
                Save view
            </button>

            {activeView !== 'default' && (
                <button
                    type="button"
                    onClick={() => onDeleteView(activeView)}
                    className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 inline-flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors touch-manipulation"
                    title="Delete selected view"
                >
                    <Trash2 size={14} />
                </button>
            )}

            <button
                type="button"
                onClick={onReset}
                className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 inline-flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-healthcare-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                title="Reset to default columns"
            >
                <RotateCcw size={14} />
            </button>

            <button
                type="button"
                onClick={() => {
                    const payload = onExportViews();
                    const blob = new Blob([payload], { type: 'application/json' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${tableLabel.toLowerCase().replace(/\s+/g, '_')}_views.json`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                }}
                className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 inline-flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-healthcare-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                title="Export saved views"
            >
                <Download size={14} />
            </button>

            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 inline-flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-healthcare-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                title="Import saved views"
            >
                <Upload size={14} />
            </button>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/json,.json"
                onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const raw = await file.text();
                    const result = onImportViews(raw);
                    if (!result.ok && result.error) {
                        window.alert(result.error);
                    }
                    event.target.value = '';
                }}
            />

            <button
                type="button"
                onClick={() => setShowColumnsMenu((value) => !value)}
                className="h-11 sm:h-10 shrink-0 inline-flex items-center gap-1.5 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors touch-manipulation"
            >
                <Columns3 size={12} />
                Columns
                {hiddenColumnsCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px]">
                        {hiddenColumnsCount} hidden
                    </span>
                )}
            </button>

            {showColumnsMenu && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-12 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Visible Columns
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {columns.map((column) => {
                            const isLocked = column.hideable === false;
                            const checked = visibleColumnSet.has(column.key);
                            return (
                                <label
                                    key={column.key}
                                    className={cn(
                                        'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs',
                                        isLocked
                                            ? 'text-slate-400'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
                                    )}
                                >
                                    <span className="font-bold">{column.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={isLocked}
                                        onChange={() => onToggleColumn(column.key)}
                                        className="h-4 w-4 rounded border-slate-300 text-healthcare-primary focus:ring-healthcare-primary"
                                    />
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TableViewControls;
