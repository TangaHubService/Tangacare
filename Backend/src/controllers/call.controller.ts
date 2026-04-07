import { Request, Response } from 'express';
import { CallService } from '../services/call.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class CallController {
    private callService: CallService;

    constructor() {
        this.callService = new CallService();
    }

    getCallHistory = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.userId;

            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await this.callService.getCallHistory(userId, page, limit);

            res.status(200).json(result);
        } catch (error: any) {
            console.error('Error fetching call history:', error);
            res.status(500).json({ message: 'Failed to fetch call history' });
        }
    };

    getCallDetails = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.userId;

            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const callId = parseInt(req.params.id);

            const call = await this.callService.getCallById(callId, userId);

            if (!call) {
                res.status(404).json({ message: 'Call not found' });
                return;
            }

            res.status(200).json(call);
        } catch (error: any) {
            console.error('Error fetching call details:', error);
            res.status(500).json({ message: 'Failed to fetch call details' });
        }
    };
}
