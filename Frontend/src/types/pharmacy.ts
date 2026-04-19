import type { User } from './auth';

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalValue?: number;
    };
}

export interface DashboardStats {
    medicinesInStock: string;
    lowStockWarning: number;
    expiringSoon: number;
    dailySales: string;
    totalSalesAllTime?: number;

    dailySalesChart?: Array<{ date: string; sales: number }>;

    staffCount?: number;
    totalInventoryValue?: number;

    activeAlertsCount?: number;
    trends: {
        medicines: string;
        lowStock: string;
        expiring: string;
        sales: string;
    };
    isPositive: {
        medicines: boolean;
        lowStock: boolean;
        expiring: boolean;
        sales: boolean;
    };
}

export interface Medicine {
    id: number;
    code: string;
    barcode?: string;
    name: string;
    generic_name?: string;
    manufacturer?: string;
    brand_name?: string;
    strength: string;
    dosage_form: string;
    unit: string;
    selling_price: number;
    cost_price?: number;
    markup_percent?: number;
    min_stock_level?: number;
    reorder_point?: number;
    target_stock_level?: number;
    lead_time_days?: number;
    safety_stock_quantity?: number;
    organization_id?: number | null;
    category_id?: number;
    category_name?: string;
    category?: MedicineCategory;
    supplier_name?: string;
    is_controlled_drug: boolean;
    controlled_flag?: boolean;
    drug_schedule?:
        | 'unclassified'
        | 'prescription_only'
        | 'controlled_substance_sch_ii'
        | 'controlled_substance_sch_iii'
        | 'controlled_substance_sch_iv'
        | 'pharmacist_only';
    stock_quantity?: number;
    expiry_date?: string;
    created_at?: string;
    updated_at?: string;
    last_updated?: string;
    allow_partial_sales?: boolean;
    units_per_package?: number;
    base_unit?: string;
}

export interface CartItem extends Medicine {
    quantity: number;
    selectedBatch?: Batch;
}

export interface Organization {
    id: number;
    name: string;
    code?: string;
    type?: string;
    subscription_status?: string;
    is_active?: boolean;
    address?: string;
    phone?: string;
    email?: string;
    legal_name?: string;
    registration_number?: string;
    medical_license?: string;
    city?: string;
    country?: string;
    tax_registration_number?: string;
    business_license_number?: string;
}

export interface Facility {
    id: number;
    name: string;
    type: 'hospital' | 'clinic' | 'pharmacy_shop';
    address?: string;
    phone?: string;
    email?: string;
    organization_id?: number;
    organization?: Organization;
    admin_name?: string;
    facility_admin_id?: number;
    facility_admin?: import('./auth').User;
    departments_enabled?: boolean;
    controlled_drug_rules_enabled?: boolean;
    ebm_enabled?: boolean;
    min_stock_threshold_percentage?: number;
    expiry_alert_days?: number;
    expiry_critical_days?: number;
    expiry_warning_days?: number;
    default_markup_percent?: number;
    status?: string | 'Active' | 'Inactive';
    is_active?: boolean;
    tax_registration_number?: string;
}

export interface MedicineCategory {
    id: number;
    name: string;
    code: string;
    default_markup_percent?: number;
    organization_id?: number;
}

export interface CreateOrganizationDto {
    name: string;
    code?: string;
    type?: string;
    address?: string;
    phone?: string;
    email?: string;
    legal_name?: string;
    registration_number?: string;
    medical_license?: string;
    city?: string;
    country?: string;
    tax_registration_number?: string;
    business_license_number?: string;
}

/** Payload for updating organization profile (partial). */
export interface UpdateOrganizationDto {
    name?: string;
    code?: string;
    type?: string;
    subscription_status?: string;
    address?: string;
    phone?: string;
    email?: string;
    legal_name?: string;
    registration_number?: string;
    medical_license?: string;
    city?: string;
    country?: string;
    tax_registration_number?: string;
    business_license_number?: string;
    is_active?: boolean;
}

export interface Department {
    id: number;
    facility_id: number;
    name: string;
    type: 'store' | 'dispensary' | 'ward' | 'theatre' | 'other';
    head_user_id?: number;
    description?: string;
    is_main_store: boolean;
    status: 'active' | 'inactive';
}

export interface CreateFacilityDto {
    name: string;
    type: 'hospital' | 'clinic' | 'pharmacy_shop';
    address?: string;
    phone?: string;
    email?: string;
    organization_id?: number;
    tax_registration_number?: string;
    departments_enabled?: boolean;
    controlled_drug_rules_enabled?: boolean;
    ebm_enabled?: boolean;
    min_stock_threshold_percentage?: number;
    expiry_alert_days?: number;
    expiry_critical_days?: number;
    expiry_warning_days?: number;
    status?: string;
    is_active?: boolean;
}

export interface CreateOnboardingSetupDto {
    organization_name: string;
    legal_name?: string;
    registration_number?: string;
    medical_license?: string;
    city?: string;
    country?: string;
    facility_name: string;
    facility_type: 'hospital' | 'clinic' | 'pharmacy_shop';
    address?: string;
    phone?: string;
    email?: string;
}

export interface Batch {
    id: number;
    stock_id?: number;
    medicine_id: number;
    batch_number: string;
    expiry_date: string;
    manufacturing_date: string;
    initial_quantity: number;
    current_quantity: number;
    unit_cost: number;
    status: 'active' | 'expired' | 'depleted' | 'quarantined';
    supplier_name?: string;
    received_date?: string;
    location_id?: number | null;
    location?: StorageLocation | null;
}

export interface Stock {
    id: number;
    facility_id: number;
    department_id?: number | null;
    location_id?: number | null;
    storage_location_id?: number | null;
    medicine_id: number;
    batch_id?: number;
    quantity: number;
    min_threshold: number;
    medicine?: Medicine;
    batch?: Batch;
    department?: Department;
    location?: StorageLocation;
}

export const TemperatureType = {
    ROOM_TEMP: 'ROOM_TEMP',
    COLD: 'COLD',
    FROZEN: 'FROZEN',
} as const;

export type TemperatureType = (typeof TemperatureType)[keyof typeof TemperatureType];

export interface StorageLocation {
    id: number;
    facility_id: number;
    name: string;
    code: string;
    area?: string;
    temperature_type: TemperatureType;
    is_active: boolean;
    parent_id?: number | null;
    parent?: StorageLocation;
    children?: StorageLocation[];
    created_at?: string;
    updated_at?: string;
}

export interface CreateStorageLocationDto {
    name: string;
    code: string;
    area?: string;
    temperature_type?: TemperatureType;
    is_active?: boolean;
    parent_id?: number | null;
}

export const ColdChainExcursionStatus = {
    OPEN: 'open',
    ACKNOWLEDGED: 'acknowledged',
    RESOLVED: 'resolved',
} as const;
export type ColdChainExcursionStatus =
    (typeof ColdChainExcursionStatus)[keyof typeof ColdChainExcursionStatus];

export interface ColdChainTelemetry {
    id: number;
    facility_id: number;
    storage_location_id: number;
    recorded_by_id?: number | null;
    source: 'manual' | 'sensor';
    temperature_c: number;
    humidity_percent?: number | null;
    expected_min_c: number;
    expected_max_c: number;
    within_range: boolean;
    notes?: string | null;
    recorded_at: string;
    created_at: string;
}

export interface ColdChainExcursion {
    id: number;
    facility_id: number;
    storage_location_id: number;
    status: ColdChainExcursionStatus;
    started_at: string;
    last_observed_at: string;
    recovered_at?: string | null;
    resolved_at?: string | null;
    opened_by_id?: number | null;
    acknowledged_by_id?: number | null;
    resolved_by_id?: number | null;
    highest_temperature_c: number;
    lowest_temperature_c: number;
    last_temperature_c: number;
    expected_min_c: number;
    expected_max_c: number;
    resolution_action?: string | null;
    resolution_notes?: string | null;
    created_at: string;
    updated_at: string;
    location?: {
        id: number;
        name: string;
        code: string;
        temperature_type: TemperatureType;
    };
}

export interface ColdChainLocationStatus {
    location_id: number;
    location_name: string;
    location_code: string;
    temperature_type: TemperatureType;
    expected_min_c: number;
    expected_max_c: number;
    expected_label: string;
    current_temperature_c: number | null;
    last_logged_at: string | null;
    within_range: boolean | null;
    status: 'stable' | 'warning' | 'critical' | 'unknown';
    active_excursion_id: number | null;
}

export interface ColdChainOverview {
    generated_at: string;
    monitored_locations: number;
    active_excursions: number;
    recovered_pending_resolution: number;
    excursions_last_7_days: number;
    compliance_rate_24h: number;
    temperature_trend: Array<{
        timestamp: string;
        average_temperature_c: number;
        readings: number;
        excursion_readings: number;
    }>;
    location_status: ColdChainLocationStatus[];
    active_excursions_list: ColdChainExcursion[];
}

export interface Supplier {
    id: number;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_id?: string;
    category?: string;
    country?: string;
    payment_terms?: string;
    priority?: number;
    is_active: boolean;
    created_at?: string;
    qualification_status?: 'qualified' | 'pending' | 'suspended';
    qualification_expires_at?: string | null;
    licence_document_url?: string | null;
}

export type QualityCaseType = 'complaint' | 'capa' | 'adr';
export type QualityCaseStatus = 'open' | 'investigating' | 'closed';

export interface QualityCase {
    id: number;
    organization_id: number;
    facility_id: number | null;
    type: QualityCaseType;
    status: QualityCaseStatus;
    title: string;
    description: string;
    medicine_id?: number | null;
    batch_id?: number | null;
    capa_actions?: string | null;
    reported_at: string;
    closed_at?: string | null;
}

/** Body for POST /pharmacy/quality-cases */
export interface CreateQualityCaseInput {
    facility_id: number;
    type: QualityCaseType;
    title: string;
    description: string;
    medicine_id?: number;
    batch_id?: number;
    capa_actions?: string;
}

export interface ProcurementOrderItem {
    id: number;
    purchase_order_id: number;
    medicine_id: number;
    quantity_ordered: number;
    quantity_received?: number;
    backorder_qty?: number;
    remaining_qty?: number;
    quantity_available?: number; // Quantity available from supplier
    unit_price: number; // Requested price
    quoted_unit_price?: number; // Supplier price
    accepted_unit_price?: number; // Pharmacy agreed price
    selling_price?: number; // Determined selling price
    total_price: number;
    status?: string;
    notes?: string;
    /** Last physical receipt snapshot for this line (from GR posting). */
    last_receipt_qc_pass?: boolean | null;
    last_receipt_variance_qty?: number | null;
    medicine?: Medicine;
}

export type ProcurementOrderStatus =
    | 'draft'
    | 'submitted'
    | 'quoted'
    | 'partially_quoted'
    | 'accepted'
    | 'partially_accepted'
    | 'rejected'
    | 'confirmed'
    | 'partially_received'
    | 'backordered'
    | 'received'
    | 'cancelled'
    // Legacy uppercase/UI compatibility
    | 'DRAFT'
    | 'SUBMITTED'
    | 'QUOTED'
    | 'PARTIALLY_QUOTED'
    | 'ACCEPTED'
    | 'PARTIALLY_ACCEPTED'
    | 'REJECTED'
    | 'CONFIRMED'
    | 'RECEIVED'
    | 'CANCELLED'
    | 'ORDERED'
    | 'PARTIAL';

export interface ProcurementOrder {
    id: number;
    order_number: string;
    facility_id: number;
    organization_id: number;
    supplier_id: number;
    order_date: string;
    expected_delivery_date?: string;
    received_date?: string;
    status: ProcurementOrderStatus;
    submitted_at?: string;
    quoted_at?: string;
    accepted_at?: string;
    subtotal_amount: number;
    discount_percent: number;
    discount_amount: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    notes?: string;
    items_count: number;
    supplier?: Supplier;
    facility?: Facility;
    created_by?: User;
    items?: ProcurementOrderItem[];
    activities?: PurchaseOrderActivity[];
    /** Latest goods receipt id posted against this PO (receiving traceability). */
    last_goods_receipt_id?: number | null;
}

export interface GoodsReceiptItem {
    id: number;
    goods_receipt_id: number;
    purchase_order_item_id: number;
    medicine_id: number;
    batch_id: number;
    quantity_received: number;
    unit_cost: number;
    selling_price?: number;
    batch_number?: string;
    expiry_date?: string;
    qc_pass?: boolean | null;
    variance_quantity?: number | null;
    storage_condition_note?: string | null;
    medicine?: Medicine;
    batch?: Batch;
}

export interface GoodsReceipt {
    id: number;
    receipt_number: string;
    facility_id: number;
    organization_id?: number;
    purchase_order_id: number;
    received_by_id: number;
    received_date: string;
    notes?: string;
    storage_condition_note?: string | null;
    qc_pass?: boolean | null;
    coa_attachment_url?: string | null;
    created_at?: string;
    updated_at?: string;
    purchase_order?: ProcurementOrder;
    received_by?: User;
    items?: GoodsReceiptItem[];
}

export interface PurchaseOrderActivity {
    id: number;
    purchase_order_id: number;
    action: string;
    description: string;
    actor_type: 'facility' | 'supplier' | 'system';
    actor_id?: number | null;
    meta_data?: any;
    created_at: string;
}

export interface Alert {
    id: number;
    facility_id: number;
    type:
        | 'low_stock'
        | 'expiry'
        | 'expiry_soon'
        | 'expired'
        | 'controlled_drug_threshold'
        | 'reorder_suggestion'
        | 'batch_recall'
        | 'stock_variance'
        | 'cold_chain_excursion';
    message: string;
    title: string;
    status: 'active' | 'acknowledged' | 'resolved';
    created_at: string;
    medicine_id?: number;
    batch_id?: number;
    reference_type?: string | null;
    reference_id?: number | null;
    current_value?: number;
    threshold_value?: number;
    severity: 'info' | 'warning' | 'critical' | 'out_of_stock';
    last_notified_at?: string;
    action_taken?: string;
    action_reason?: string;
    resolved_at?: string;
    resolved_by_id?: number;
    context_data?: Record<string, any> | null;
    medicine?: Medicine;
    batch?: Batch;
}

export interface Transaction {
    id: string;
    name: string;
    category: string;
    qty: string;
    status: 'Completed' | 'In Process' | 'Restocked';
    date: string;
    sku: string;
}

export interface CreateMedicineDto {
    code: string;
    name: string;
    brand_name?: string;
    strength: string;
    dosage_form: string;
    unit: string;
    selling_price: number;
    organization_id?: number;
    category_id?: number | null;
    min_stock_level?: number;
    reorder_point?: number;
    target_stock_level?: number;
    lead_time_days?: number;
    safety_stock_quantity?: number;
    is_controlled_drug?: boolean;
    allow_partial_sales?: boolean;
    units_per_package?: number;
    base_unit?: string;
}

export type SaleStatus = 'paid' | 'partially_paid' | 'unpaid' | 'voided';
export type SalePaymentMethod = 'cash' | 'mobile_money' | 'bank' | 'card' | 'insurance';

export interface SalePayment {
    id: number;
    sale_id: number;
    method: SalePaymentMethod;
    amount: number;
    reference?: string | null;
    created_at?: string;
}

export interface SaleItem {
    id: number;
    sale_id: number;
    medicine_id: number;
    medicine?: Medicine;
    batch_id: number;
    batch?: Batch;
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at?: string;
}

export interface Sale {
    id: number;
    sale_number: string;
    facility_id: number;
    patient_id?: number | null;
    patient?: User | null;
    cashier_id: number;
    cashier?: User | null;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    status: SaleStatus;
    created_at?: string;
    items?: SaleItem[];
    payments?: SalePayment[];
}

/** Response shape from POST /pharmacy/sales (client-normalized). */
export interface CreateSaleResult {
    sale: Sale;
    warnings: string[];
}

export interface CreateSaleDto {
    patient_id?: number;
    prescription_id?: number;
    dispense_type?: 'otc' | 'prescription' | 'internal' | 'transfer';
    /** When strict FEFO blocks the batch, users with inventory write may send a reason (audited server-side). */
    fefo_override_reason?: string;
    vat_rate?: number;
    items: Array<{
        medicine_id: number;
        batch_id: number;
        stock_id?: number;
        quantity: number;
        unit_price: number;
    }>;
    payments: Array<{
        method: SalePaymentMethod;
        amount: number;
        reference?: string;
    }>;
    patient_id_type?: string;
    patient_id_number?: string;
    insurance_provider_id?: number;
    patient_insurance_number?: string;
}

// Advanced Analytics Types
export interface AdvancedKPIs {
    inventory_turnover: {
        ratio: number;
        period: string;
        target: number;
    };
    days_on_hand: {
        average: number;
        critical_items: number;
        target: number;
    };
    inventory_accuracy: {
        rate: number;
        last_count_date: string | null;
        target: number;
    };
    controlled_drug_variance: {
        status: 'compliant' | 'variance';
        variance_count: number;
    };
}

export interface CriticalMedicine {
    id: number;
    name: string;
    current_quantity: number;
    min_threshold: number;
    status: 'adequate' | 'low_stock' | 'critical';
    expiry_risk: 'safe' | 'warning' | 'critical';
    last_dispensed: string | null;
}

export interface ExpiryHeatMapData {
    dates: Array<{
        date: string;
        batches: Array<{
            batch_number: string;
            medicine_name: string;
            quantity: number;
        }>;
        total_value: number;
    }>;
}

export interface FEFOComplianceData {
    compliance_rate: number;
    total_transactions: number;
    compliant_transactions: number;
    violations: Array<{
        transaction_id: number;
        date: string;
        medicine_name: string;
        batch_used: string;
        batch_expiry: string;
        earlier_batch_available: string;
        earlier_expiry: string;
    }>;
}

export interface ABCAnalysisData {
    class_a: Array<ABCAnalysisItem>;
    class_b: Array<ABCAnalysisItem>;
    class_c: Array<ABCAnalysisItem>;
    all_items: Array<ABCAnalysisItem>;
    summary: {
        totalValue: number;
        classes: {
            A: { itemCount: number; totalValue: number; percentage: number };
            B: { itemCount: number; totalValue: number; percentage: number };
            C: { itemCount: number; totalValue: number; percentage: number };
        };
    };
}

export interface ABCAnalysisItem {
    medicine_id: number;
    medicine_name: string;
    consumption_value: number;
    cumulative_percentage: number;
    classification: 'A' | 'B' | 'C';
}

export interface MultiLocationData {
    facilities: Array<{
        facility_id: number;
        facility_name: string;
        metric_value: number;
        rank: number;
    }>;
}

export interface OverstockData {
    items: Array<{
        medicine_id: number;
        medicine_name: string;
        current_quantity: number;
        target_quantity: number;
        excess: number;
        excess_value: number;
    }>;
}

export interface ReorderSuggestion {
    medicine_id: number;
    medicine_name: string;
    current_quantity: number;
    reorder_point: number;
    min_stock_level?: number; // Alias for legacy support if needed
    suggested_quantity: number;
    average_daily_usage?: number;
    avg_daily_consumption?: number;
    days_remaining?: number;
    days_of_cover?: number;
    deficit_quantity?: number;
    recommended_action?: string;
    supplier_name?: string;
    urgency: 'low' | 'medium' | 'high';
}

export interface SupplierPerformanceItem {
    supplier_id: number;
    supplier_name: string;
    total_orders: number;
    avg_lead_time_days: number;
    fulfillment_rate: number;
    on_time_delivery_rate: number;
}

export interface BatchTraceabilityRow {
    transaction_id: number;
    transaction_number: string;
    date: string;
    patient_id: number | null;
    patient_name: string;
    quantity: number;
    dispensed_by: string;
}

export interface BatchTraceabilityReport {
    batch_id: number;
    batch_number: string;
    medicine_name: string;
    expiry_date: string;
    total_dispensed: number;
    patients: BatchTraceabilityRow[];
}

export interface ControlledDrugRegisterRow {
    id: number;
    date: string;
    type: string;
    reference: string;
    quantity_in: number;
    quantity_out: number;
    balance: number;
    user_name: string;
    notes: string;
}

export interface ControlledDrugRegisterReport {
    medicine_id: number;
    medicine_name: string;
    current_balance: number;
    movements: ControlledDrugRegisterRow[];
}

export type PhysicalCountStatus = 'in_progress' | 'completed' | 'approved' | 'cancelled';

export interface PhysicalCountItem {
    id: number;
    physical_count_id: number;
    medicine_id: number;
    batch_id: number;
    system_quantity: number;
    counted_quantity: number;
    variance: number;
    notes?: string;
    medicine?: Medicine;
    batch?: Batch;
}

export interface PhysicalCount {
    id: number;
    facility_id: number;
    count_date: string;
    status: PhysicalCountStatus;
    counted_by_id: number;
    approved_by_id?: number;
    approved_at?: string;
    notes?: string;
    created_at: string;
    items?: PhysicalCountItem[];
    counted_by?: import('./auth').User;
    approved_by?: import('./auth').User;
}
// Returns System Types
export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type RefundMethod = 'cash' | 'mobile_money' | 'credit_note';
export type ReturnReason =
    | 'customer_request'
    | 'damaged'
    | 'expired'
    | 'wrong_item'
    | 'adverse_reaction'
    | 'other';
export type ItemCondition = 'resellable' | 'damaged' | 'expired';

export interface CustomerReturnItem {
    id: number;
    return_id: number;
    sale_item_id: number;
    medicine_id: number;
    medicine?: Medicine;
    batch_id: number;
    batch?: Batch;
    quantity_returned: number;
    reason: ReturnReason;
    condition: ItemCondition;
    refund_amount: number;
    restore_to_stock: boolean;
}

export interface CustomerReturn {
    id: number;
    return_number: string;
    sale_id: number;
    sale?: Sale;
    facility_id: number;
    processed_by_id: number;
    processedBy?: User;
    approved_by_id?: number | null;
    approvedBy?: User | null;
    total_refund_amount: number;
    refund_method: RefundMethod;
    status: ReturnStatus;
    notes?: string;
    credit_note_id?: number | null;
    approved_at?: string | null;
    rejected_at?: string | null;
    rejection_reason?: string | null;
    refund_processed_at?: string | null;
    created_at: string;
    items?: CustomerReturnItem[];
    refundProcessedBy?: User | null;
    rejectedBy?: User | null;
}

// Detailed Sales Report Types
export interface DailySalesReport {
    facility_id: number;
    date: string;
    summary: {
        total_sales: number;
        total_transactions: number;
        average_sale_value: number;
        total_vat: number;
        total_items_sold: number;
    };
    sales: any[];
    payment_methods: Record<string, { amount: number; count: number }>;
    hourly_breakdown: Array<{ hour: number; amount: number; count: number }>;
}

export interface MonthlySalesReport {
    facility_id: number;
    year: number;
    month: number;
    summary: {
        total_sales: number;
        total_transactions: number;
        total_profit: number;
        profit_margin: number;
        total_vat: number;
    };
    daily_breakdown: Array<{ date: string; amount: number; count: number }>;
    top_medicines: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity: number;
        revenue: number;
    }>;
}

export interface SalesByMedicineReport {
    facility_id: number;
    period: { start: string; end: string };
    medicines: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        revenue: number;
        cost: number;
        profit: number;
        profit_margin: number;
        transaction_count: number;
    }>;
}

// KPI Types
export interface FinancialKPIs {
    facility_id: number;
    period: { start: string; end: string };
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    gross_profit_margin: number;
    net_profit: number;
    net_profit_margin: number;
    average_transaction_value: number;
    total_transactions: number;
    revenue_per_day: number;
}

export interface InventoryKPIs {
    facility_id: number;
    total_inventory_value: number;
    total_items: number;
    low_stock_items: number;
    out_of_stock_items: number;
    expiring_soon_items: number;
    expired_items: number;
    inventory_turnover_ratio: number;
    days_inventory_outstanding: number;
    stock_health_score: number;
}

export interface OperationalKPIs {
    facility_id: number;
    period: { start: string; end: string };
    total_sales_volume: number;
    return_rate: number;
    average_items_per_sale: number;
    top_selling_medicine: {
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        revenue: number;
    } | null;
    sales_growth_rate: number;
    customer_count: number;
    repeat_customer_rate: number;
}

export interface ComprehensiveKPIs {
    financial: FinancialKPIs;
    inventory: InventoryKPIs;
    operational: OperationalKPIs;
}

export interface PaymentBreakdown {
    payment_method: string;
    total_amount: number;
    transaction_count: number;
    percentage: number;
}

export interface ExpiryRiskBuckets {
    under_30_days: { count: number; value: number };
    under_60_days: { count: number; value: number };
    under_90_days: { count: number; value: number };
}

export interface TopRevenueMedicine {
    medicine_id: number;
    medicine_name: string;
    revenue: number;
    quantity: number;
    profit: number;
}

export interface CategorySummary {
    category_id: number;
    category_name: string;
    quantity_sold: number;
    revenue: number;
    profit: number;
}

export interface DashboardSummary {
    today: ComprehensiveKPIs;
    month: ComprehensiveKPIs;
    top_medicines: TopRevenueMedicine[];
    categories: CategorySummary[];
    payments: PaymentBreakdown[];
    expiry_risk: ExpiryRiskBuckets;
    sales_trend?: Array<{ date: string; sales: number }>;
}

export interface GlobalSearchResultItem {
    id: string;
    label: string;
    meta: string;
    to: string;
}

export interface GlobalSearchResults {
    medicines: GlobalSearchResultItem[];
    batches: GlobalSearchResultItem[];
    suppliers: GlobalSearchResultItem[];
    purchaseOrders: GlobalSearchResultItem[];
    stockMovements: GlobalSearchResultItem[];
}

// Batch Recall Types
export const RecallStatus = {
    INITIATED: 'initiated',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const;
export type RecallStatus = (typeof RecallStatus)[keyof typeof RecallStatus];

export const RecallReason = {
    QUALITY_ISSUE: 'quality_issue',
    CONTAMINATION: 'contamination',
    REGULATORY: 'regulatory',
    EXPIRY: 'expiry',
    COUNTERFEIT: 'counterfeit',
    OTHER: 'other',
} as const;
export type RecallReason = (typeof RecallReason)[keyof typeof RecallReason];

export interface BatchRecall {
    id: number;
    facility_id: number;
    batch_id: number;
    batch?: Batch;
    medicine_id: number;
    medicine?: Medicine;
    recall_number: string;
    reason: RecallReason;
    description: string;
    status: RecallStatus;
    affected_sales_count: number;
    affected_quantity: number;
    recovered_quantity: number;
    remaining_stock: number;
    action_taken?: string;
    notes?: string;
    initiated_by_id?: number;
    initiated_by?: User;
    completed_by_id?: number;
    completed_by?: User;
    initiated_at: string;
    completed_at?: string;
    created_at: string;
}

// Stock Variance Types
export const VarianceStatus = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;
export type VarianceStatus = (typeof VarianceStatus)[keyof typeof VarianceStatus];

export const VarianceType = {
    PHYSICAL_COUNT: 'physical_count',
    CYCLE_COUNT: 'cycle_count',
    ANNUAL_COUNT: 'annual_count',
} as const;
export type VarianceType = (typeof VarianceType)[keyof typeof VarianceType];

export interface StockVariance {
    id: number;
    facility_id: number;
    medicine_id: number;
    medicine?: Medicine;
    batch_id?: number;
    batch?: Batch;
    system_quantity: number;
    physical_quantity: number;
    variance_quantity: number;
    unit_cost?: number;
    variance_value?: number;
    variance_type: VarianceType;
    status: VarianceStatus;
    reason?: string;
    notes?: string;
    counted_by_id?: number;
    counted_by?: User;
    approved_by_id?: number;
    approved_by?: User;
    approved_at?: string;
    counted_at?: string;
    created_at: string;
}

export interface InsuranceProvider {
    id: number;
    name: string;
    type: 'PUBLIC' | 'PRIVATE';
    coverage_percentage: number;
    max_coverage_limit?: number;
    is_active: boolean;
    created_at: string;
}

export type InsuranceClaimStatus =
    | 'pending'
    | 'submitted'
    | 'approved'
    | 'partially_approved'
    | 'rejected'
    | 'paid';

export interface InsuranceClaim {
    id: number;
    sale_id: number;
    sale?: Sale;
    provider_id: number;
    provider?: InsuranceProvider;
    patient_insurance_number?: string;
    total_amount: number;
    applied_coverage_percentage: number;
    expected_amount: number;
    copay_amount: number;
    actual_received_amount: number;
    status: InsuranceClaimStatus;
    notes?: string;
    submitted_at?: string;
    processed_at?: string;
    created_at: string;
}
