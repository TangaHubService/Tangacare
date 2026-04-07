import { Response } from 'express';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { UserRole } from '../../entities/User.entity';
import { ResponseUtil } from '../../utils/response.util';

jest.mock('../../utils/response.util', () => ({
    ResponseUtil: {
        unauthorized: jest.fn(),
        forbidden: jest.fn(),
    },
}));

describe('requireFacilityScope', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let nextFn: jest.Mock;

    beforeEach(() => {
        nextFn = jest.fn();
        mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        mockReq = {
            user: {
                userId: 1,
                email: 'test@test.com',
                role: UserRole.FACILITY_ADMIN,
                facilityId: 10,
            },
        };
    });

    it('when FACILITY_ADMIN has facilityId should set scopedFacilityId and call next', () => {
        requireFacilityScope(mockReq as AuthRequest, mockRes as Response, nextFn);
        expect(mockReq.scopedFacilityId).toBe(10);
        expect(nextFn).toHaveBeenCalled();
        expect(ResponseUtil.forbidden).not.toHaveBeenCalled();
    });

    it('when FACILITY_ADMIN has no facilityId should return 403 and not call next', () => {
        mockReq.user!.facilityId = undefined;
        requireFacilityScope(mockReq as AuthRequest, mockRes as Response, nextFn);
        expect(ResponseUtil.forbidden).toHaveBeenCalledWith(mockRes, 'Facility context required');
        expect(nextFn).not.toHaveBeenCalled();
    });

    it('when role is not FACILITY_ADMIN should set scopedFacilityId from user and call next', () => {
        mockReq.user!.role = UserRole.STORE_MANAGER;
        mockReq.user!.facilityId = 5;
        requireFacilityScope(mockReq as AuthRequest, mockRes as Response, nextFn);
        expect(mockReq.scopedFacilityId).toBe(5);
        expect(nextFn).toHaveBeenCalled();
    });
});
