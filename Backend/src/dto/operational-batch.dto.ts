/** Batch execution row for facility stock workspace (FEFO, expiry, sellable). */
export type OperationalBatchStatus =
    | 'EXPIRED'
    | 'EXPIRING_SOON'
    | 'OUT_OF_STOCK'
    | 'LOW_BATCH_STOCK'
    | 'BLOCKED'
    | 'ACTIVE';

export interface OperationalBatchRowDto {
    batchId: number;
    medicineId: number;
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
    daysToExpiry: number | null;
    availableQty: number;
    reservedQty: number;
    sellableQty: number;
    batchStatus: OperationalBatchStatus;
    isExpired: boolean;
    isExpiringSoon: boolean;
    isOutOfStock: boolean;
    isBlocked: boolean;
    isFefoCandidate: boolean;
    locationName: string | null;
    lastMovementAt: string | null;
    unitCost: number | null;
    unitPrice: number | null;
    controlledDrug: boolean;
}
