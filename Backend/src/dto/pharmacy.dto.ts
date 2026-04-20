import {
    IsString,
    IsEmail,
    IsOptional,
    IsEnum,
    IsInt,
    IsNumber,
    IsBoolean,
    IsDateString,
    IsArray,
    ValidateNested,
    Min,
    Max,
    MinLength,
    MaxLength,
    IsObject,
    Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdjustmentReason } from '../entities/StockMovement.entity';
import { DosageForm, DrugSchedule } from '../entities/Medicine.entity';
import { FacilityType } from '../entities/Facility.entity';
import { OrganizationType, SubscriptionStatus } from '../entities/Organization.entity';
import { PurchaseOrderStatus } from '../entities/PurchaseOrder.entity';
import { DispenseType } from '../entities/DispenseTransaction.entity';
import { StockTransferStatus } from '../entities/StockTransfer.entity';
import { AlertStatus } from '../entities/Alert.entity';
import { TemperatureType } from '../entities/StorageLocation.entity';
import { ColdChainTelemetrySource } from '../entities/ColdChainTelemetry.entity';
import { VendorReturnReason } from '../entities/VendorReturn.entity';
import { DisposalStatus, DisposalType, DisposalReason } from '../entities/DisposalRequest.entity';
import { ItemCondition, RefundMethod, ReturnReason, ReturnStatus } from '../entities/CustomerReturn.entity';
import { SupplierQualificationStatus } from '../entities/Supplier.entity';

export class CreateStorageLocationDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @MinLength(1)
    code: string;

    @IsString()
    @IsOptional()
    area?: string;

    @IsEnum(TemperatureType)
    @IsOptional()
    temperature_type?: TemperatureType;
}

export class UpdateStorageLocationDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsString()
    @MinLength(1)
    @IsOptional()
    code?: string;

    @IsString()
    @IsOptional()
    area?: string;

    @IsEnum(TemperatureType)
    @IsOptional()
    temperature_type?: TemperatureType;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class LogColdChainTelemetryDto {
    @IsNumber()
    temperature_c: number;

    @IsNumber()
    @IsOptional()
    humidity_percent?: number;

    @IsEnum(ColdChainTelemetrySource)
    @IsOptional()
    source?: ColdChainTelemetrySource;

    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string;

    @IsDateString()
    @IsOptional()
    recorded_at?: string;
}

export class AcknowledgeColdChainExcursionDto {
    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string;
}

export class ResolveColdChainExcursionDto {
    @IsString()
    @MinLength(3)
    @MaxLength(160)
    action_taken: string;

    @IsString()
    @MaxLength(1000)
    @IsOptional()
    notes?: string;
}

export class StockTransferBetweenLocationsDto {
    @IsInt()
    source_stock_id: number;

    @IsInt()
    target_location_id: number;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateOrganizationDto {
    @IsString()
    @MinLength(2)
    @MaxLength(255)
    name: string;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(20)
    code?: string;

    @IsEnum(OrganizationType)
    @IsOptional()
    type?: OrganizationType;

    @IsEnum(SubscriptionStatus)
    @IsOptional()
    subscription_status?: SubscriptionStatus;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    address?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone format' })
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    legal_name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    registration_number?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    medical_license?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    city?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    country?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    tax_registration_number?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    business_license_number?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class UpdateOrganizationDto {
    @IsString()
    @MinLength(2)
    @MaxLength(255)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(20)
    code?: string;

    @IsEnum(OrganizationType)
    @IsOptional()
    type?: OrganizationType;

    @IsEnum(SubscriptionStatus)
    @IsOptional()
    subscription_status?: SubscriptionStatus;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    address?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone format' })
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    legal_name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    registration_number?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    medical_license?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    city?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    country?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    tax_registration_number?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    business_license_number?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class CreateOnboardingOrganizationDto {
    @IsString()
    @MinLength(2)
    organization_name: string;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(20)
    organization_code?: string;

    @IsString()
    @IsOptional()
    legal_name?: string;

    @IsString()
    @IsOptional()
    registration_number?: string;

    @IsString()
    @IsOptional()
    medical_license?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    country?: string;
}


export class CreateOnboardingSetupDto {
    @IsString()
    @MinLength(2)
    organization_name: string;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(20)
    organization_code?: string;

    @IsString()
    @IsOptional()
    legal_name?: string;

    @IsString()
    @IsOptional()
    registration_number?: string;

    @IsString()
    @IsOptional()
    medical_license?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    country?: string;


    @IsString()
    @MinLength(2)
    facility_name: string;

    @IsEnum(FacilityType)
    facility_type: FacilityType;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/)
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;
}

export class CreateFacilityDto {
    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/)
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsEnum(FacilityType)
    type: FacilityType;

    @IsBoolean()
    @IsOptional()
    departments_enabled?: boolean;

    @IsBoolean()
    @IsOptional()
    controlled_drug_rules_enabled?: boolean;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    min_stock_threshold_percentage?: number;

    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    expiry_alert_days?: number;

    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    expiry_critical_days?: number;

    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    expiry_warning_days?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_markup_percent?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsInt()
    @IsOptional()
    facility_admin_id?: number;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    tax_registration_number?: string;

    @IsObject()
    @IsOptional()
    configuration?: Record<string, any>;
}

export class UpdateFacilityDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/)
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsBoolean()
    @IsOptional()
    departments_enabled?: boolean;

    @IsBoolean()
    @IsOptional()
    controlled_drug_rules_enabled?: boolean;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    min_stock_threshold_percentage?: number;

    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    expiry_alert_days?: number;

    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    expiry_critical_days?: number;

    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    expiry_warning_days?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_markup_percent?: number;

    @IsInt()
    @IsOptional()
    facility_admin_id?: number;

    @IsObject()
    @IsOptional()
    configuration?: Record<string, any>;

    @IsBoolean()
    @IsOptional()
    ebm_enabled?: boolean;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    tax_registration_number?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class CreateDepartmentDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    location?: string;
}

export class UpdateDepartmentDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class CreateMedicineDto {
    @IsString()
    @MinLength(2)
    code: string;

    @IsString()
    @IsOptional()
    barcode?: string;

    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @IsOptional()
    brand_name?: string;

    @IsString()
    @IsOptional()
    strength?: string;

    @IsEnum(DosageForm)
    dosage_form: DosageForm;

    @IsEnum(DrugSchedule)
    @IsOptional()
    drug_schedule?: DrugSchedule;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsString()
    @IsOptional()
    storage_conditions?: string;

    @IsBoolean()
    @IsOptional()
    is_controlled_drug?: boolean;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    cost_price?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    selling_price?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    markup_percent?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    min_stock_level?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    reorder_point?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    target_stock_level?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    lead_time_days?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    safety_stock_quantity?: number;

    @IsInt()
    @IsOptional()
    category_id?: number;
}

export class UpdateMedicineDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    code?: string;

    @IsString()
    @IsOptional()
    barcode?: string;

    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    brand_name?: string;

    @IsString()
    @IsOptional()
    strength?: string;

    @IsEnum(DosageForm)
    @IsOptional()
    dosage_form?: DosageForm;

    @IsEnum(DrugSchedule)
    @IsOptional()
    drug_schedule?: DrugSchedule;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsString()
    @IsOptional()
    storage_conditions?: string;

    @IsBoolean()
    @IsOptional()
    is_controlled_drug?: boolean;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    cost_price?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    selling_price?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    markup_percent?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    min_stock_level?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    reorder_point?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    target_stock_level?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    lead_time_days?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    safety_stock_quantity?: number;

    @IsInt()
    @IsOptional()
    category_id?: number;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class CreateMedicineCategoryDto {
    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @MinLength(1)
    @MaxLength(50)
    code: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_markup_percent?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;
}

export class UpdateMedicineCategoryDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsString()
    @MinLength(1)
    @MaxLength(50)
    @IsOptional()
    code?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_markup_percent?: number;
}

export class CreateBatchDto {
    @IsInt()
    medicine_id: number;

    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsInt()
    @IsOptional()
    supplier_id?: number;

    @IsString()
    @MinLength(2)
    batch_number: string;

    @IsDateString()
    expiry_date: string;

    @IsDateString()
    manufacturing_date: string;

    @IsInt()
    @Min(1)
    initial_quantity: number;

    @IsNumber()
    @Min(0)
    unit_cost: number;

    @IsString()
    @IsOptional()
    supplier?: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsNumber()
    @IsOptional()
    unit_price?: number;

    @IsInt()
    @IsOptional()
    purchase_order_item_id?: number;
}

export class UpdateBatchDto {
    @IsInt()
    @Min(0)
    @IsOptional()
    current_quantity?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    unit_cost?: number;

    @IsString()
    @IsOptional()
    supplier?: string;

    @IsInt()
    @IsOptional()
    supplier_id?: number;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateSupplierDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @IsOptional()
    contact_person?: string;

    @IsString()
    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/)
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    tax_id?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    category?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    country?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    payment_terms?: string;

    @IsInt()
    @Min(1)
    @Max(10)
    @IsOptional()
    priority?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsEnum(SupplierQualificationStatus)
    @IsOptional()
    qualification_status?: SupplierQualificationStatus;

    @IsDateString()
    @IsOptional()
    qualification_expires_at?: string;

    @IsString()
    @IsOptional()
    @MaxLength(512)
    licence_document_url?: string;
}

export class UpdateSupplierDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    contact_person?: string;

    @IsString()
    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/)
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    tax_id?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    category?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    country?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    payment_terms?: string;

    @IsInt()
    @Min(1)
    @Max(10)
    @IsOptional()
    priority?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsEnum(SupplierQualificationStatus)
    @IsOptional()
    qualification_status?: SupplierQualificationStatus;

    @IsDateString()
    @IsOptional()
    qualification_expires_at?: string;

    @IsString()
    @IsOptional()
    @MaxLength(512)
    licence_document_url?: string;
}

export class PurchaseOrderItemDto {
    @IsInt()
    medicine_id: number;

    @IsInt()
    @Min(1)
    quantity_ordered: number;

    @IsNumber()
    @Min(0)
    unit_price: number;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreatePurchaseOrderDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsInt()
    supplier_id: number;

    @IsDateString()
    @IsOptional()
    order_date?: string;

    @IsDateString()
    @IsOptional()
    expected_delivery_date?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    discount_percent?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    discount_amount?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    vat_rate?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PurchaseOrderItemDto)
    items: PurchaseOrderItemDto[];

    @IsString()
    @IsOptional()
    notes?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    shipping_cost?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    tariff_amount?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    handling_fee?: number;
}

export class UpdatePurchaseOrderDto {
    @IsEnum(PurchaseOrderStatus)
    @IsOptional()
    status?: PurchaseOrderStatus;

    @IsDateString()
    @IsOptional()
    order_date?: string;

    @IsDateString()
    @IsOptional()
    expected_delivery_date?: string;

    @IsDateString()
    @IsOptional()
    received_date?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    discount_percent?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    discount_amount?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    vat_rate?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    shipping_cost?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    tariff_amount?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    handling_fee?: number;
}

export class ReceivePurchaseOrderDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReceivedItemDto)
    received_items: ReceivedItemDto[];

    @IsDateString()
    @IsOptional()
    received_date?: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsString()
    @IsOptional()
    storage_condition_note?: string;

    @IsBoolean()
    @IsOptional()
    qc_pass?: boolean;

    @IsString()
    @IsOptional()
    coa_attachment_url?: string;
}

export class ReceivedItemDto {
    @IsInt()
    item_id: number;

    @IsInt()
    @Min(0)
    quantity_received: number;

    @IsString()
    @IsOptional()
    batch_number?: string;

    @IsDateString()
    @IsOptional()
    expiry_date?: string;

    @IsDateString()
    @IsOptional()
    manufacturing_date?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    backorder_qty?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    selling_price?: number;  // optional unit selling price provided during receipt

    @IsInt()
    @IsOptional() // Will enforce in service logic if needed, but allow optional for backward compatibility if legacy UI doesn't send it initially
    location_id?: number;

    @IsBoolean()
    @IsOptional()
    qc_pass?: boolean;

    @IsInt()
    @IsOptional()
    variance_quantity?: number;

    @IsString()
    @IsOptional()
    storage_condition_note?: string;

    @IsBoolean()
    @IsOptional()
    receive_into_quarantine?: boolean;
}

export class CreateVendorReturnItemDto {
    @IsInt()
    medicine_id: number;

    @IsInt()
    batch_id: number;

    @IsInt()
    @Min(1)
    quantity_returned: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    unit_cost?: number;

    @IsEnum(VendorReturnReason)
    reason: VendorReturnReason;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateVendorReturnDto {
    @IsInt()
    @IsOptional()
    purchase_order_id?: number;

    @IsInt()
    supplier_id: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsString()
    @IsOptional()
    reason?: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateVendorReturnItemDto)
    items: CreateVendorReturnItemDto[];
}

export class VendorReturnFiltersDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsString()
    @IsOptional()
    status?: string;

    @IsInt()
    @IsOptional()
    supplier_id?: number;

    @IsString()
    @IsOptional()
    start_date?: string;

    @IsString()
    @IsOptional()
    end_date?: string;

    @IsInt()
    @IsOptional()
    page?: number;

    @IsInt()
    @IsOptional()
    limit?: number;
}
// ---------------------------------------------------------------------------

export class CreateDispenseTransactionDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    department_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsInt()
    medicine_id: number;

    @IsInt()
    batch_id: number;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsEnum(DispenseType)
    dispense_type: DispenseType;

    @IsInt()
    @IsOptional()
    patient_id?: number;

    @IsInt()
    @IsOptional()
    prescription_id?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    unit_price?: number;

    @IsString()
    @IsOptional()
    patient_id_type?: string;

    @IsString()
    @IsOptional()
    patient_id_number?: string;

    /** When strict FEFO would block the chosen batch, staff with inventory write access may supply a reason to proceed (audited). */
    @IsString()
    @IsOptional()
    @MaxLength(500)
    fefo_override_reason?: string;
}

export class StockTransferItemDto {
    @IsInt()
    medicine_id: number;

    @IsInt()
    batch_id: number;

    @IsInt()
    @Min(1)
    quantity: number;
}

export class CreateStockTransferDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    from_department_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsInt()
    @IsOptional()
    to_department_id?: number;

    @IsDateString()
    @IsOptional()
    transfer_date?: string;

    @IsInt()
    @IsOptional()
    from_location_id?: number;

    @IsInt()
    @IsOptional()
    to_location_id?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StockTransferItemDto)
    items: StockTransferItemDto[];

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateStockTransferDto {
    @IsEnum(StockTransferStatus)
    @IsOptional()
    status?: StockTransferStatus;

    @IsInt()
    @IsOptional()
    received_by_id?: number;

    @IsDateString()
    @IsOptional()
    transfer_date?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateAlertDto {
    @IsEnum(AlertStatus)
    @IsOptional()
    status?: AlertStatus;

    @IsDateString()
    @IsOptional()
    acknowledged_at?: string;

    @IsDateString()
    @IsOptional()
    resolved_at?: string;
}

export class QueryDto {
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number;

    @IsInt()
    @Min(1)
    @Max(1000)
    @IsOptional()
    limit?: number;

    @IsString()
    @IsOptional()
    search?: string;

    @IsString()
    @IsOptional()
    sort_by?: string;

    @IsEnum(['ASC', 'DESC'])
    @IsOptional()
    sort_order?: 'ASC' | 'DESC';

    @IsInt()
    @IsOptional()
    organization_id?: number;
}

export class StockQueryDto extends QueryDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    department_id?: number;

    @IsInt()
    @IsOptional()
    medicine_id?: number;

    @IsBoolean()
    @IsOptional()
    low_stock_only?: boolean;

    @IsInt()
    @IsOptional()
    organization_id?: number;
}

export class StockAdjustmentDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    batch_id: number;

    @IsInt()
    @IsOptional()
    department_id?: number;

    @IsEnum(['increase', 'decrease', 'damage', 'expired', 'return'])
    type: 'increase' | 'decrease' | 'damage' | 'expired' | 'return';

    @IsInt()
    @Min(1)
    quantity: number;

    @IsEnum(AdjustmentReason)
    reason: AdjustmentReason;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateSaleItemDto {
    @IsInt()
    medicine_id: number;

    @IsInt()
    @IsOptional()
    stock_id?: number;

    @IsInt()
    @IsOptional()
    batch_id?: number;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsNumber()
    @Min(0)
    unit_price: number;
}

export class CreateSalePaymentDto {
    @IsEnum(['cash', 'mobile_money', 'bank', 'card', 'insurance'])
    method: 'cash' | 'mobile_money' | 'bank' | 'card' | 'insurance';

    @IsNumber()
    @Min(0)
    amount: number;

    @IsString()
    @IsOptional()
    reference?: string;
}

export class CreateSaleDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    patient_id?: number;

    @IsInt()
    @IsOptional()
    prescription_id?: number;

    @IsEnum(DispenseType)
    @IsOptional()
    dispense_type?: DispenseType;

    @IsNumber()
    @Min(0)
    @IsOptional()
    vat_rate?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSaleItemDto)
    items: CreateSaleItemDto[];

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateSalePaymentDto)
    payments?: CreateSalePaymentDto[];

    @IsString()
    @IsOptional()
    patient_id_type?: string;

    @IsString()
    @IsOptional()
    patient_id_number?: string;

    @IsInt()
    @IsOptional()
    insurance_provider_id?: number;

    @IsString()
    @IsOptional()
    patient_insurance_number?: string;

    /** When strict FEFO would block the chosen batch, staff with inventory write access may supply a reason to proceed (audited). */
    @IsString()
    @IsOptional()
    @MaxLength(500)
    fefo_override_reason?: string;
}

// Customer Returns DTOs
export class CreateReturnItemDto {
    @IsInt()
    sale_item_id: number;

    @IsInt()
    medicine_id: number;

    @IsInt()
    batch_id: number;

    @IsInt()
    @Min(1)
    quantity_returned: number;

    @IsEnum(ReturnReason)
    reason: ReturnReason;

    @IsEnum(ItemCondition)
    condition: ItemCondition;

    @IsNumber()
    @Min(0)
    refund_amount: number;

    @IsBoolean()
    @IsOptional()
    restore_to_stock?: boolean;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateReturnDto {
    @IsInt()
    sale_id: number;

    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsEnum(RefundMethod)
    refund_method: RefundMethod;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateReturnItemDto)
    items: CreateReturnItemDto[];

    @IsString()
    @IsOptional()
    notes?: string;
}

export class ReturnFiltersDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsEnum(ReturnStatus)
    @IsOptional()
    status?: ReturnStatus;

    @IsString()
    @IsOptional()
    sale_number?: string;

    @IsDateString()
    @IsOptional()
    start_date?: string;

    @IsDateString()
    @IsOptional()
    end_date?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number;

    @IsInt()
    @Min(1)
    @Max(1000)
    @IsOptional()
    limit?: number;
}

export class CreateInsuranceProviderDto {
    @IsString()
    @MinLength(2)
    name: string;

    @IsEnum(['PUBLIC', 'PRIVATE'])
    type: 'PUBLIC' | 'PRIVATE';

    @IsNumber()
    @Min(0)
    @Max(100)
    coverage_percentage: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    max_coverage_limit?: number;
}

export class UpdateInsuranceProviderDto {
    @IsString()
    @MinLength(2)
    @IsOptional()
    name?: string;

    @IsEnum(['PUBLIC', 'PRIVATE'])
    @IsOptional()
    type?: 'PUBLIC' | 'PRIVATE';

    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    coverage_percentage?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    max_coverage_limit?: number;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class CreateInsuranceClaimDto {
    @IsInt()
    sale_id: number;

    @IsInt()
    provider_id: number;

    @IsString()
    @IsOptional()
    patient_insurance_number?: string;

    @IsNumber()
    @Min(0)
    total_amount: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    applied_coverage_percentage?: number;

    @IsNumber()
    @Min(0)
    expected_amount: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    copay_amount?: number;

    @IsEnum(['pending', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid'])
    @IsOptional()
    status?: 'pending' | 'submitted' | 'approved' | 'partially_approved' | 'rejected' | 'paid';

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateInsuranceClaimDto {
    @IsEnum(['pending', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid'])
    @IsOptional()
    status?: 'pending' | 'submitted' | 'approved' | 'partially_approved' | 'rejected' | 'paid';

    @IsNumber()
    @Min(0)
    @IsOptional()
    actual_received_amount?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsDateString()
    @IsOptional()
    submitted_at?: string;

    @IsDateString()
    @IsOptional()
    processed_at?: string;
}

export class DisposalItemDto {
    @IsInt()
    medicine_id: number;

    @IsInt()
    batch_id: number;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    unit_cost?: number;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateDisposalRequestDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsEnum(DisposalType)
    @IsOptional()
    type?: DisposalType;

    @IsEnum(DisposalReason)
    @IsOptional()
    reason?: DisposalReason;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DisposalItemDto)
    items: DisposalItemDto[];
}

export class DisposalFiltersDto {
    @IsInt()
    @IsOptional()
    facility_id?: number;

    @IsInt()
    @IsOptional()
    organization_id?: number;

    @IsEnum(DisposalStatus)
    @IsOptional()
    status?: DisposalStatus;

    @IsEnum(DisposalType)
    @IsOptional()
    type?: DisposalType;

    @IsEnum(DisposalReason)
    @IsOptional()
    reason?: DisposalReason;

    @IsDateString()
    @IsOptional()
    start_date?: string;

    @IsDateString()
    @IsOptional()
    end_date?: string;

    @IsInt()
    @IsOptional()
    @Min(1)
    page?: number;

    @IsInt()
    @IsOptional()
    @Min(1)
    limit?: number;
}

export class CreateWalkInPrescriptionDto {
    @IsInt()
    facility_id: number;

    @IsInt()
    organization_id: number;

    @IsString()
    @MinLength(3)
    prescription_text: string;

    @IsString()
    @IsOptional()
    diagnosis?: string;

    @IsString()
    @IsOptional()
    walk_in_patient_name?: string;

    @IsString()
    @IsOptional()
    walk_in_patient_identifier?: string;

    @IsString()
    @IsOptional()
    external_prescriber_name?: string;

    @IsString()
    @IsOptional()
    external_prescriber_license?: string;

    @IsInt()
    @IsOptional()
    validity_days?: number;
}

export class ReleaseStockQcDto {
    @IsInt()
    stock_id: number;
}
