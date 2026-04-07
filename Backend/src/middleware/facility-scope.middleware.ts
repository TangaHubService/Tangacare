import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ResponseUtil } from '../utils/response.util';
import { UserRole } from '../entities/User.entity';

export const requireFacilityScope = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
        ResponseUtil.unauthorized(res, 'Authentication required');
        return;
    }

    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.OWNER) {
        // High level roles should not have their scope 'locked' to their home branch.
        // We set it to undefined to allow controllers to resolve the requested branch dynamically.
        req.scopedFacilityId = undefined;
        next();
        return;
    }

    if (user.role === UserRole.FACILITY_ADMIN) {
        const facilityId = user.facilityId;
        if (facilityId == null || facilityId === undefined) {
            ResponseUtil.forbidden(res, 'Facility context required');
            return;
        }
        req.scopedFacilityId = facilityId;
    } else {
        req.scopedFacilityId = user.facilityId ?? undefined;
    }

    next();
};
