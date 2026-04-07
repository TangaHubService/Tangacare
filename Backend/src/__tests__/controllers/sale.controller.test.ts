import { Request, Response } from 'express';
import { SaleController } from '../../controllers/pharmacy/sale.controller';

jest.mock('../../services/pharmacy/sale.service');
jest.mock('../../services/pharmacy/print.service');

describe('SaleController findAll', () => {
    let controller: SaleController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new SaleController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('passes patient_id filter to SaleService.listSales', async () => {
        req = {
            query: { page: '1', limit: '3', patient_id: '17' },
            user: { facilityId: 5, organizationId: 12 },
        } as any;

        const listSpy = jest.spyOn((controller as any).saleService, 'listSales').mockResolvedValue({
            data: [],
            total: 0,
            page: 1,
            limit: 3,
        });

        await controller.findAll(req as Request, res as Response);

        expect(listSpy).toHaveBeenCalledWith(5, 1, 3, 12, req, 17);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects invalid patient_id query', async () => {
        req = {
            query: { patient_id: 'abc' },
            user: { facilityId: 5, organizationId: 12 },
        } as any;

        const listSpy = jest.spyOn((controller as any).saleService, 'listSales');

        await controller.findAll(req as Request, res as Response);

        expect(listSpy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('passes organization scope to SaleService.getSale', async () => {
        req = {
            params: { id: '44' },
            user: { facilityId: 5, organizationId: 12 },
        } as any;

        const getSpy = jest.spyOn((controller as any).saleService, 'getSale').mockResolvedValue({ id: 44 } as any);

        await controller.findOne(req as Request, res as Response);

        expect(getSpy).toHaveBeenCalledWith(44, 12, 5);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
