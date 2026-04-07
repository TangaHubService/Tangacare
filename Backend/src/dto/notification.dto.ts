import { IsNotEmpty, IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { NotificationType } from '../entities/Notification.entity';

export class CreateNotificationDto {
    @IsNotEmpty()
    @IsInt()
    userId: number;

    @IsNotEmpty()
    @IsEnum(NotificationType)
    type: NotificationType;

    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsString()
    message: string;

    @IsOptional()
    data?: Record<string, any>;
}

export class GetNotificationsDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 20;
}
