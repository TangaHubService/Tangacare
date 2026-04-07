import { IsNotEmpty, IsInt, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { MessageType } from '../entities/Message.entity';

export class CreateConversationDto {
    @IsNotEmpty()
    @IsInt()
    doctorId: number;
}

export class SendMessageDto {
    @IsNotEmpty()
    @IsString()
    content: string;

    @IsOptional()
    @IsEnum(MessageType)
    message_type?: MessageType;

    @IsOptional()
    @IsString()
    file_url?: string;
}

export class GetMessagesDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 50;
}

export class MarkReadDto {
    @IsNotEmpty()
    @IsInt()
    messageId: number;
}
