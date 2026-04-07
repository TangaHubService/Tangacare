import { Request, Response } from 'express';
import { DashboardController } from './dashboard.controller';
import { ReportingService } from '../../services/pharmacy/reporting.service';
import { ResponseUtil } from '../../utils/response.util';

// Mock dependencies
jest.mock('../../services/pharmacy/reporting.service');
jest.mock('../../services/pharmacy/dispensing.service');
jest.mock('../../services/pharmacy/facility.service');
jest.mock('../../services/pharmacy/alert.service');
jest.mock('../../utils/response.util');

describe('DashboardController', () => {
    let dashboardController: DashboardController;
    let mockReportingService: jest.Mocked<ReportingService>;

    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Initialize controller
        dashboardController = new DashboardController();

        // Get mocked instances
        // Note: In Jest with manual mocks or automatic mocks of classes,
        // obtaining the instance usually requires accessing the prototype or just casting if it's assigned in constructor.
        // However, since we mock the module, the constructor calls the mocked class.
        // We can access the mock via the module import.
        mockReportingService = (dashboardController as any).reportingService;

        // Setup Request and Response
        req = {
            query: {},
        } as any;
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn(),
        } as any;
    });

    describe('getInventoryStatus', () => {
        it('should return error if facilityId is missing', async () => {
            (req as any).user = { role: 'admin' }; // No facilityId

            await dashboardController.getInventoryStatus(req as Request, res as Response);

            expect(ResponseUtil.error).toHaveBeenCalledWith(res, 'Facility context required', 400);
        });

        it('should return inventory status data on success', async () => {
            (req as any).user = { facilityId: 1, organizationId: 7 };
            const mockData = {
                facility_id: 1,
                by_category: [{ category: 'Antibiotics', count: 10, value: 100 }],
                by_department: [{ department: 'Central', count: 10, value: 100 }],
            };
            (mockReportingService.getInventoryStatus as jest.Mock).mockResolvedValue(mockData);

            await dashboardController.getInventoryStatus(req as Request, res as Response);

            expect(mockReportingService.getInventoryStatus).toHaveBeenCalledWith(1, 7);
            expect(ResponseUtil.success).toHaveBeenCalledWith(res, mockData, 'Inventory status retrieved successfully');
        });

        it('should handle errors', async () => {
            (req as any).user = { facilityId: 1, organizationId: 7 };
            (mockReportingService.getInventoryStatus as jest.Mock).mockRejectedValue(new Error('Database error'));

            await dashboardController.getInventoryStatus(req as Request, res as Response);

            expect(ResponseUtil.internalError).toHaveBeenCalledWith(
                res,
                'Failed to fetch inventory status',
                'Database error',
            );
        });
    });

    describe('getConsumptionTrends', () => {
        it('should return consumption trends data on success', async () => {
            (req as any).user = { facilityId: 1, organizationId: 7 };
            req.query = { days: '7' };
            const mockData = {
                facility_id: 1,
                period: { start: '2023-01-01', end: '2023-01-08' },
                daily_trends: [],
            };
            (mockReportingService.getConsumptionTrends as jest.Mock).mockResolvedValue(mockData);

            await dashboardController.getConsumptionTrends(req as Request, res as Response);

            expect(mockReportingService.getConsumptionTrends).toHaveBeenCalledWith(
                1,
                expect.any(Date),
                expect.any(Date),
                7,
            );
            expect(ResponseUtil.success).toHaveBeenCalledWith(
                res,
                mockData,
                'Consumption trends retrieved successfully',
            );
        });
    });
});
