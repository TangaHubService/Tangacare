import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
    formatDateWithConfig,
    formatDateTimeWithConfig,
    formatNumberWithConfig,
    type LocalizationConfig,
} from '../lib/localization';

interface RuntimeConfig {
    currencyCode: string;
    currencySymbol: string;
    currencyDecimals: number;
    currencyRoundingMode?: string;
    maxDiscountPercent: number;
    vatEnabled: boolean;
    vatRate: number;
    locale: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
}

interface RuntimeConfigContextType {
    /** Flattened config from backend (currency, tax, locale). */
    config: RuntimeConfig | null;
    /** Format amount for display using tenant currency/symbol/decimals. */
    formatMoney: (amount: number | string | null | undefined) => string;
    /** Format date (date-only) using tenant locale and timezone. */
    formatDate: (value: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions & { dateOnly?: boolean }) => string;
    /** Format date and time using tenant locale and timezone. */
    formatDateTime: (value: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
    /** Format number using tenant locale. */
    formatNumber: (value: number | string | null | undefined, options?: Intl.NumberFormatOptions) => string;
    /** Currency code (e.g. RWF). */
    currencyCode: string;
    /** Symbol for display (e.g. RWF). */
    currencySymbol: string;
    /** Whether VAT is enabled for this tenant/branch. */
    vatEnabled: boolean;
    /** Rounding mode to use when displaying totals. */
    currencyRoundingMode?: string;
    locale: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
    /** Default VAT rate (decimal 0–1). */
    vatRate: number;
    /** Max discount percent allowed (0–100). */
    maxDiscountPercent: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/** Emergency-only defaults used when runtime-config API is unavailable. Real values must come from backend settings. */
const defaultConfig: RuntimeConfig = {
    currencyCode: 'RWF',
    currencySymbol: 'RWF',
    currencyDecimals: 0,
    currencyRoundingMode: 'half_up',
    maxDiscountPercent: 20,
    vatEnabled: true,
    vatRate: 0.18,
    locale: 'en-RW',
    timezone: 'Africa/Kigali',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '1,234.56',
};

const RuntimeConfigContext = createContext<RuntimeConfigContextType | undefined>(undefined);

function formatMoneyWithConfig(
    amount: number | string | null | undefined,
    config: RuntimeConfig,
): string {
    const num = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(num)) return '—';
    const decimals = config.currencyDecimals ?? 0;
    const rounded =
        decimals === 0 ? Math.round(num) : Number(num.toFixed(decimals));
    const locale = config.locale || 'en-RW';
    const formatted = rounded.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return `${config.currencySymbol} ${formatted}`.trim();
}

function toLocalizationConfig(c: RuntimeConfig): LocalizationConfig {
    return {
        locale: c.locale || 'en-RW',
        timezone: c.timezone || 'Africa/Kigali',
        dateFormat: c.dateFormat || 'DD/MM/YYYY',
        numberFormat: c.numberFormat || '1,234.56',
    };
}

export const RuntimeConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, organizationId, facilityId } = useAuth();
    const [config, setConfig] = useState<RuntimeConfig | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchConfig = useCallback(async () => {
        if (!isAuthenticated || !organizationId) {
            setConfig(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        // Settings runtime-config endpoint removed; use built-in defaults.
        setConfig(defaultConfig);
        setIsLoading(false);
    }, [isAuthenticated, organizationId, facilityId]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const formatMoney = useCallback(
        (amount: number | string | null | undefined) => {
            const c = config ?? defaultConfig;
            return formatMoneyWithConfig(amount, c);
        },
        [config],
    );

    const locConfig = useMemo(() => toLocalizationConfig(config ?? defaultConfig), [config]);

    const formatDate = useCallback(
        (value: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions & { dateOnly?: boolean }) => {
            return formatDateWithConfig(value, locConfig, options ?? { dateOnly: true });
        },
        [locConfig],
    );

    const formatDateTime = useCallback(
        (value: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions) => {
            return formatDateTimeWithConfig(value, locConfig, options);
        },
        [locConfig],
    );

    const formatNumber = useCallback(
        (value: number | string | null | undefined, options?: Intl.NumberFormatOptions) => {
            return formatNumberWithConfig(value, locConfig, options);
        },
        [locConfig],
    );

    const c = config ?? defaultConfig;
    const value = useMemo<RuntimeConfigContextType>(
        () => ({
            config: c,
            formatMoney,
            formatDate,
            formatDateTime,
            formatNumber,
            currencyCode: c.currencyCode,
            currencyRoundingMode: c.currencyRoundingMode ?? 'half_up',
            locale: c.locale,
            timezone: c.timezone,
            dateFormat: c.dateFormat,
            numberFormat: c.numberFormat,
            currencySymbol: c.currencySymbol,
            vatEnabled: c.vatEnabled,
            vatRate: c.vatRate,
            maxDiscountPercent: c.maxDiscountPercent,
            isLoading,
            error,
            refetch: fetchConfig,
        }),
        [config, formatMoney, formatDate, formatDateTime, formatNumber, isLoading, error, fetchConfig],
    );

    return (
        <RuntimeConfigContext.Provider value={value}>
            {children}
        </RuntimeConfigContext.Provider>
    );
};

const defaultLocConfig = toLocalizationConfig(defaultConfig);

export function useRuntimeConfig(): RuntimeConfigContextType {
    const ctx = useContext(RuntimeConfigContext);
    if (ctx === undefined) {
        return {
            config: defaultConfig,
            formatMoney: (amount) => formatMoneyWithConfig(amount, defaultConfig),
            formatDate: (value, options) => formatDateWithConfig(value, defaultLocConfig, options ?? { dateOnly: true }),
            formatDateTime: (value, options) => formatDateTimeWithConfig(value, defaultLocConfig, options),
            formatNumber: (value, options) => formatNumberWithConfig(value, defaultLocConfig, options),
            currencyCode: defaultConfig.currencyCode,
            currencyRoundingMode: defaultConfig.currencyRoundingMode ?? 'half_up',
            currencySymbol: defaultConfig.currencySymbol,
            vatEnabled: defaultConfig.vatEnabled,
            locale: defaultConfig.locale,
            timezone: defaultConfig.timezone,
            dateFormat: defaultConfig.dateFormat,
            numberFormat: defaultConfig.numberFormat,
            vatRate: defaultConfig.vatRate,
            maxDiscountPercent: defaultConfig.maxDiscountPercent,
            isLoading: false,
            error: null,
            refetch: async () => {},
        };
    }
    return ctx;
}
