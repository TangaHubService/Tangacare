import { Request, Response } from 'express';
import { KPIController } from '../../controllers/pharmacy/kpi.controller';

jest.mock('../../services/pharmacy/kpi.service');
jest.mock('../../services/pharmacy/reporting.service');

describe('KPIController scope handling', () => {
    let controller: KPIController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new KPIController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('getComprehensiveKPIs supports organization scope without facility', async () => {
        req = {
            query: { start_date: '2026-03-01', end_date: '2026-03-08' },
            scope: { organizationId: 9 },
            user: { role: 'owner' },
        } as any;

        const getSpy = jest.spyOn((controller as any).kpiService, 'getComprehensiveKPIs').mockResolvedValue({} as any);

        await controller.getComprehensiveKPIs(req as Request, res as Response);

        expect(getSpy).toHaveBeenCalledWith(undefined, '2026-03-01', '2026-03-08', 9);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getComprehensiveKPIs rejects when neither facility nor organization is resolved', async () => {
        req = {
            query: { start_date: '2026-03-01', end_date: '2026-03-08' },
            user: { role: 'owner' },
        } as any;

        const getSpy = jest.spyOn((controller as any).kpiService, 'getComprehensiveKPIs');

        await controller.getComprehensiveKPIs(req as Request, res as Response);

        expect(getSpy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('getDashboardSummary returns organization-aggregated breakdowns in org-level view', async () => {
        req = {
            scope: { organizationId: 11 },
            user: { role: 'owner' },
        } as any;

        const kpiPayload = {
            financial: {},
            inventory: {},
            operational: {},
        } as any;

        const kpiSpy = jest.spyOn((controller as any).kpiService, 'getComprehensiveKPIs').mockResolvedValue(kpiPayload);
        const topSpy = jest
            .spyOn((controller as any).reportingService, 'getTopMedicinesByRevenue')
            .mockResolvedValue([{ medicine_id: 1, medicine_name: 'Amox', revenue: 1000, quantity: 10, profit: 250 }]);
        const categorySpy = jest
            .spyOn((controller as any).reportingService, 'getCategoryPerformance')
            .mockResolvedValue([{ category_id: 1, category_name: 'Antibiotics', quantity_sold: 10, revenue: 1000, profit: 250 }]);
        const paymentSpy = jest
            .spyOn((controller as any).reportingService, 'getPaymentMethodSummary')
            .mockResolvedValue([{ payment_method: 'cash', total_amount: 1000, transaction_count: 8, percentage: 100 }]);
        const expirySpy = jest
            .spyOn((controller as any).reportingService, 'getExpiryRiskBuckets')
            .mockResolvedValue({
                under_30_days: { count: 1, value: 5000 },
                under_60_days: { count: 2, value: 7000 },
                under_90_days: { count: 3, value: 10000 },
            });
        const trendSpy = jest
            .spyOn((controller as any).reportingService, 'getSalesTrends')
            .mockResolvedValue([{ date: '2026-03-08', sales: 1000 }]);

        await controller.getDashboardSummary(req as Request, res as Response);

        expect(kpiSpy).toHaveBeenCalledTimes(2);
        expect(topSpy).toHaveBeenCalledWith(undefined, expect.any(String), expect.any(String), 11);
        expect(categorySpy).toHaveBeenCalledWith(undefined, expect.any(String), expect.any(String), 11);
        expect(paymentSpy).toHaveBeenCalledWith(undefined, expect.any(String), expect.any(String), 11);
        expect(expirySpy).toHaveBeenCalledWith(undefined, 11);
        expect(trendSpy).toHaveBeenCalledWith(undefined, expect.any(String), expect.any(String), 11);
        expect(res.status).toHaveBeenCalledWith(200);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.data.top_medicines).toEqual([
            { medicine_id: 1, medicine_name: 'Amox', revenue: 1000, quantity: 10, profit: 250 },
        ]);
        expect(payload.data.categories).toEqual([
            { category_id: 1, category_name: 'Antibiotics', quantity_sold: 10, revenue: 1000, profit: 250 },
        ]);
        expect(payload.data.payments).toEqual([
            { payment_method: 'cash', total_amount: 1000, transaction_count: 8, percentage: 100 },
        ]);
        expect(payload.data.sales_trend).toEqual([{ date: '2026-03-08', sales: 1000 }]);
        expect(payload.data.expiry_risk).toEqual({
            under_30_days: { count: 1, value: 5000 },
            under_60_days: { count: 2, value: 7000 },
            under_90_days: { count: 3, value: 10000 },
        });
    });
});
