import { Request, Response } from 'express';
import { ResponseUtil } from '../../utils/response.util';
import { AdminDashboardService } from '../../services/admin/admin-dashboard.service';

export class AdminDashboardController {
    private service: AdminDashboardService;

    constructor() {
        this.service = new AdminDashboardService();
    }

    dashboard = async (req: Request, res: Response) => {
        try {
            const renewalsDueSoonDays = req.query.renewalsDueSoonDays
                ? Number(req.query.renewalsDueSoonDays)
                : undefined;

            const trendMonths = req.query.trendMonths ? Number(req.query.trendMonths) : undefined;

            const data = await this.service.getDashboardData({
                renewalsDueSoonDays,
                trendMonths,
            });

            ResponseUtil.success(res, data, 'Admin dashboard data retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve admin dashboard data', error?.message);
        }
    };
}

