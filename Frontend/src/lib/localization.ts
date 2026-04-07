/**
 * Locale-aware formatting using tenant/facility settings (locale, timezone, dateFormat, numberFormat).
 * Prefer useRuntimeConfig().formatDate / formatNumber in components so tenant settings apply.
 */

export interface LocalizationConfig {
    locale: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
}

const DEFAULT_LOCALE = 'en-RW';
const DEFAULT_TIMEZONE = 'Africa/Kigali';

/**
 * Format a date for display using config locale and timezone.
 * Uses Intl.DateTimeFormat so tenant setting applies instead of browser-only.
 */
export function formatDateWithConfig(
    value: string | Date | number | null | undefined,
    config: LocalizationConfig,
    options: Intl.DateTimeFormatOptions & { dateOnly?: boolean } = {},
): string {
    if (value == null) return '—';
    const date = value instanceof Date ? value : new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '—';
    const locale = config.locale || DEFAULT_LOCALE;
    const timeZone = config.timezone || DEFAULT_TIMEZONE;
    const dateOnly = options.dateOnly ?? true;
    const opts: Intl.DateTimeFormatOptions = {
        timeZone,
        ...(dateOnly
            ? { year: 'numeric', month: '2-digit', day: '2-digit' }
            : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        ...options,
    };
    return date.toLocaleDateString(locale, opts);
}

/**
 * Format a date and time for display using config locale and timezone.
 */
export function formatDateTimeWithConfig(
    value: string | Date | number | null | undefined,
    config: LocalizationConfig,
    options: Intl.DateTimeFormatOptions = {},
): string {
    if (value == null) return '—';
    const date = value instanceof Date ? value : new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '—';
    const locale = config.locale || DEFAULT_LOCALE;
    const timeZone = config.timezone || DEFAULT_TIMEZONE;
    return date.toLocaleString(locale, {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
}

/**
 * Format a number for display using config locale and numberFormat.
 * numberFormat values like '1,234.56' / '1 234,56' inform grouping and decimal separator via locale.
 */
export function formatNumberWithConfig(
    value: number | string | null | undefined,
    config: LocalizationConfig,
    options: Intl.NumberFormatOptions = {},
): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '—';
    const locale = config.locale || DEFAULT_LOCALE;
    return num.toLocaleString(locale, {
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
        ...options,
    });
}
