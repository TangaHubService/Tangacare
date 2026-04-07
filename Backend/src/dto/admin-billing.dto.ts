import { IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { SubscriptionStatus } from '../entities/Subscription.entity';

export class ExtendTrialDto {
    @IsInt()
    @Min(1)
    @Max(90)
    days: number;
}

export class ChangeSubscriptionPlanDto {
    @IsInt()
    to_plan_id: number;

    @IsIn(['immediate', 'next_cycle'])
    effective_mode: 'immediate' | 'next_cycle';
}

export class UpdateSubscriptionStatusDto {
    @IsEnum(SubscriptionStatus)
    status: SubscriptionStatus;
}

export class CreatePlanDto {
    @IsString()
    name: string;

    @IsString()
    code: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    price_rwf_monthly?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class UpdateGatewayDto {
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsObject()
    config_json?: Record<string, any>;
}

