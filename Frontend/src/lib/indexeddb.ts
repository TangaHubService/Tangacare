import Dexie, { type Table } from 'dexie';
import type { Medicine, CreateSaleDto } from '../types/pharmacy';

export interface OfflineSale extends CreateSaleDto {
    id?: number;
    offlineId: string;
    createdAt: string;
    status: 'pending' | 'syncing' | 'failed' | 'synced';
    syncError?: string;
    retryCount: number;
}

export class TangaCareDB extends Dexie {
    medicines!: Table<Medicine>;
    saleQueue!: Table<OfflineSale>;
    settings!: Table<{ key: string; value: any }>;

    constructor() {
        super('TangaCareDB');
        this.version(1).stores({
            medicines: '++id, name, code, barcode',
            saleQueue: '++id, offlineId, status, createdAt',
            settings: 'key',
        });
    }
}

export const db = new TangaCareDB();
