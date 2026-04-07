import { Request, Response } from 'express';
import { DispensingController } from '../../controllers/pharmacy/dispensing.controller';

jest.mock('../../services/pharmacy/dispensing.service');

describe('DispensingController substitutions', () => {
    let controller: DispensingController;
    let req: any;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new DispensingController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('requires facility scope', async () => {
        req = {
            params: { medicineId: '8' } as any,
            user: { role: 'owner' } as any,
        };
        const spy = jest.spyOn((controller as any).dispensingService, 'getSubstitutionRecommendations');

        await controller.getSubstitutions(req as Request, res as Response);

        expect(spy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('validates medicineId parameter', async () => {
        req = {
            scopedFacilityId: 3,
            params: { medicineId: 'abc' } as any,
            user: { role: 'pharmacist', facility_id: 3 } as any,
        };
        const spy = jest.spyOn((controller as any).dispensingService, 'getSubstitutionRecommendations');

        await controller.getSubstitutions(req as Request, res as Response);

        expect(spy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns substitution recommendations for scoped facility', async () => {
        req = {
            scopedFacilityId: 5,
            params: { medicineId: '11' } as any,
            user: { role: 'pharmacist', facility_id: 5, organizationId: 22 } as any,
        };
        const alternatives = [
            {
                id: 20,
                name: 'Alternative A',
                selling_price: 450,
                total_stock: 120,
                reason: 'Same therapeutic category with available stock',
            },
        ];

        const spy = jest
            .spyOn((controller as any).dispensingService, 'getSubstitutionRecommendations')
            .mockResolvedValue(alternatives);

        await controller.getSubstitutions(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(5, 22, 11);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
