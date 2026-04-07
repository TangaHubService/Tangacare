import { Request, Response } from 'express';
import { AnalyticsController } from '../../controllers/pharmacy/analytics.controller';

jest.mock('../../services/pharmacy/analytics.service');
jest.mock('../../services/pharmacy/consumption.service');
jest.mock('../../services/pharmacy/reporting.service');
jest.mock('../../services/pharmacy/intelligence.service');

describe('AnalyticsController Phase2/3 endpoints', () => {
    let controller: AnalyticsController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new AnalyticsController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('getVelocitySegmentation requires facility scope', async () => {
        req = { query: {}, user: { role: 'owner' } } as any;
        const spy = jest.spyOn((controller as any).intelligenceService, 'getVelocitySegmentation');

        await controller.getVelocitySegmentation(req as Request, res as Response);

        expect(spy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('getDemandForecast forwards parsed horizon/history params', async () => {
        req = {
            query: { horizon_days: '45', history_days: '200' },
            scopedFacilityId: 8,
            user: { role: 'facility_admin', facility_id: 8, organizationId: 15 },
        } as any;

        const spy = jest.spyOn((controller as any).intelligenceService, 'getDemandForecast').mockResolvedValue({});

        await controller.getDemandForecast(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(8, 15, 45, 200);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getMultiBranchTransferSuggestions uses organization scope', async () => {
        req = {
            query: { lookback_days: '75' },
            user: { role: 'owner', organizationId: 11 },
        } as any;

        const spy = jest
            .spyOn((controller as any).intelligenceService, 'getMultiBranchTransferSuggestions')
            .mockResolvedValue({});

        await controller.getMultiBranchTransferSuggestions(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(11, 75);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getMobileWorkflowBoard returns quick action payload', async () => {
        req = {
            scopedFacilityId: 3,
            user: { role: 'facility_admin', facility_id: 3, organization_id: 5 },
        } as any;

        const spy = jest
            .spyOn((controller as any).intelligenceService, 'getMobileWorkflowBoard')
            .mockResolvedValue({});

        await controller.getMobileWorkflowBoard(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(3, 5);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
