import { Request, Response } from 'express';
import { InvitationService } from '../../services/pharmacy/invitation.service';
import { ResponseUtil } from '../../utils/response.util';

export class InvitationController {
    private invitationService: InvitationService;

    constructor() {
        this.invitationService = new InvitationService();
    }

    createInvite = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const invite = await this.invitationService.createInvite({
                ...req.body,
                invited_by_id: user.userId,
            });
            ResponseUtil.created(res, invite, 'Invitation sent successfully');
        } catch (error: any) {
            ResponseUtil.error(res, error.message, error.statusCode || 500);
        }
    };

    getInvite = async (req: Request, res: Response): Promise<void> => {
        try {
            const { code } = req.params;
            const invite = await this.invitationService.getInviteByCode(code);
            ResponseUtil.success(res, invite);
        } catch (error: any) {
            ResponseUtil.error(res, error.message, error.statusCode || 500);
        }
    };

    acceptInvite = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const { code } = req.body;
            await this.invitationService.acceptInvite(user.userId, code);
            ResponseUtil.success(res, null, 'Invitation accepted successfully');
        } catch (error: any) {
            ResponseUtil.error(res, error.message, error.statusCode || 500);
        }
    };
}
