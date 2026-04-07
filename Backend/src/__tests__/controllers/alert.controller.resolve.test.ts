import { Request, Response, NextFunction } from 'express';
import { AlertController } from '../../controllers/pharmacy/alert.controller';
import { AppDataSource } from '../../config/database';
import { AlertStatus, AlertType } from '../../entities/Alert.entity';

jest.mock('../../services/pharmacy/alert.service');
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('AlertController resolveAlert', () => {
    const alertRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
    };

    let controller: AlertController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();
        (AppDataSource.getRepository as jest.Mock).mockReturnValue(alertRepository);
        controller = new AlertController();

        req = {
            params: { id: '12' },
            body: {},
            user: { userId: 77, facility_id: 5, organizationId: 9, role: 'pharmacist' },
        } as any;

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();
    });

    it('rejects action that does not match alert type', async () => {
        alertRepository.findOne.mockResolvedValue({
            id: 12,
            facility_id: 5,
            alert_type: AlertType.LOW_STOCK,
            status: AlertStatus.ACTIVE,
        });

        req.body = {
            action_taken: 'Disposed',
            action_reason: 'Disposed because no stock movement needed anymore.',
        };

        await controller.resolveAlert(req as Request, res as Response, next);

        expect(alertRepository.save).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Invalid action') }));
    });

    it('rejects short reason even for allowed action', async () => {
        alertRepository.findOne.mockResolvedValue({
            id: 12,
            facility_id: 5,
            alert_type: AlertType.EXPIRY_SOON,
            status: AlertStatus.ACTIVE,
        });

        req.body = {
            action_taken: 'Discounted',
            action_reason: 'done',
        };

        await controller.resolveAlert(req as Request, res as Response, next);

        expect(alertRepository.save).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Action reason must be at least 10 characters' }),
        );
    });

    it('normalizes legacy action and resolves alert', async () => {
        const alert = {
            id: 12,
            facility_id: 5,
            alert_type: AlertType.LOW_STOCK,
            status: AlertStatus.ACTIVE,
            resolved_at: null,
            resolved_by_id: null,
            action_taken: null,
            action_reason: null,
        };

        alertRepository.findOne.mockResolvedValue(alert);
        alertRepository.save.mockResolvedValue({ ...alert, action_taken: 'Restocked' });

        req.body = {
            action_taken: 'Restocked / Ordered',
            action_reason: 'Placed urgent order and confirmed supplier ETD for today.',
        };

        await controller.resolveAlert(req as Request, res as Response, next);

        expect(alertRepository.findOne).toHaveBeenCalledWith({
            where: { id: 12, facility_id: 5, organization_id: 9 },
        });
        expect(alertRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                status: AlertStatus.RESOLVED,
                resolved_by_id: 77,
                action_taken: 'Restocked',
                action_reason: 'Placed urgent order and confirmed supplier ETD for today.',
            }),
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});
