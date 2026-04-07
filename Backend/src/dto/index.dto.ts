import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, Min } from 'class-validator';

export class CreateDoctorDto {
    @IsNumber()
    user_id: number;

    @IsString()
    license_number: string;

    @IsString()
    specialization: string;

    @IsNumber()
    @IsOptional()
    years_of_experience?: number;

    @IsNumber()
    @Min(0)
    consultation_fee: number;

    @IsString()
    @IsOptional()
    bio?: string;
}

export class UpdateDoctorDto {
    @IsString()
    @IsOptional()
    specialization?: string;

    @IsNumber()
    @IsOptional()
    years_of_experience?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    consultation_fee?: number;

    @IsBoolean()
    @IsOptional()
    is_available?: boolean;

    @IsString()
    @IsOptional()
    bio?: string;
}

export class CreateAppointmentDto {
    @IsNumber()
    doctor_id: number;

    @IsString()
    appointment_date: string;

    @IsNumber()
    @IsOptional()
    duration_minutes?: number;

    @IsEnum(['video', 'audio', 'text'])
    consultation_type: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateAppointmentDto {
    @IsString()
    @IsOptional()
    appointment_date?: string;

    @IsEnum(['scheduled', 'completed', 'cancelled', 'no_show'])
    @IsOptional()
    status?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreatePrescriptionDto {
    @IsNumber()
    appointment_id: number;

    @IsNumber()
    doctor_id: number;

    @IsNumber()
    patient_id: number;

    @IsString()
    prescription_text: string;

    @IsString()
    @IsOptional()
    diagnosis?: string;
}

export class CreatePaymentDto {
    @IsNumber()
    @IsOptional()
    appointment_id?: number;

    @IsNumber()
    amount: number;

    @IsEnum(['mobile_money', 'credit_card', 'insurance', 'subscription'])
    payment_method: string;

    @IsEnum(['flutterwave', 'paypack', 'other'])
    payment_gateway: string;
}

export class CreateHealthRecordDto {
    @IsEnum(['allergy', 'condition', 'medication', 'vaccination', 'other'])
    record_type: string;

    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    start_date?: string;

    @IsString()
    @IsOptional()
    end_date?: string;

    @IsString()
    @IsOptional()
    severity?: string;
}

export class CreateHealthTipDto {
    @IsString()
    title: string;

    @IsString()
    content: string;

    @IsEnum(['general', 'nutrition', 'exercise', 'mental_health', 'prevention'])
    category: string;

    @IsEnum(['en', 'rw'])
    @IsOptional()
    language?: string;

    @IsBoolean()
    @IsOptional()
    is_published?: boolean;
}
