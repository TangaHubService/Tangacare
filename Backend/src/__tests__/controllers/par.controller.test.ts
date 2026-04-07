import { Request, Response } from 'express';
import { ParController } from '../../controllers/pharmacy/par.controller';

jest.mock('../../services/pharmacy/par.service');

describe('ParController', () => {
    let controller: ParController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new ParController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('upsertDepartmentLevels validates departmentId', async () => {
        req = {
            params: { departmentId: 'bad' },
            body: { levels: [] },
            user: { id: 1, role: 'facility_admin' },
            scopedFacilityId: 1,
        } as any;

        const spy = jest.spyOn((controller as any).parService, 'upsertParLevels');

        await controller.upsertDepartmentLevels(req as Request, res as Response);

        expect(spy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('upsertDepartmentLevels calls service for valid payload', async () => {
        req = {
            params: { departmentId: '3' },
            body: {
                levels: [{ medicine_id: 9, par_level: 20, min_level: 10, refill_to_level: 25 }],
            },
            user: { id: 7, role: 'facility_admin' },
            scopedFacilityId: 2,
        } as any;

        const spy = jest.spyOn((controller as any).parService, 'upsertParLevels').mockResolvedValue([]);

        await controller.upsertDepartmentLevels(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(
            2,
            3,
            [{ medicine_id: 9, par_level: 20, min_level: 10, refill_to_level: 25 }],
            7,
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('generateTasks calls service with optional department filter', async () => {
        req = {
            params: { facilityId: '2' },
            body: { department_id: 5 },
            user: { id: 12, role: 'store_manager' },
            scopedFacilityId: 2,
        } as any;

        const spy = jest.spyOn((controller as any).parService, 'generateReplenishmentTasks').mockResolvedValue({
            created: 0,
            updated: 0,
            tasks: [],
        });

        await controller.generateTasks(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith(2, 12, 5);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
