import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Conversation } from '../entities/Conversation.entity';
import { Message, SenderType, MessageType } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { User, UserRole } from '../entities/User.entity';
import { Doctor } from '../entities/Doctor.entity';

export class ChatService {
    private conversationRepository: Repository<Conversation>;
    private messageRepository: Repository<Message>;
    private messageReadRepository: Repository<MessageRead>;
    private userRepository: Repository<User>;
    private doctorRepository: Repository<Doctor>;

    constructor() {
        this.conversationRepository = AppDataSource.getRepository(Conversation);
        this.messageRepository = AppDataSource.getRepository(Message);
        this.messageReadRepository = AppDataSource.getRepository(MessageRead);
        this.userRepository = AppDataSource.getRepository(User);
        this.doctorRepository = AppDataSource.getRepository(Doctor);
    }

    async createConversation(patientId: number, doctorId: number): Promise<Conversation> {
        const existing = await this.conversationRepository.findOne({
            where: { patient_id: patientId, doctor_id: doctorId },
        });

        if (existing) {
            return existing;
        }

        const patient = await this.userRepository.findOne({
            where: { id: patientId, role: UserRole.PATIENT },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }

        const doctor = await this.doctorRepository.findOne({
            where: { id: doctorId },
        });
        if (!doctor) {
            throw new Error('Doctor not found');
        }

        const conversation = this.conversationRepository.create({
            patient_id: patientId,
            doctor_id: doctorId,
        });

        return await this.conversationRepository.save(conversation);
    }

    async getConversation(conversationId: number, userId: number): Promise<Conversation | null> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
            relations: ['patient', 'doctor', 'doctor.user'],
        });

        if (!conversation) {
            return null;
        }

        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['doctor'],
        });

        const isPatient = conversation.patient_id === userId;
        const isDoctor = user?.doctor && conversation.doctor_id === user.doctor.id;

        if (!isPatient && !isDoctor) {
            throw new Error('Unauthorized access to conversation');
        }

        return conversation;
    }

    async getUserConversations(userId: number, userRole: UserRole): Promise<any[]> {
        let conversations: Conversation[];

        if (userRole === UserRole.PATIENT) {
            conversations = await this.conversationRepository.find({
                where: { patient_id: userId },
                relations: ['doctor', 'doctor.user'],
                order: { last_message_at: 'DESC' },
            });
        } else if (userRole === UserRole.DOCTOR) {
            const user = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['doctor'],
            });

            if (!user?.doctor) {
                throw new Error('Doctor profile not found');
            }

            conversations = await this.conversationRepository.find({
                where: { doctor_id: user.doctor.id },
                relations: ['patient'],
                order: { last_message_at: 'DESC' },
            });
        } else {
            throw new Error('Invalid user role for conversations');
        }

        const conversationsWithUnread = await Promise.all(
            conversations.map(async (conv) => {
                const unreadCount = await this.getConversationUnreadCount(conv.id, userId);
                const otherUser = userRole === UserRole.PATIENT ? conv.doctor?.user : conv.patient;

                return {
                    ...conv,
                    unread_count: unreadCount,
                    other_user: otherUser
                        ? {
                              id: otherUser.id,
                              first_name: otherUser.first_name,
                              last_name: otherUser.last_name,
                              profile_picture_url: otherUser.profile_picture_url,
                              is_online: otherUser.is_online,
                              last_seen: otherUser.last_seen,
                          }
                        : null,
                };
            }),
        );

        return conversationsWithUnread;
    }

    async sendMessage(
        conversationId: number,
        senderId: number,
        senderType: SenderType,
        content: string,
        messageType: MessageType = MessageType.TEXT,
        fileUrl?: string,
    ): Promise<Message> {
        const conversation = await this.getConversation(conversationId, senderId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const message = this.messageRepository.create({
            conversation_id: conversationId,
            sender_id: senderId,
            sender_type: senderType,
            content,
            message_type: messageType,
            file_url: fileUrl,
        });

        const savedMessage = await this.messageRepository.save(message);

        await this.conversationRepository.update(conversationId, {
            last_message: content,
            last_message_at: new Date(),
        });

        return savedMessage;
    }

    async getMessages(
        conversationId: number,
        userId: number,
        page: number = 1,
        limit: number = 50,
    ): Promise<{ messages: Message[]; total: number; page: number; totalPages: number }> {
        await this.getConversation(conversationId, userId);

        const [messages, total] = await this.messageRepository.findAndCount({
            where: { conversation_id: conversationId },
            relations: ['sender', 'reads'],
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            messages: messages.reverse(),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markMessageAsRead(messageId: number, userId: number): Promise<void> {
        const message = await this.messageRepository.findOne({
            where: { id: messageId },
            relations: ['conversation'],
        });

        if (!message) {
            throw new Error('Message not found');
        }

        await this.getConversation(message.conversation_id, userId);

        if (message.sender_id === userId) {
            return;
        }

        const existing = await this.messageReadRepository.findOne({
            where: { message_id: messageId, user_id: userId },
        });

        if (existing) {
            return;
        }

        const messageRead = this.messageReadRepository.create({
            message_id: messageId,
            user_id: userId,
        });

        await this.messageReadRepository.save(messageRead);
    }

    async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
        await this.getConversation(conversationId, userId);

        const messages = await this.messageRepository
            .createQueryBuilder('message')
            .leftJoin('message.reads', 'read', 'read.user_id = :userId', { userId })
            .where('message.conversation_id = :conversationId', { conversationId })
            .andWhere('message.sender_id != :userId', { userId })
            .andWhere('read.id IS NULL')
            .getMany();

        const readPromises = messages.map((message) =>
            this.messageReadRepository.save({
                message_id: message.id,
                user_id: userId,
            }),
        );

        await Promise.all(readPromises);
    }

    async getConversationUnreadCount(conversationId: number, userId: number): Promise<number> {
        const count = await this.messageRepository
            .createQueryBuilder('message')
            .leftJoin('message.reads', 'read', 'read.user_id = :userId', { userId })
            .where('message.conversation_id = :conversationId', { conversationId })
            .andWhere('message.sender_id != :userId', { userId })
            .andWhere('read.id IS NULL')
            .getCount();

        return count;
    }

    async getTotalUnreadCount(userId: number): Promise<{ [conversationId: number]: number }> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['doctor'],
        });

        if (!user) {
            throw new Error('User not found');
        }

        let conversations: Conversation[];

        if (user.role === UserRole.PATIENT) {
            conversations = await this.conversationRepository.find({
                where: { patient_id: userId },
            });
        } else if (user.role === UserRole.DOCTOR && user.doctor) {
            conversations = await this.conversationRepository.find({
                where: { doctor_id: user.doctor.id },
            });
        } else {
            return {};
        }

        const unreadCounts: { [conversationId: number]: number } = {};

        await Promise.all(
            conversations.map(async (conv) => {
                const count = await this.getConversationUnreadCount(conv.id, userId);
                unreadCounts[conv.id] = count;
            }),
        );

        return unreadCounts;
    }

    async updateUserOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
        await this.userRepository.update(userId, {
            is_online: isOnline,
            last_seen: new Date(),
        });
    }

    async getUserOnlineStatus(userId: number): Promise<{ is_online: boolean; last_seen: Date | null }> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['is_online', 'last_seen'],
        });

        if (!user) {
            throw new Error('User not found');
        }

        return {
            is_online: user.is_online,
            last_seen: user.last_seen,
        };
    }

    async validateConversationAccess(conversationId: number, userId: number): Promise<boolean> {
        try {
            await this.getConversation(conversationId, userId);
            return true;
        } catch {
            return false;
        }
    }
}
