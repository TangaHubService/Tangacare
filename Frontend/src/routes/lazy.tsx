import React, { Suspense } from 'react';
import { RouteContentFallback } from '../components/ui/RouteContentFallback';

export function lazyNamed<T extends React.ComponentType<any>>(
    loader: () => Promise<Record<string, any>>,
    exportName: string,
): React.LazyExoticComponent<T> {
    return React.lazy(async () => {
        const module = await loader();
        return { default: module[exportName] as T };
    });
}

/** Keeps shell visible; skeleton only in the route outlet (not fullscreen lazy flash). */
export function withRouteSuspense(element: React.ReactElement) {
    return <Suspense fallback={<RouteContentFallback />}>{element}</Suspense>;
}
