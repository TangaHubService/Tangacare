import React, { Suspense } from 'react';
import { GlobalLoading } from '../components/ui/GlobalLoading';

export function lazyNamed<T extends React.ComponentType<any>>(
    loader: () => Promise<Record<string, any>>,
    exportName: string,
): React.LazyExoticComponent<T> {
    return React.lazy(async () => {
        const module = await loader();
        return { default: module[exportName] as T };
    });
}

export function withRouteSuspense(element: React.ReactElement) {
    return <Suspense fallback={<GlobalLoading />}>{element}</Suspense>;
}
