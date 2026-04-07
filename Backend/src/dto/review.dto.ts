import { IsInt, IsString, IsOptional, Min, Max, IsBoolean } from 'class-validator';

export class CreateReviewDto {
    @IsInt()
    appointment_id: number;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsOptional()
    review_text?: string;
}

export class UpdateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    @IsOptional()
    rating?: number;

    @IsString()
    @IsOptional()
    review_text?: string;

    @IsBoolean()
    @IsOptional()
    is_featured?: boolean;
}
