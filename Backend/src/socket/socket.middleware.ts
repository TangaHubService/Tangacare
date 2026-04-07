import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { logger } from '../middleware/logger.middleware';

export interface AuthenticatedSocket extends Socket {
    userId: number;
    userRole: string;
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger.error('JWT_SECRET not configured');
            return next(new Error('Server configuration error'));
        }

        const decoded = jwt.verify(token as string, jwtSecret) as {
            userId: number;
            role: string;
        };

        (socket as AuthenticatedSocket).userId = decoded.userId;
        (socket as AuthenticatedSocket).userRole = decoded.role;

        logger.info(`Socket authenticated for user ${decoded.userId}`);
        next();
    } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Invalid authentication token'));
    }
};
