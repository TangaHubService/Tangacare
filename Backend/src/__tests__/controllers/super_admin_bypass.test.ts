import { Request, Response } from 'express';
import { FacilityController } from '../../controllers/pharmacy/facility.controller';
import { ProcurementController } from '../../controllers/pharmacy/procurement.controller';
import { StockController } from '../../controllers/pharmacy/stock.controller';

jest.mock('../../services/pharmacy/facility.service');
jest.mock('../../services/pharmacy/procurement.service');
jest.mock('../../services/pharmacy/stock.service');
jest.mock('../../services/pharmacy/reporting.service');
jest.mock('../../services/pharmacy/audit.service');

describe('Super Admin Bypass Verification', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        res = {
            status: jest.fn().mockReturnThis(),
            json: jsonMock,
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('FacilityController', () => {
        let controller: FacilityController;

        beforeEach(() => {
            controller = new FacilityController();
        });

        it('should allow SUPER_ADMIN to see all facilities without org/facility filter', async () => {
            req = {
                query: { page: '1', limit: '10' },
                headers: { 'x-organization-id': '41' },
                user: { role: 'super_admin', userId: 999 },
            } as any;

            const findSpy = jest.spyOn(controller['facilityService'], 'findAll').mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                limit: 10,
            });

            await controller.findAll(req as Request, res as Response);

            expect(findSpy).toHaveBeenCalledWith(1, 10, undefined, undefined, undefined, 41);
        });

        it('should restrict FACILITY_ADMIN to their facility', async () => {
            req = {
                query: { page: '1', limit: '10' },
                user: { role: 'facility_admin', userId: 5, facilityId: 100, organizationId: 41 },
            } as any;

            const findSpy = jest.spyOn(controller['facilityService'], 'findAll').mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                limit: 10,
            });

            await controller.findAll(req as Request, res as Response);

            expect(findSpy).toHaveBeenCalledWith(1, 10, undefined, 5, undefined, 41);
        });
    });

    describe('ProcurementController', () => {
        let controller: ProcurementController;

        beforeEach(() => {
            controller = new ProcurementController();
        });

        it('should pass user role to service for SUPER_ADMIN', async () => {
            req = {
                query: { page: '1' },
                user: { role: 'super_admin', userId: 999 },
            } as any;

            const findSpy = jest.spyOn(controller['procurementService'], 'findAll').mockResolvedValue({
                data: [],
                total: 0,
                totalValue: 0,
                page: 1,
                limit: 10,
            });

            await controller.findAll(req as Request, res as Response);

            expect(findSpy).toHaveBeenCalledWith(undefined, undefined, 'super_admin', undefined, 1, 10);
        });
    });

    describe('StockController', () => {
        let controller: StockController;

        beforeEach(() => {
            controller = new StockController();
        });

        it('should allow SUPER_ADMIN to query stocks without facility filter', async () => {
            req = {
                query: { page: '1' },
                user: { role: 'super_admin', userId: 999 },
            } as any;

            const getStockSpy = jest.spyOn(controller['stockService'], 'getStock').mockResolvedValue({} as any);

            await controller.getStock(req as Request, res as Response);

            expect(getStockSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    facility_id: undefined,
                }),
            );
        });
    });
});
