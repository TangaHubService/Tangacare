export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
    purchase: 'Purchase',
    receive: 'Receive',
    sale: 'Sale',
    dispense: 'Dispense',
    return: 'Return',
    transfer: 'Transfer',
    adjustment: 'Adjustment',
    expired_removal: 'Expired Removal',
    expiry: 'Expiry',
    damage: 'Damage',
    create: 'Create',
    update: 'Update',
};

export const STOCK_MOVEMENT_TYPES = Object.keys(STOCK_MOVEMENT_LABELS);

export const normalizeStockMovementType = (value: unknown): string =>
    String(value || '')
        .trim()
        .toLowerCase();

export const getStockMovementLabel = (value: unknown): string => {
    const movementType = normalizeStockMovementType(value);
    return STOCK_MOVEMENT_LABELS[movementType] || movementType || 'Unknown';
};
