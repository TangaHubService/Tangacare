import { Response } from 'express';
import { authorize, requirePermission } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { UserRole } from '../../entities/User.entity';
import { PERMISSIONS } from '../../config/permissions';
import { ResponseUtil } from '../../utils/response.util';

jest.mock('../../utils/response.util', () => ({
    ResponseUtil: {
        unauthorized: jest.fn(),
        forbidden: jest.fn(),
    },
}));

describe('auth.middleware', () => {
    let mockRes: Partial<Response>;
    let nextFn: jest.Mock;

    beforeEach(() => {
        nextFn = jest.fn();
        mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    describe('requirePermission', () => {
        it('allows cashier with DISPENSING_WRITE', () => {
            const req = {
                user: {
                    userId: 1,
                    email: 'c@x.com',
                    role: UserRole.CASHIER,
                    facilityId: 1,
                },
            } as AuthRequest;
            requirePermission(PERMISSIONS.DISPENSING_WRITE)(req, mockRes as Response, nextFn);
            expect(nextFn).toHaveBeenCalled();
            expect(ResponseUtil.forbidden).not.toHaveBeenCalled();
        });

        it('forbids store manager without DISPENSING_WRITE', () => {
            const req = {
                user: {
                    userId: 2,
                    email: 'm@x.com',
                    role: UserRole.STORE_MANAGER,
                    facilityId: 1,
                },
            } as AuthRequest;
            requirePermission(PERMISSIONS.DISPENSING_WRITE)(req, mockRes as Response, nextFn);
            expect(nextFn).not.toHaveBeenCalled();
            expect(ResponseUtil.forbidden).toHaveBeenCalled();
        });

        it('allows OWNER even when permission list is unrelated (owner bypass)', () => {
            const req = {
                user: {
                    userId: 3,
                    email: 'o@x.com',
                    role: UserRole.OWNER,
                    facilityId: 1,
                },
            } as AuthRequest;
            requirePermission(PERMISSIONS.DISPENSING_WRITE)(req, mockRes as Response, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });
    });

    describe('authorize', () => {
        it('allows OWNER when not listed in allowedRoles', () => {
            const req = {
                user: {
                    userId: 4,
                    email: 'o2@x.com',
                    role: UserRole.OWNER,
                    facilityId: 1,
                },
            } as AuthRequest;
            authorize(UserRole.PHARMACIST)(req, mockRes as Response, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });

        it('forbids technician when not listed', () => {
            const req = {
                user: {
                    userId: 5,
                    email: 't@x.com',
                    role: UserRole.TECHNICIAN,
                    facilityId: 1,
                },
            } as AuthRequest;
            authorize(UserRole.PHARMACIST)(req, mockRes as Response, nextFn);
            expect(nextFn).not.toHaveBeenCalled();
            expect(ResponseUtil.forbidden).toHaveBeenCalled();
        });
    });
});
