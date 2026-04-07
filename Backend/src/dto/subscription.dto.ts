import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { SubscriptionPlanCode } from '../entities/SubscriptionPlan.entity';

export enum PaymentMethodPreference {
    MTN_MOMO = 'mtn_momo',
    MOBILE_MONEY = 'mobile_money',
}

export enum BillingTerm {
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
}

export class CheckoutSummaryDto {
    @IsEnum(SubscriptionPlanCode)
    plan_code: SubscriptionPlanCode;

    @IsInt()
    @Min(1)
    @Max(12)
    duration_months: number;
}

export class StartSubscriptionDto {
    @IsEnum(SubscriptionPlanCode)
    plan_code: SubscriptionPlanCode;

    @IsString()
    // Accept either:
    // - E.164 (+2507XXXXXXXX)
    // - local formats (07XXXXXXXX, 2507XXXXXXXX)
    @Matches(/^(\+?2507\d{8}|07\d{8}|2507\d{8})$/, { message: 'Invalid phone format' })
    phone_number: string;

    @IsOptional()
    @IsEnum(PaymentMethodPreference)
    payment_method_preference?: PaymentMethodPreference;

    // Allows clients to pass a pre-generated idempotency key for createCashIn.
    // For trial start (no cash-in yet) this is unused but kept for future extensibility.
    @IsOptional()
    @IsString()
    @MaxLength(32)
    @ValidateIf((o: any) => o.payment_method_preference != null)
    idempotency_key?: string;
}

export class PayNowDto {
    // If you don't have a subscription yet, the client must specify a plan.
    @IsOptional()
    @IsEnum(SubscriptionPlanCode)
    plan_code?: SubscriptionPlanCode;

    @IsString()
    // Accept either:
    // - E.164 (+2507XXXXXXXX)
    // - local formats (07XXXXXXXX, 2507XXXXXXXX)
    @Matches(/^(\+?2507\d{8}|07\d{8}|2507\d{8})$/, { message: 'Invalid phone format' })
    phone_number: string;

    @IsOptional()
    @IsEnum(PaymentMethodPreference)
    payment_method_preference?: PaymentMethodPreference;

    // Legacy support:
    // - monthly => 1 month
    // - yearly => 12 months (20% off)
    @IsOptional()
    @IsEnum(BillingTerm)
    term?: BillingTerm;

    // New billing duration support:
    // - 1 month
    // - 3 months
    // - 12 months (20% off)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    duration_months?: number;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    idempotency_key?: string;
}

