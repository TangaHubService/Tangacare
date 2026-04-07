import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chat.service';
import { NotificationService } from '../services/notification.service';
import { AuthenticatedSocket } from './socket.middleware';
import { logger } from '../middleware/logger.middleware';
import { SenderType, MessageType } from '../entities/Message.entity';
import { UserRole } from '../entities/User.entity';
import { NotificationType } from '../entities/Notification.entity';
import { CallService } from '../services/call.service';
import { CallType } from '../entities/Call.entity';
import { eventBus, EventTypes } from '../utils/eventBus';
import { Notification } from '../entities/Notification.entity';

export class SocketGateway {
    private io: Server;
    private chatService: ChatService;
    private notificationService: NotificationService;
    private callService: CallService;
    private onlineUsers: Map<number, string[]>;

    constructor(io: Server) {
        this.io = io;
        this.chatService = new ChatService();
        this.notificationService = new NotificationService();
        this.callService = new CallService();
        this.onlineUsers = new Map();
    }

    public initialize(): void {
        this.io.on('connection', (socket: Socket) => {
            const authSocket = socket as AuthenticatedSocket;
            logger.info(`Client connected: ${socket.id}, User: ${authSocket.userId}`);

            this.addOnlineUser(authSocket.userId, socket.id);

            this.chatService.updateUserOnlineStatus(authSocket.userId, true);

            this.broadcastUserOnlineStatus(authSocket.userId, true);

            this.handleJoinConversation(authSocket);
            this.handleLeaveConversation(authSocket);
            this.handleSendMessage(authSocket);
            this.handleTyping(authSocket);
            this.handleMarkRead(authSocket);
            this.handleGetOnlineStatus(authSocket);

            // Notification handlers
            this.handleNotificationRead(authSocket);
            this.handleNotificationReadAll(authSocket);
            this.handleNotificationSync(authSocket);

            this.handleInitiateCall(authSocket);
            this.handleAcceptCall(authSocket);
            this.handleRejectCall(authSocket);
            this.handleEndCall(authSocket);
            this.handleWebRTCOffer(authSocket);
            this.handleWebRTCAnswer(authSocket);
            this.handleWebRTCIceCandidate(authSocket);

            socket.on('disconnect', () => {
                this.handleDisconnect(authSocket);
            });
        });

        // Listen for internal events
        eventBus.on(EventTypes.NOTIFICATION_CREATED, (notification: Notification) => {
            const userSockets = this.onlineUsers.get(notification.user_id) || [];
            userSockets.forEach((socketId) => {
                this.io.to(socketId).emit('notification:new', notification);
            });
        });

        eventBus.on(EventTypes.PO_UPDATED, (data: { orderId: number; recipientIds: number[]; action: string }) => {
            data.recipientIds.forEach((userId) => {
                const userSockets = this.onlineUsers.get(userId) || [];
                userSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('po_updated', {
                        orderId: data.orderId,
                        action: data.action,
                    });
                });
            });
        });
    }

    private addOnlineUser(userId: number, socketId: string): void {
        const sockets = this.onlineUsers.get(userId) || [];
        sockets.push(socketId);
        this.onlineUsers.set(userId, sockets);
    }

    private removeOnlineUser(userId: number, socketId: string): void {
        const sockets = this.onlineUsers.get(userId) || [];
        const filtered = sockets.filter((id) => id !== socketId);

        if (filtered.length === 0) {
            this.onlineUsers.delete(userId);
        } else {
            this.onlineUsers.set(userId, filtered);
        }
    }

    private isUserOnline(userId: number): boolean {
        return this.onlineUsers.has(userId);
    }

    private async broadcastUserOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
        this.io.emit('user_status_change', {
            userId,
            isOnline,
            timestamp: new Date(),
        });
    }

    private handleJoinConversation(socket: AuthenticatedSocket): void {
        socket.on('join_conversation', async (data: { conversationId: number }) => {
            try {
                const { conversationId } = data;

                const hasAccess = await this.chatService.validateConversationAccess(conversationId, socket.userId);

                if (!hasAccess) {
                    socket.emit('error', { message: 'Unauthorized access to conversation' });
                    return;
                }

                const roomName = `conversation_${conversationId}`;
                socket.join(roomName);

                logger.info(`User ${socket.userId} joined conversation ${conversationId}`);

                socket.emit('joined_conversation', { conversationId });
            } catch (error) {
                logger.error('Error joining conversation:', error);
                socket.emit('error', { message: 'Failed to join conversation' });
            }
        });
    }

    private handleLeaveConversation(socket: AuthenticatedSocket): void {
        socket.on('leave_conversation', (data: { conversationId: number }) => {
            const { conversationId } = data;
            const roomName = `conversation_${conversationId}`;
            socket.leave(roomName);

            logger.info(`User ${socket.userId} left conversation ${conversationId}`);
            socket.emit('left_conversation', { conversationId });
        });
    }

    private handleSendMessage(socket: AuthenticatedSocket): void {
        socket.on(
            'send_message',
            async (data: { conversationId: number; content: string; messageType?: MessageType; fileUrl?: string }) => {
                try {
                    const { conversationId, content, messageType, fileUrl } = data;

                    const senderType = socket.userRole === UserRole.DOCTOR ? SenderType.DOCTOR : SenderType.PATIENT;

                    const message = await this.chatService.sendMessage(
                        conversationId,
                        socket.userId,
                        senderType,
                        content,
                        messageType,
                        fileUrl,
                    );

                    const conversation = await this.chatService.getConversation(conversationId, socket.userId);

                    if (!conversation) {
                        socket.emit('error', { message: 'Conversation not found' });
                        return;
                    }

                    const recipientId =
                        socket.userId === conversation.patient_id
                            ? conversation.doctor.user_id
                            : conversation.patient_id;

                    const roomName = `conversation_${conversationId}`;
                    this.io.to(roomName).emit('new_message', {
                        ...message,
                        conversation_id: conversationId,
                    });

                    const recipientSockets = this.onlineUsers.get(recipientId) || [];
                    const recipientInRoom = await this.isSocketInRoom(recipientSockets, roomName);

                    logger.info(
                        `[SocketGateway] Message sent. Conversation: ${conversationId}, Sender: ${socket.userId}, Recipient: ${recipientId}. RecipientSockets: ${recipientSockets.length}. InRoom: ${recipientInRoom}`,
                    );

                    if (!recipientInRoom) {
                        await this.notificationService.createNotification(
                            recipientId,
                            NotificationType.NEW_MESSAGE,
                            'New Message',
                            `${conversation.patient.first_name} ${conversation.patient.last_name}: ${content.substring(0, 50)}...`,
                            {
                                conversationId,
                                messageId: message.id,
                            },
                        );
                    }

                    const unreadCounts = await this.chatService.getTotalUnreadCount(recipientId);
                    recipientSockets.forEach((socketId) => {
                        this.io.to(socketId).emit('unread_count_update', unreadCounts);
                    });

                    logger.info(`Message sent in conversation ${conversationId} by user ${socket.userId}`);
                } catch (error) {
                    logger.error('Error sending message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            },
        );
    }

    private handleTyping(socket: AuthenticatedSocket): void {
        socket.on('typing', (data: { conversationId: number; isTyping: boolean }) => {
            const { conversationId, isTyping } = data;
            const roomName = `conversation_${conversationId}`;

            socket.to(roomName).emit('typing_indicator', {
                conversationId,
                userId: socket.userId,
                isTyping,
            });
        });
    }

    private handleMarkRead(socket: AuthenticatedSocket): void {
        socket.on('mark_read', async (data: { messageId: number; conversationId: number }) => {
            try {
                const { messageId, conversationId } = data;

                await this.chatService.markMessageAsRead(messageId, socket.userId);

                const messages = await this.chatService.getMessages(conversationId, socket.userId, 1, 1);
                const message = messages.messages.find((m) => m.id === messageId);

                if (message) {
                    const senderSockets = this.onlineUsers.get(message.sender_id) || [];
                    senderSockets.forEach((socketId) => {
                        this.io.to(socketId).emit('message_read', {
                            messageId,
                            conversationId,
                            readBy: socket.userId,
                            readAt: new Date(),
                        });
                    });
                }

                const unreadCounts = await this.chatService.getTotalUnreadCount(socket.userId);
                const userSockets = this.onlineUsers.get(socket.userId) || [];
                userSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('unread_count_update', unreadCounts);
                });

                logger.info(`Message ${messageId} marked as read by user ${socket.userId}`);
            } catch (error) {
                logger.error('Error marking message as read:', error);
                socket.emit('error', { message: 'Failed to mark message as read' });
            }
        });
    }

    private handleGetOnlineStatus(socket: AuthenticatedSocket): void {
        socket.on('get_online_status', async (data: { userIds: number[] }) => {
            try {
                const { userIds } = data;
                const statuses: { [userId: number]: { isOnline: boolean; lastSeen: Date | null } } = {};

                for (const userId of userIds) {
                    const isOnline = this.isUserOnline(userId);
                    const status = await this.chatService.getUserOnlineStatus(userId);
                    statuses[userId] = {
                        isOnline,
                        lastSeen: status.last_seen,
                    };
                }

                socket.emit('online_status', statuses);
            } catch (error) {
                logger.error('Error getting online status:', error);
                socket.emit('error', { message: 'Failed to get online status' });
            }
        });
    }

    private async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
        logger.info(`Client disconnected: ${socket.id}, User: ${socket.userId}`);

        this.removeOnlineUser(socket.userId, socket.id);

        if (!this.isUserOnline(socket.userId)) {
            await this.chatService.updateUserOnlineStatus(socket.userId, false);
            this.broadcastUserOnlineStatus(socket.userId, false);
        }
    }

    private async isSocketInRoom(socketIds: string[], roomName: string): Promise<boolean> {
        for (const socketId of socketIds) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket && socket.rooms.has(roomName)) {
                return true;
            }
        }
        return false;
    }

    public async sendNotificationToUser(
        userId: number,
        type: NotificationType,
        title: string,
        message: string,
        data?: Record<string, any>,
    ): Promise<void> {
        await this.notificationService.createNotification(userId, type, title, message, data);
    }

    private handleInitiateCall(socket: AuthenticatedSocket): void {
        socket.on('call_initiate', async (data: { conversationId: number; calleeId: number; callType: string }) => {
            try {
                logger.info(`[SocketGateway] Received call_initiate from ${socket.userId}: ${JSON.stringify(data)}`);
                const { conversationId, calleeId, callType } = data;

                if (callType !== 'audio' && callType !== 'video') {
                    socket.emit('error', { message: 'Invalid call type' });
                    return;
                }

                const type = callType === 'video' ? CallType.VIDEO : CallType.AUDIO;

                const call = await this.callService.initiateCall(conversationId, socket.userId, calleeId, type);

                const conversation = await this.chatService.getConversation(conversationId, socket.userId);
                let callerName = 'Unknown';
                if (conversation) {
                    if (socket.userId === conversation.patient_id) {
                        callerName = `${conversation.patient.first_name} ${conversation.patient.last_name}`;
                    } else if (conversation.doctor && conversation.doctor.user) {
                        callerName = `Dr. ${conversation.doctor.user.first_name} ${conversation.doctor.user.last_name}`;
                    }
                }

                const calleeSockets = this.onlineUsers.get(calleeId) || [];
                logger.info(
                    `[SocketGateway] Notify callee ${calleeId}. Found ${calleeSockets.length} sockets: ${JSON.stringify(calleeSockets)}`,
                );

                calleeSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('incoming_call', {
                        callId: call.id,
                        conversationId,
                        callerId: socket.userId,
                        callType: type,
                        callerName: callerName,
                    });
                });

                socket.emit('call_initiated', { callId: call.id });

                logger.info(`Call initiated: ${call.id} by ${socket.userId}`);
            } catch (error) {
                logger.error('Error initiating call:', error);
                socket.emit('error', { message: 'Failed to initiate call' });
            }
        });
    }

    private handleAcceptCall(socket: AuthenticatedSocket): void {
        socket.on('call_accept', async (data: { callId: number }) => {
            try {
                const { callId } = data;
                const call = await this.callService.acceptCall(callId, socket.userId);

                const callerSockets = this.onlineUsers.get(call.caller_id) || [];
                callerSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('call_accepted', { callId });
                });

                logger.info(`Call accepted: ${callId} by ${socket.userId}`);
            } catch (error) {
                logger.error('Error accepting call:', error);
                socket.emit('error', { message: 'Failed to accept call' });
            }
        });
    }

    private handleRejectCall(socket: AuthenticatedSocket): void {
        socket.on('call_reject', async (data: { callId: number }) => {
            try {
                const { callId } = data;
                const call = await this.callService.rejectCall(callId, socket.userId);

                const callerSockets = this.onlineUsers.get(call.caller_id) || [];
                callerSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('call_rejected', { callId });
                });

                logger.info(`Call rejected: ${callId} by ${socket.userId}`);
            } catch (error) {
                logger.error('Error rejecting call:', error);
                socket.emit('error', { message: 'Failed to reject call' });
            }
        });
    }

    private handleEndCall(socket: AuthenticatedSocket): void {
        socket.on('call_end', async (data: { callId: number }) => {
            try {
                const { callId } = data;
                const call = await this.callService.endCall(callId, socket.userId);

                const otherUserId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                const otherSockets = this.onlineUsers.get(otherUserId) || [];

                otherSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('call_ended', { callId });
                });

                logger.info(`Call ended: ${callId} by ${socket.userId}`);
            } catch (error) {
                logger.error('Error ending call:', error);
            }
        });
    }

    private handleWebRTCOffer(socket: AuthenticatedSocket): void {
        socket.on('webrtc_offer', async (data: { callId: number; sdp: any }) => {
            try {
                const { callId, sdp } = data;

                if (!(await this.callService.validateCallParticipant(callId, socket.userId))) return;

                const call = await this.callService.getCallById(callId, socket.userId);
                if (!call) return;

                const targetUserId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                const targetSockets = this.onlineUsers.get(targetUserId) || [];

                targetSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('webrtc_offer', { callId, sdp });
                });
            } catch (error) {
                logger.error('Error in WebRTC offer:', error);
            }
        });
    }

    private handleWebRTCAnswer(socket: AuthenticatedSocket): void {
        socket.on('webrtc_answer', async (data: { callId: number; sdp: any }) => {
            try {
                const { callId, sdp } = data;
                if (!(await this.callService.validateCallParticipant(callId, socket.userId))) return;

                const call = await this.callService.getCallById(callId, socket.userId);
                if (!call) return;

                const targetUserId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                const targetSockets = this.onlineUsers.get(targetUserId) || [];

                targetSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('webrtc_answer', { callId, sdp });
                });
            } catch (error) {
                logger.error('Error in WebRTC answer:', error);
            }
        });
    }

    private handleWebRTCIceCandidate(socket: AuthenticatedSocket): void {
        socket.on('webrtc_ice_candidate', async (data: { callId: number; candidate: any }) => {
            try {
                const { callId, candidate } = data;
                if (!(await this.callService.validateCallParticipant(callId, socket.userId))) return;

                const call = await this.callService.getCallById(callId, socket.userId);
                if (!call) return;

                const targetUserId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                const targetSockets = this.onlineUsers.get(targetUserId) || [];

                targetSockets.forEach((socketId) => {
                    this.io.to(socketId).emit('webrtc_ice_candidate', { callId, candidate });
                });
            } catch (error) {
                logger.error('Error in WebRTC ICE candidate:', error);
            }
        });
    }

    private handleNotificationRead(socket: AuthenticatedSocket): void {
        socket.on('notification:read', async (data: { notificationId: number }) => {
            try {
                await this.notificationService.markNotificationAsRead(data.notificationId, socket.userId);
                socket.emit('notification:read_success', { notificationId: data.notificationId });
            } catch (error) {
                logger.error('Error marking notification as read:', error);
                socket.emit('error', { message: 'Failed to mark notification as read' });
            }
        });
    }

    private handleNotificationReadAll(socket: AuthenticatedSocket): void {
        socket.on('notification:read_all', async () => {
            try {
                await this.notificationService.markAllAsRead(socket.userId);
                socket.emit('notification:read_all_success');
            } catch (error) {
                logger.error('Error marking all notifications as read:', error);
                socket.emit('error', { message: 'Failed to mark all notifications as read' });
            }
        });
    }

    private handleNotificationSync(socket: AuthenticatedSocket): void {
        socket.on('notification:sync', async () => {
            try {
                const result = await this.notificationService.getUserNotifications(socket.userId, 1, 50);
                socket.emit('notification:sync', {
                    notifications: result.notifications,
                    unreadCount: await this.notificationService.getUnreadCount(socket.userId),
                });
            } catch (error) {
                logger.error('Error syncing notifications:', error);
                socket.emit('error', { message: 'Failed to sync notifications' });
            }
        });
    }
}
