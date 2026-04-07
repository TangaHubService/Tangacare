import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { logger } from '../middleware/logger.middleware';
import { SenderType, MessageType } from '../entities/Message.entity';
import { UserRole } from '../entities/User.entity';

const chatService = new ChatService();

export const createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { doctorId } = req.body;
        const userId = (req as any).user.userId;

        const conversation = await chatService.createConversation(userId, doctorId);

        res.status(201).json({
            success: true,
            data: conversation,
        });
    } catch (error: any) {
        logger.error('Error creating conversation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to create conversation',
        });
    }
};

export const getUserConversations = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const userRole = (req as any).user.role;

        const conversations = await chatService.getUserConversations(userId, userRole);

        res.status(200).json({
            success: true,
            data: conversations,
        });
    } catch (error: any) {
        logger.error('Error getting conversations:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to get conversations',
        });
    }
};

export const getConversation = async (req: Request, res: Response): Promise<void> => {
    try {
        const conversationId = parseInt(req.params.id);
        const userId = (req as any).user.userId;

        const conversation = await chatService.getConversation(conversationId, userId);

        if (!conversation) {
            res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: conversation,
        });
    } catch (error: any) {
        logger.error('Error getting conversation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to get conversation',
        });
    }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const conversationId = parseInt(req.params.id);
        const userId = (req as any).user.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const result = await chatService.getMessages(conversationId, userId, page, limit);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        logger.error('Error getting messages:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to get messages',
        });
    }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const conversationId = parseInt(req.params.id);
        const userId = (req as any).user.userId;
        const userRole = (req as any).user.role;
        const { content, message_type, file_url } = req.body;

        const senderType = userRole === UserRole.DOCTOR ? SenderType.DOCTOR : SenderType.PATIENT;

        const message = await chatService.sendMessage(
            conversationId,
            userId,
            senderType,
            content,
            message_type || MessageType.TEXT,
            file_url,
        );

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error: any) {
        logger.error('Error sending message:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to send message',
        });
    }
};

export const markConversationAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const conversationId = parseInt(req.params.id);
        const userId = (req as any).user.userId;

        await chatService.markConversationAsRead(conversationId, userId);

        res.status(200).json({
            success: true,
            message: 'Conversation marked as read',
        });
    } catch (error: any) {
        logger.error('Error marking conversation as read:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to mark conversation as read',
        });
    }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.userId;

        const unreadCounts = await chatService.getTotalUnreadCount(userId);

        res.status(200).json({
            success: true,
            data: unreadCounts,
        });
    } catch (error: any) {
        logger.error('Error getting unread count:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to get unread count',
        });
    }
};
