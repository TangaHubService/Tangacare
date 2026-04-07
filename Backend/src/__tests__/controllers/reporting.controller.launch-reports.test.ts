import { Request, Response } from 'express';
import { ReportingController } from '../../controllers/pharmacy/reporting.controller';

jest.mock('../../services/pharmacy/reporting.service');

describe('ReportingController launch reports', () => {
    let controller: ReportingController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new ReportingController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('getPurchaseVsSalesReport validates start_date and end_date', async () => {
        req = {
            params: { facilityId: '1' },
            query: {},
            user: { role: 'facility_admin', facility_id: 1, organizationId: 9 },
        } as any;

        const spy = jest.spyOn((controller as any).reportingService, 'getPurchaseVsSalesReport');

        await controller.getPurchaseVsSalesReport(req as Request, res as Response);

        expect(spy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('getPurchaseVsSalesReport calls service with parsed date range', async () => {
        req = {
            params: { facilityId: '1' },
            query: { start_date: '2026-01-01', end_date: '2026-01-31' },
            user: { role: 'facility_admin', facility_id: 1, organizationId: 9 },
        } as any;

        const spy = jest
            .spyOn((controller as any).reportingService, 'getPurchaseVsSalesReport')
            .mockResolvedValue({} as any);

        await controller.getPurchaseVsSalesReport(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(1, 9, expect.any(Date), expect.any(Date));
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getMedicineMarginReport calls service with parsed date range', async () => {
        req = {
            params: { facilityId: '1' },
            query: { start_date: '2026-02-01', end_date: '2026-02-28' },
            user: { role: 'facility_admin', facility_id: 1, organizationId: 9 },
        } as any;

        const spy = jest
            .spyOn((controller as any).reportingService, 'getMedicineMarginReport')
            .mockResolvedValue({} as any);

        await controller.getMedicineMarginReport(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(1, 9, expect.any(Date), expect.any(Date));
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getInventoryAgingReport forwards as_of_date filter', async () => {
        req = {
            params: { facilityId: '1' },
            query: { as_of_date: '2026-03-01' },
            user: { role: 'facility_admin', facility_id: 1, organizationId: 9 },
        } as any;

        const spy = jest
            .spyOn((controller as any).reportingService, 'getInventoryAgingReport')
            .mockResolvedValue({} as any);

        await controller.getInventoryAgingReport(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(1, 9, expect.any(Date));
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
