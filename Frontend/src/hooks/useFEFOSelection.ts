import { useState, useEffect, useCallback } from 'react';
import { parseLocalDate, formatLocalDate } from '../lib/date';

export interface StockWithBatch {
    id: number;
    batch_id: number;
    quantity: number;
    reserved_quantity: number;
    batch?: {
        id: number;
        batch_number: string;
        expiry_date: string | Date;
    };
}

export interface FEFOSelection {
    /** The automatically selected FEFO stock record */
    selectedStock: StockWithBatch | null;
    /** Number of days until expiry for the selected batch */
    daysUntilExpiry: number | null;
    /** True if user has manually overridden the FEFO selection */
    isOverridden: boolean;
    /** Required when FEFO is overridden */
    overrideReason: string;
    /** Set override reason before calling selectStock */
    setOverrideReason: (reason: string) => void;
    /** Manually select a different batch (requires overrideReason) */
    selectStock: (stock: StockWithBatch) => void;
    /** Reset to automatic FEFO selection */
    resetToFEFO: () => void;
    /** Human-readable expiry label: 'Exp 30 Apr 2026 (45 days)' */
    expiryLabel: string | null;
    /** True if the FEFO batch expires within 30 days */
    isNearExpiry: boolean;
    /** True if the FEFO batch is already expired */
    isExpired: boolean;
}

export const FEFO_OVERRIDE_REASONS = [
    'Batch damaged or compromised',
    'Patient-specific batch requirement',
    'Recall on FEFO batch',
    'Other (see notes)',
] as const;

/**
 * H-5: FEFO (First-Expired, First-Out) auto-selection hook.
 *
 * Given a list of stock records (already sorted by expiry ASC from the API),
 * auto-selects the earliest-expiring available batch with stock > 0.
 *
 * Allows override with mandatory reason logging.
 */
export const useFEFOSelection = (
    availableStocks: StockWithBatch[],
    onOverride?: (stock: StockWithBatch, reason: string) => void,
): FEFOSelection => {
    const [selectedStock, setSelectedStock] = useState<StockWithBatch | null>(null);
    const [isOverridden, setIsOverridden] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');

    // Auto-select FEFO whenever available stocks change
    useEffect(() => {
        if (isOverridden) return; // Don't override manual selection

        // Stocks should come pre-sorted by expiry_date ASC from the API.
        // Filter for available stock only.
        const available = availableStocks.filter(
            (s) => s.quantity - (s.reserved_quantity || 0) > 0,
        );

        if (available.length === 0) {
            setSelectedStock(null);
            return;
        }

        // Sort by expiry date ascending (FEFO)
        const sorted = [...available].sort((a, b) => {
            const aDate = a.batch?.expiry_date ? parseLocalDate(a.batch.expiry_date).getTime() : Infinity;
            const bDate = b.batch?.expiry_date ? parseLocalDate(b.batch.expiry_date).getTime() : Infinity;
            return aDate - bDate;
        });

        setSelectedStock(sorted[0]);
    }, [availableStocks, isOverridden]);

    const selectStock = useCallback(
        (stock: StockWithBatch) => {
            if (!overrideReason.trim()) {
                // Hook consumers should show validation — reason is mandatory
                console.warn('[FEFO] Override reason required before changing batch selection');
                return;
            }
            setSelectedStock(stock);
            setIsOverridden(true);
            if (onOverride) onOverride(stock, overrideReason);
        },
        [overrideReason, onOverride],
    );

    const resetToFEFO = useCallback(() => {
        setIsOverridden(false);
        setOverrideReason('');
    }, []);

    // Compute expiry metadata
    const daysUntilExpiry = selectedStock?.batch?.expiry_date
        ? Math.floor(
              (parseLocalDate(selectedStock.batch.expiry_date).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
          )
        : null;

    const expiryLabel = selectedStock?.batch?.expiry_date
        ? `Exp ${formatLocalDate(selectedStock.batch.expiry_date, { day: '2-digit', month: 'short', year: 'numeric' })}${daysUntilExpiry !== null ? ` (${daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'TODAY'})` : ''}`
        : null;

    const isNearExpiry = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

    return {
        selectedStock,
        daysUntilExpiry,
        isOverridden,
        overrideReason,
        setOverrideReason,
        selectStock,
        resetToFEFO,
        expiryLabel,
        isNearExpiry,
        isExpired,
    };
};
