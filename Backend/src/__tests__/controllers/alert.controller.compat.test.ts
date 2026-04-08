import { Response } from 'express';
import { AlertController } from '../../controllers/pharmacy/alert.controller';

jest.mock('../../services/pharmacy/alert.service');

describe('AlertController Wave1 Compatibility', () => {
    let controller: AlertController;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        controller = new AlertController();
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('getAlerts should include both alert_type and type fields', async () => {
        const req: any = {
            query: { status: 'active' },
            user: { userId: 1, facilityId: 5, organizationId: 3 },
        };

        jest.spyOn((controller as any).alertService, 'getAlerts').mockResolvedValue({
            data: [
                {
                    id: 1,
                    facility_id: 5,
                    alert_type: 'low_stock',
                    status: 'active',
                    title: 'Low stock',
                    message: 'Paracetamol low',
                },
            ],
            total: 1,
            page: 1,
            limit: 50,
            totalPages: 1,
        });

        await controller.getAlerts(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.data[0].alert_type).toBe('low_stock');
        expect(payload.data[0].type).toBe('low_stock');
        expect(payload.meta.total).toBe(1);
    });
});
