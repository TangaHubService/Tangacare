export const SETTINGS_KEYS = {
    LOCALIZATION_LOCALE: 'localization.locale',
    LOCALIZATION_TIMEZONE: 'localization.timezone',
    LOCALIZATION_DATE_FORMAT: 'localization.date_format',
    LOCALIZATION_NUMBER_FORMAT: 'localization.number_format',
    LOCALIZATION_FIRST_DAY_OF_WEEK: 'localization.first_day_of_week',

    CURRENCY_BASE: 'currency_pricing.base_currency',
    CURRENCY_SYMBOL: 'currency_pricing.currency_symbol',
    CURRENCY_DECIMALS: 'currency_pricing.currency_decimals',
    CURRENCY_ROUNDING_MODE: 'currency_pricing.rounding_mode',
    PRICING_DEFAULT_MARKUP_PERCENT: 'currency_pricing.default_markup_percent',
    PRICING_MAX_DISCOUNT_PERCENT: 'currency_pricing.max_discount_percent',

    TAX_VAT_ENABLED: 'tax_fiscal.vat_enabled',
    TAX_VAT_VALUE_MODE: 'tax_fiscal.vat_value_mode',
    TAX_DEFAULT_VAT_RATE: 'tax_fiscal.default_vat_rate',
    TAX_REGIME_CODE: 'tax_fiscal.tax_regime_code',
    FISCAL_PROVIDER: 'tax_fiscal.fiscal_integration_provider',
    FISCAL_EBM_ENABLED: 'tax_fiscal.ebm_enabled',

    INVENTORY_MIN_STOCK_THRESHOLD_PERCENTAGE: 'inventory_rules.min_stock_threshold_percentage',
    INVENTORY_EXPIRY_ALERT_DAYS: 'inventory_rules.expiry_alert_days',
    INVENTORY_EXPIRY_WARNING_DAYS: 'inventory_rules.expiry_warning_days',
    INVENTORY_EXPIRY_CRITICAL_DAYS: 'inventory_rules.expiry_critical_days',
    INVENTORY_REORDER_MODE: 'inventory_rules.reorder_mode',
    INVENTORY_FEFO_STRICT: 'inventory_rules.fefo_strict',
    INVENTORY_WAC_ENABLED: 'inventory_rules.wac_enabled',
    INVENTORY_PAR_ENABLED: 'inventory_rules.par_enabled',
    INVENTORY_JIT_ENABLED: 'inventory_rules.jit_enabled',
    INVENTORY_ABC_ENABLED: 'inventory_rules.abc_enabled',

    CONTROLLED_RULES_ENABLED: 'controlled_medicines.rules_enabled',
    CONTROLLED_REQUIRE_PRESCRIPTION: 'controlled_medicines.require_prescription',
    CONTROLLED_REQUIRE_PATIENT_ID: 'controlled_medicines.require_patient_id',
    CONTROLLED_REQUIRE_DUAL_APPROVAL: 'controlled_medicines.require_dual_approval',
    CONTROLLED_STRICT_SCHEDULE_ENFORCEMENT: 'controlled_medicines.strict_schedule_enforcement',

    /** When true, medicines with drug_schedule prescription_only require prescription_id on sale. */
    RX_SCHEDULE_ENFORCEMENT_ENABLED: 'compliance.rx_schedule_enforcement_enabled',

    /** When true, block PO creation against suppliers not in qualified status. */
    SUPPLIER_REQUIRE_QUALIFIED_FOR_PO: 'procurement.supplier_require_qualified_for_po',

    REPORTING_DEFAULT_EXPORT_FORMAT: 'reporting.default_export_format',
    REPORTING_RETENTION_DAYS: 'reporting.retention_days',

    NOTIFICATIONS_ESCALATION_MINUTES: 'notifications.escalation_minutes',
    NOTIFICATIONS_CHANNELS: 'notifications.channels',

    INTEGRATIONS_EBM_CREDENTIALS_REF: 'integrations.ebm.credentials_ref',
    INTEGRATIONS_EBM_ENDPOINT: 'integrations.ebm.endpoint',
    INTEGRATIONS_EBM_RETRY_POLICY: 'integrations.ebm.retry_policy',

    COMPLIANCE_AUDIT_RETENTION_DAYS: 'compliance.audit_retention_days',
    COMPLIANCE_IMMUTABLE_LOGS_ENABLED: 'compliance.immutable_logs_enabled',
    COMPLIANCE_SOD_ENFORCED: 'compliance.separation_of_duty_enforced',

    UI_THEME: 'ui_preferences.theme',
    UI_DASHBOARD_LAYOUT: 'ui_preferences.dashboard_layout',
    UI_COMPACT_TABLES: 'ui_preferences.compact_tables',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];
