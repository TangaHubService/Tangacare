import { SETTINGS_KEYS } from './settings.constants';
import { SETTINGS_DEFINITION_SEEDS } from './settings-definition.seed';

export interface EffectiveSettingsContext {
    tenantId?: number;
    branchId?: number;
    userId?: number;
    domain?: unknown;
}

export interface RuntimeConfig {
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

const DEFAULT_VALUES: Record<string, any> = Object.fromEntries(
    SETTINGS_DEFINITION_SEEDS.map((seed) => [seed.key, seed.default_value]),
);

function getDefault<T>(key: string, fallback: T): T {
    const v = DEFAULT_VALUES[key];
    if (v === undefined || v === null) return fallback;
    return v as T;
}

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}

/**
 * SettingsService stub (system wipe mode).
 *
 * The original implementation read effective tenant/branch/user overrides from the DB.
 * For “settings wipe”, we return built-in defaults only, so business logic continues
 * to work without exposing settings editing/config endpoints.
 */
export class SettingsService {
    // Keep constructor compatible with callers (transaction managers, query runners, etc).
    constructor(_entityManager?: any) {}

    static systemDefaultValue(key: string): any {
        return DEFAULT_VALUES[key];
    }

    async getEffectiveValuesMap(_context: EffectiveSettingsContext): Promise<Record<string, any>> {
        // Copy to avoid accidental mutation.
        return { ...DEFAULT_VALUES };
    }

    async getEffectiveValue<T = any>(key: string, _context: EffectiveSettingsContext): Promise<T> {
        return getDefault<T>(key, undefined as any);
    }

    async getRuntimeConfig(_context: EffectiveSettingsContext): Promise<RuntimeConfig> {
        const currencyCode = String(getDefault(SETTINGS_KEYS.CURRENCY_BASE, 'RWF'));
        const currencySymbol = String(getDefault(SETTINGS_KEYS.CURRENCY_SYMBOL, currencyCode));
        const currencyDecimals = Number(getDefault(SETTINGS_KEYS.CURRENCY_DECIMALS, 0));
        const currencyRoundingMode = String(
            getDefault(SETTINGS_KEYS.CURRENCY_ROUNDING_MODE, 'half_up'),
        );

        return {
            currencyCode,
            currencySymbol,
            currencyDecimals,
            currencyRoundingMode,
            maxDiscountPercent: Number(getDefault(SETTINGS_KEYS.PRICING_MAX_DISCOUNT_PERCENT, 20)),
            vatEnabled: Boolean(getDefault(SETTINGS_KEYS.TAX_VAT_ENABLED, true)),
            vatRate: Number(getDefault(SETTINGS_KEYS.TAX_DEFAULT_VAT_RATE, 0.18)),
            locale: String(getDefault(SETTINGS_KEYS.LOCALIZATION_LOCALE, 'en-RW')),
            timezone: String(getDefault(SETTINGS_KEYS.LOCALIZATION_TIMEZONE, 'Africa/Kigali')),
            dateFormat: String(getDefault(SETTINGS_KEYS.LOCALIZATION_DATE_FORMAT, 'DD/MM/YYYY')),
            numberFormat: String(getDefault(SETTINGS_KEYS.LOCALIZATION_NUMBER_FORMAT, '1,234.56')),
        };
    }

    async normalizeVatRateToDecimal(
        rawVatRate: number | undefined,
        context: EffectiveSettingsContext,
    ): Promise<number> {
        void context;
        const resolvedRaw =
            typeof rawVatRate === 'number' && Number.isFinite(rawVatRate)
                ? rawVatRate
                : Number(getDefault(SETTINGS_KEYS.TAX_DEFAULT_VAT_RATE, 0.18));

        // Original logic treated >1 values as percentages.
        const decimals = resolvedRaw > 1 ? resolvedRaw / 100 : resolvedRaw;
        return clamp01(decimals);
    }

    async normalizeVatRateToPercent(
        rawVatRate: number | undefined,
        context: EffectiveSettingsContext,
    ): Promise<number> {
        void context;
        const decimal = await this.normalizeVatRateToDecimal(rawVatRate, context);
        return Number((decimal * 100).toFixed(4));
    }

    // The following methods belonged to the settings editing API (definitions/effective/update/history).
    // They are not used by the rest of the system after removing the settings endpoints.
    async getDefinitions(): Promise<any[]> {
        return [];
    }

    async getEffective(): Promise<any> {
        return {
            context: {},
            resolved_at: new Date().toISOString(),
            values: {},
            items: [],
        };
    }

    async validateChanges(): Promise<any[]> {
        return [];
    }

    async updateScopeSettings(): Promise<any> {
        return {
            scope_type: 'tenant',
            scope_id: 0,
            tenant_id: 0,
            applied: [],
            pending_approvals: [],
        };
    }

    async getHistory(): Promise<any[]> {
        return [];
    }

    async getDiff(): Promise<any> {
        return {
            from_version: 0,
            to_version: 0,
            changes: [],
            summary: [],
        };
    }
}

