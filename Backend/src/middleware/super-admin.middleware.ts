import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ResponseUtil } from '../utils/response.util';
import { UserRole } from '../entities/User.entity';

/**
 * Strictly require platform-level SUPER_ADMIN.
 * (Do not use `authorize(UserRole.SUPER_ADMIN)` since OWNER is allowed to bypass there.)
 */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
        ResponseUtil.unauthorized(res, 'Authentication required');
        return;
    }

    if (req.user.role !== UserRole.SUPER_ADMIN) {
        ResponseUtil.forbidden(res, 'Super Admin privileges required');
        return;
    }

    next();
};

