import { useCallback, useMemo, useState } from 'react';

export interface DrawerState<T = string> {
    open: boolean;
    type: T | null;
    entityId: string | null;
}

export function useDrawerState<T = string>(initialType: T | null = null) {
    const [state, setState] = useState<DrawerState<T>>({
        open: false,
        type: initialType,
        entityId: null,
    });

    const openDrawer = useCallback((type: T, entityId?: string | number) => {
        setState({
            open: true,
            type,
            entityId: entityId !== undefined ? String(entityId) : null,
        });
    }, []);

    const closeDrawer = useCallback(() => {
        setState((prev) => ({ ...prev, open: false }));
    }, []);

    const resetDrawer = useCallback(() => {
        setState({ open: false, type: null, entityId: null });
    }, []);

    return useMemo(
        () => ({
            drawer: state,
            openDrawer,
            closeDrawer,
            resetDrawer,
        }),
        [state, openDrawer, closeDrawer, resetDrawer],
    );
}
