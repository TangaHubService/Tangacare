import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    createConversation,
    getUserConversations,
    getConversation,
    getMessages,
    sendMessage,
    markConversationAsRead,
    getUnreadCount,
} from '../controllers/chat.controller';

const router = Router();

router.use(authenticate);

router.post('/conversations', createConversation);

router.get('/conversations', getUserConversations);

router.get('/conversations/:id', getConversation);

router.get('/conversations/:id/messages', getMessages);

router.post('/conversations/:id/messages', sendMessage);

router.put('/conversations/:id/mark-read', markConversationAsRead);

router.get('/unread-count', getUnreadCount);

export default router;
