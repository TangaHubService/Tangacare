import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/indexeddb';
import { pharmacyService } from '../services/pharmacy.service';
import { toast } from 'react-hot-toast';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [queueCount, setQueueCount] = useState(0);

    const updateQueueCount = useCallback(async () => {
        const count = await db.saleQueue.where('status').anyOf(['pending', 'failed']).count();
        setQueueCount(count);
    }, []);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        updateQueueCount();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [updateQueueCount]);

    const syncQueue = useCallback(async () => {
        if (!navigator.onLine) return;

        const pendingSales = await db.saleQueue
            .where('status')
            .anyOf(['pending', 'failed'])
            .toArray();

        if (pendingSales.length === 0) return;

        for (const sale of pendingSales) {
            try {
                // Mark as syncing
                await db.saleQueue.update(sale.id!, { status: 'syncing' });

                // Attempt sync with idempotency key
                await pharmacyService.createSale(sale, {
                    headers: { 'idempotency-key': sale.offlineId },
                });

                // Mark as synced
                await db.saleQueue.update(sale.id!, { status: 'synced' });
                toast.success('Offline sale synced successfully');
            } catch (error: any) {
                console.error(`Failed to sync sale ${sale.offlineId}:`, error);
                await db.saleQueue.update(sale.id!, {
                    status: 'failed',
                    syncError: error.message || 'Unknown error',
                    retryCount: (sale.retryCount || 0) + 1,
                });
            }
        }
        updateQueueCount();
    }, [updateQueueCount]);

    useEffect(() => {
        if (isOnline) {
            syncQueue();
        }
    }, [isOnline, syncQueue]);

    return { isOnline, queueCount, updateQueueCount, syncQueue };
}
