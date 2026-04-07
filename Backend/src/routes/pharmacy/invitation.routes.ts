import { Router } from 'express';
import { InvitationController } from '../../controllers/pharmacy/invitation.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const invitationController = new InvitationController();

// Public route to check invite details before registering
router.get('/:code', invitationController.getInvite);

// Admin only route to create invites
router.post(
    '/',
    authenticate,
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    invitationController.createInvite,
);

// Authenticated route to accept an invite
router.post('/accept', authenticate, invitationController.acceptInvite);

export default router;
