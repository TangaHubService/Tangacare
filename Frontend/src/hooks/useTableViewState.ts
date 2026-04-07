import { useEffect, useMemo, useState } from 'react';

export interface TableViewColumn {
    key: string;
    label: string;
    defaultVisible?: boolean;
    hideable?: boolean;
}

interface TableViewStorage {
    activeView: string;
    views: Array<{
        name: string;
        columns: string[];
    }>;
}

interface TableViewStateOptions {
    role?: string;
    roleDefaultColumns?: Record<string, string[]>;
}

const getDefaultVisibleKeys = (columns: TableViewColumn[]) =>
    columns
        .filter((column) => column.defaultVisible !== false || column.hideable === false)
        .map((column) => column.key);

export function useTableViewState(
    tableKey: string,
    columns: TableViewColumn[],
    options?: TableViewStateOptions,
) {
    const storageKey = `table-views:${tableKey}`;
    const nonHideableKeys = useMemo(
        () => columns.filter((column) => column.hideable === false).map((column) => column.key),
        [columns],
    );
    const normalizedRole = useMemo(
        () =>
            String(options?.role || '')
                .toUpperCase()
                .replace(/[\s_]+/g, ''),
        [options?.role],
    );
    const roleDefaultVisibleKeys = useMemo(() => {
        const templates = options?.roleDefaultColumns || {};
        const templateEntries = Object.entries(templates);
        if (!normalizedRole || templateEntries.length === 0) return [];

        const matchedEntry = templateEntries.find(
            ([roleKey]) => roleKey.toUpperCase().replace(/[\s_]+/g, '') === normalizedRole,
        );
        if (!matchedEntry) return [];

        return Array.from(
            new Set([
                ...matchedEntry[1].filter((columnKey) =>
                    columns.some((column) => column.key === columnKey),
                ),
                ...nonHideableKeys,
            ]),
        );
    }, [columns, nonHideableKeys, normalizedRole, options?.roleDefaultColumns]);
    const defaultVisibleKeys = useMemo(
        () =>
            roleDefaultVisibleKeys.length > 0
                ? roleDefaultVisibleKeys
                : getDefaultVisibleKeys(columns),
        [columns, roleDefaultVisibleKeys],
    );
    const [activeView, setActiveView] = useState('default');
    const [savedViews, setSavedViews] = useState<Array<{ name: string; columns: string[] }>>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleKeys);

    useEffect(() => {
        setVisibleColumns(defaultVisibleKeys);
    }, [defaultVisibleKeys]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as Partial<TableViewStorage>;
            const views = Array.isArray(parsed.views)
                ? parsed.views
                      .filter(
                          (view) => typeof view?.name === 'string' && Array.isArray(view.columns),
                      )
                      .map((view) => ({
                          name: view.name,
                          columns: view.columns.filter((columnKey) =>
                              columns.some((column) => column.key === columnKey),
                          ),
                      }))
                : [];
            const loadedActiveView =
                typeof parsed.activeView === 'string' ? parsed.activeView : 'default';

            setSavedViews(views);
            setActiveView(loadedActiveView);

            if (loadedActiveView === 'default') {
                setVisibleColumns(defaultVisibleKeys);
                return;
            }

            const matchedView = views.find((view) => view.name === loadedActiveView);
            setVisibleColumns(
                matchedView
                    ? Array.from(new Set([...matchedView.columns, ...nonHideableKeys]))
                    : defaultVisibleKeys,
            );
        } catch (error) {
            console.error('Failed to restore table views', error);
        }
    }, [columns, defaultVisibleKeys, nonHideableKeys, storageKey]);

    const persist = (
        nextActiveView: string,
        nextSavedViews: Array<{ name: string; columns: string[] }>,
    ) => {
        if (typeof window === 'undefined') return;
        const payload: TableViewStorage = {
            activeView: nextActiveView,
            views: nextSavedViews,
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
    };

    const visibleColumnSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

    const toggleColumn = (columnKey: string) => {
        if (nonHideableKeys.includes(columnKey)) return;
        setActiveView('default');
        setVisibleColumns((previous) => {
            const next = previous.includes(columnKey)
                ? previous.filter((key) => key !== columnKey)
                : [...previous, columnKey];
            return Array.from(new Set([...next, ...nonHideableKeys]));
        });
    };

    const applyView = (viewName: string) => {
        if (viewName === 'default') {
            setActiveView('default');
            setVisibleColumns(defaultVisibleKeys);
            persist('default', savedViews);
            return;
        }

        const matchedView = savedViews.find((view) => view.name === viewName);
        if (!matchedView) return;

        const nextVisibleColumns = Array.from(
            new Set([...matchedView.columns, ...nonHideableKeys]),
        );
        setActiveView(viewName);
        setVisibleColumns(nextVisibleColumns);
        persist(viewName, savedViews);
    };

    const saveCurrentView = (viewName: string) => {
        const normalizedName = viewName.trim();
        if (!normalizedName) return;

        const columnsToSave = visibleColumns.filter((key) => !nonHideableKeys.includes(key));
        const nextSavedViews = [
            ...savedViews.filter((view) => view.name !== normalizedName),
            { name: normalizedName, columns: columnsToSave },
        ].sort((a, b) => a.name.localeCompare(b.name));

        setSavedViews(nextSavedViews);
        setActiveView(normalizedName);
        persist(normalizedName, nextSavedViews);
    };

    const deleteView = (viewName: string) => {
        const nextSavedViews = savedViews.filter((view) => view.name !== viewName);
        const nextActiveView = activeView === viewName ? 'default' : activeView;
        setSavedViews(nextSavedViews);
        setActiveView(nextActiveView);

        if (nextActiveView === 'default') {
            setVisibleColumns(defaultVisibleKeys);
        }
        persist(nextActiveView, nextSavedViews);
    };

    const resetToDefault = () => {
        setActiveView('default');
        setVisibleColumns(defaultVisibleKeys);
        persist('default', savedViews);
    };

    const exportViews = () => {
        const payload = {
            tableKey,
            activeView,
            views: savedViews,
            exportedAt: new Date().toISOString(),
        };
        return JSON.stringify(payload, null, 2);
    };

    const importViews = (raw: string) => {
        try {
            const parsed = JSON.parse(raw) as {
                tableKey?: string;
                activeView?: string;
                views?: Array<{ name: string; columns: string[] }>;
            };
            const importedViews = Array.isArray(parsed.views)
                ? parsed.views
                      .filter(
                          (view) => typeof view?.name === 'string' && Array.isArray(view.columns),
                      )
                      .map((view) => ({
                          name: view.name.trim(),
                          columns: view.columns.filter((columnKey) =>
                              columns.some((column) => column.key === columnKey),
                          ),
                      }))
                      .filter((view) => view.name.length > 0)
                : [];

            const mergedViews = [
                ...savedViews.filter(
                    (existing) =>
                        !importedViews.some((incoming) => incoming.name === existing.name),
                ),
                ...importedViews,
            ].sort((a, b) => a.name.localeCompare(b.name));

            const nextActiveView =
                typeof parsed.activeView === 'string' &&
                mergedViews.some((view) => view.name === parsed.activeView)
                    ? parsed.activeView
                    : activeView;

            setSavedViews(mergedViews);
            if (nextActiveView !== 'default') {
                const matched = mergedViews.find((view) => view.name === nextActiveView);
                if (matched) {
                    setVisibleColumns(
                        Array.from(new Set([...matched.columns, ...nonHideableKeys])),
                    );
                }
            }
            persist(nextActiveView, mergedViews);
            return { ok: true as const, imported: importedViews.length };
        } catch (error) {
            return { ok: false as const, error: 'Invalid table view file format' };
        }
    };

    return {
        activeView,
        savedViews,
        visibleColumns,
        visibleColumnSet,
        toggleColumn,
        applyView,
        saveCurrentView,
        deleteView,
        resetToDefault,
        exportViews,
        importViews,
    };
}

export default useTableViewState;
