import {
    IsEmail,
    IsString,
    MinLength,
    IsOptional,
    IsDateString,
    IsEnum,
    Matches,
    ValidateIf,
    IsNumber,
    IsBoolean,
    IsIn,
} from 'class-validator';
import { UserRole } from '../entities/User.entity';

export class RegisterDto {
    @ValidateIf((o) => !o.email)
    @Matches(/^\+?[1-9]\d{1,14}$/, {
        message: 'Phone number must be a valid international format',
    })
    @IsOptional()
    phone_number?: string;

    @ValidateIf((o) => !o.phone_number)
    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;

    @IsString()
    @MinLength(2)
    first_name: string;

    @IsString()
    @MinLength(2)
    last_name: string;

    @IsDateString()
    @IsOptional()
    date_of_birth?: string;

    @IsString()
    @IsOptional()
    gender?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsEnum(['en', 'rw'])
    @IsOptional()
    preferred_language?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @IsString()
    @IsOptional()
    invite_code?: string;
}

export class LoginDto {
    @IsString()
    identifier: string;

    @IsString()
    password: string;
}

export class RefreshTokenDto {
    @IsString()
    refreshToken: string;
}

export class VerifyOtpDto {
    @IsString()
    identifier: string;

    @IsString()
    @MinLength(4)
    otp: string;
}

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    first_name?: string;

    @IsString()
    @IsOptional()
    last_name?: string;

    @IsDateString()
    @IsOptional()
    date_of_birth?: string;

    @IsString()
    @IsOptional()
    gender?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsEnum(['en', 'rw'])
    @IsOptional()
    preferred_language?: string;

    @IsString()
    @IsOptional()
    email?: string;
}

export const STAFF_ROLES = ['facility_admin', 'pharmacist', 'store_manager', 'auditor', 'cashier', 'patient'] as const;

export class CreateStaffDto {
    @ValidateIf((o) => o.email !== '' && o.email !== null && o.email !== undefined)
    @IsEmail()
    email?: string;

    @IsString()
    @MinLength(2)
    first_name: string;

    @IsString()
    @MinLength(2)
    last_name: string;

    @IsOptional()
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password?: string;

    @IsIn(STAFF_ROLES as unknown as string[])
    role: (typeof STAFF_ROLES)[number];

    @IsOptional()
    @IsNumber()
    organization_id?: number;

    @IsOptional()
    @IsNumber()
    facility_id?: number;

    @IsOptional()
    @IsString()
    phone_number?: string;
}

export class AdminUpdateUserDto {
    @IsString()
    @IsOptional()
    first_name?: string;

    @IsString()
    @IsOptional()
    last_name?: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @IsOptional()
    @IsNumber()
    organization_id?: number;

    @IsOptional()
    @IsNumber()
    facility_id?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsString()
    phone_number?: string;

    @IsOptional()
    @IsString()
    address?: string;
}

export class SetInitialPasswordDto {
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    newPassword: string;
}

export class RequestPasswordResetDto {
    @IsString()
    identifier: string;
}

export class VerifyResetOtpDto {
    @IsString()
    identifier: string;

    @IsString()
    @MinLength(6)
    @Matches(/^\d{6}$/, {
        message: 'OTP must be exactly 6 digits',
    })
    otp: string;
}

export class ResetPasswordDto {
    @IsString()
    identifier: string;

    @IsString()
    @MinLength(6)
    @Matches(/^\d{6}$/, {
        message: 'OTP must be exactly 6 digits',
    })
    otp: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    newPassword: string;
}
