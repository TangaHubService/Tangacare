import type { Medicine } from '../types/pharmacy';

export type ExpiryRiskLevel = 'expired' | 'expiring_soon' | 'watch' | 'safe' | 'unknown';

const TABLET_LIKE = /tablet|caplet|capsule|pill|lozenge|gum/i;

function normalizeForm(dosageForm: string): string {
    return String(dosageForm || '').trim();
}

function toSentenceCase(s: string): string {
    if (!s) return '';
    return s
        .replace(/[_-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/** True when we should show pack + loose units (tablets/capsules with pack size). */
export function shouldShowPackBreakdown(med: Pick<Medicine, 'dosage_form' | 'units_per_package'>): boolean {
    const form = normalizeForm(med.dosage_form);
    if (!form) return false;
    if (!TABLET_LIKE.test(form)) return false;
    const perPack = Number(med.units_per_package || 0);
    return perPack > 1;
}

/**
 * Human stock line for shelf: "9 packs + 10 tabs" or "190 bottles".
 */
export function formatPharmacistStock(
    med: Pick<Medicine, 'stock_quantity' | 'dosage_form' | 'unit' | 'units_per_package' | 'base_unit'>,
): string {
    const qty = Number(med.stock_quantity || 0);
    const unitRaw = String(med.unit || med.base_unit || 'unit').trim();
    const unitLabel = unitRaw.toLowerCase();

    if (shouldShowPackBreakdown(med)) {
        const perPack = Number(med.units_per_package || 1);
        const packs = Math.floor(qty / perPack);
        const remainder = qty % perPack;
        const packLabel = packs === 1 ? 'pack' : 'packs';
        if (remainder === 0) {
            return `${packs} ${packLabel}`;
        }
        return `${packs} ${packLabel} + ${remainder} ${unitLabel}`;
    }

    if (qty === 0) {
        return '0';
    }

    const countWord = qty === 1 ? unitLabel.replace(/s$/, '') : unitLabel;
    return `${qty} ${countWord}`;
}

export function strengthFormLabel(med: Pick<Medicine, 'dosage_form' | 'strength'>): string {
    const form = toSentenceCase(normalizeForm(med.dosage_form));
    const strength = String(med.strength || '').trim();
    if (strength && form) return `${form} ${strength}`.trim();
    return strength || form || '—';
}

export function getExpiryRiskLevel(
    expiryDate: Date | null,
    now: Date = new Date(),
): { level: ExpiryRiskLevel; daysUntil: number | null } {
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
        return { level: 'unknown', daysUntil: null };
    }
    const ms = expiryDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(ms / 86400000);
    if (ms < 0) return { level: 'expired', daysUntil };
    if (daysUntil <= 30) return { level: 'expiring_soon', daysUntil };
    if (daysUntil <= 90) return { level: 'watch', daysUntil };
    return { level: 'safe', daysUntil };
}

export function expiryRiskPresentation(level: ExpiryRiskLevel, daysUntil: number | null): {
    label: string;
    sub?: string;
    dotClass: string;
    textClass: string;
} {
    switch (level) {
        case 'expired':
            return {
                label: 'Expired',
                sub: undefined,
                dotClass: 'bg-red-500',
                textClass: 'text-red-600 dark:text-red-400',
            };
        case 'expiring_soon':
            return {
                label: 'Expiring soon',
                sub: daysUntil != null ? `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : undefined,
                dotClass: 'bg-amber-500',
                textClass: 'text-amber-700 dark:text-amber-400',
            };
        case 'watch':
            return {
                label: 'Watch',
                sub: daysUntil != null ? `${daysUntil} days left` : undefined,
                dotClass: 'bg-lime-500',
                textClass: 'text-lime-800 dark:text-lime-400',
            };
        case 'safe':
            return {
                label: 'Safe',
                sub: undefined,
                dotClass: 'bg-emerald-500',
                textClass: 'text-emerald-700 dark:text-emerald-400',
            };
        default:
            return {
                label: '—',
                sub: undefined,
                dotClass: 'bg-slate-300 dark:bg-slate-600',
                textClass: 'text-slate-500',
            };
    }
}

export type ShelfStatus = 'out' | 'low' | 'ok';

export function getShelfStatus(
    med: Pick<Medicine, 'stock_quantity' | 'reorder_point' | 'min_stock_level'>,
): ShelfStatus {
    const quantity = Number(med.stock_quantity || 0);
    const reorderPoint = Number(med.reorder_point ?? med.min_stock_level ?? 0);
    const minLevel = Number(med.min_stock_level || 0);
    if (quantity <= 0) return 'out';
    const low =
        reorderPoint > 0 ? quantity <= reorderPoint : minLevel > 0 ? quantity <= minLevel : false;
    if (low) return 'low';
    return 'ok';
}

export function shelfStatusPresentation(status: ShelfStatus): {
    label: string;
    textClass: string;
} {
    switch (status) {
        case 'out':
            return {
                label: 'Out of stock',
                textClass: 'text-red-600 dark:text-red-400',
            };
        case 'low':
            return {
                label: 'Low stock',
                textClass: 'text-amber-700 dark:text-amber-400',
            };
        default:
            return {
                label: 'In stock',
                textClass: 'text-emerald-700 dark:text-emerald-400',
            };
    }
}
