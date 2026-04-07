/**
 * Date utilities that respect the user's local timezone.
 * Use these when parsing API date strings to avoid UTC-midnight shifting
 * (e.g. "2024-12-15" as UTC becomes Dec 14 in negative UTC offsets).
 */

/**
 * Parses a date string or value into a Date using the local timezone.
 * - Date-only strings (YYYY-MM-DD) are parsed as local noon to avoid
 *   showing the wrong calendar day in timezones behind UTC.
 * - Full ISO strings are parsed as usual (UTC converted to local for display).
 */
export function parseLocalDate(
    value: string | Date | number | null | undefined,
): Date {
    if (value == null) return new Date(NaN);
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    const s = String(value).trim();
    if (!s) return new Date(NaN);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00');
    return new Date(s);
}

/**
 * Formats a date for display.
 * When locale/timeZone are provided (e.g. from useRuntimeConfig()), tenant settings apply;
 * otherwise uses browser locale and timezone.
 */
export function formatLocalDate(
    value: string | Date | number | null | undefined,
    options: Intl.DateTimeFormatOptions & { locale?: string; timeZone?: string } = {},
): string {
    const date = parseLocalDate(value);
    if (Number.isNaN(date.getTime())) return '—';
    const { locale, timeZone, ...rest } = options;
    return date.toLocaleDateString(locale ?? undefined, {
        timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...rest,
    });
}

/**
 * Formats a date and time for display.
 * When locale/timeZone are provided (e.g. from useRuntimeConfig()), tenant settings apply.
 */
export function formatLocalDateTime(
    value: string | Date | number | null | undefined,
    options: Intl.DateTimeFormatOptions & { locale?: string; timeZone?: string } = {},
): string {
    const date = parseLocalDate(value);
    if (Number.isNaN(date.getTime())) return '—';
    const { locale, timeZone, ...rest } = options;
    return date.toLocaleString(locale ?? undefined, {
        timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...rest,
    });
}
