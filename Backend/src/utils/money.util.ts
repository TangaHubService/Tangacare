/**
 * Money formatting utility. Use settings-derived currency/symbol/decimals at call sites.
 * Avoids hardcoding currency or decimal places in business logic.
 */

export interface MoneyFormatOptions {
    /** ISO currency code (e.g. RWF, USD) - used only for display context */
    currencyCode?: string;
    /** Symbol to show (e.g. RWF, $). Prefer from tenant settings. */
    symbol?: string;
    /** Decimal places. From settings currency_decimals. */
    decimals?: number;
    /** Locale for number formatting (e.g. en-RW). Optional. */
    locale?: string;
}

const DEFAULT_DECIMALS = 0;
const DEFAULT_SYMBOL = 'RWF';

/**
 * Format a numeric amount for display. Callers should pass symbol/decimals from settings.
 */
export function formatMoney(
    amount: number | string | null | undefined,
    options: MoneyFormatOptions = {},
): string {
    const num = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(num)) {
        return '—';
    }
    const decimals = typeof options.decimals === 'number' && options.decimals >= 0 ? options.decimals : DEFAULT_DECIMALS;
    const symbol = options.symbol ?? DEFAULT_SYMBOL;
    const rounded = decimals === 0 ? Math.round(num) : Number(num.toFixed(decimals));
    const formatted = options.locale
        ? rounded.toLocaleString(options.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : rounded.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${symbol} ${formatted}`.trim();
}

/**
 * Round amount to configured decimal places (e.g. for invoice totals).
 */
export function roundMoney(amount: number, decimals: number = DEFAULT_DECIMALS): number {
    if (!Number.isFinite(amount)) return 0;
    if (decimals <= 0) return Math.round(amount);
    const factor = 10 ** decimals;
    return Math.round(amount * factor) / factor;
}
