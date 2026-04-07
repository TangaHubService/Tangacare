import { Request, Response, NextFunction } from 'express';
import { JwtUtil } from '../utils/jwt.util';
import { ResponseUtil } from '../utils/response.util';
import { UserRole } from '../entities/User.entity';
import { Permission, hasPermission } from '../config/permissions';

export enum ScopeLevel {
    GLOBAL = 'GLOBAL',
    ORGANIZATION = 'ORGANIZATION',
    FACILITY = 'FACILITY',
}

export interface RequestScope {
    level: ScopeLevel;
    role: UserRole;
    organizationId?: number;
    facilityId?: number;
}


export interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
        role: UserRole;
        organizationId?: number;
        facilityId?: number;
    };
    scope?: RequestScope;
    scopedFacilityId?: number;
}


export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            ResponseUtil.unauthorized(res, 'No token provided');
            return;
        }

        const token = authHeader.substring(7);

        try {
            const decoded = JwtUtil.verifyAccessToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            ResponseUtil.unauthorized(res, 'Invalid or expired token');
            return;
        }
    } catch (error) {
        ResponseUtil.internalError(res, 'Authentication error');
        return;
    }
};

export const authorize = (...allowedRoles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            ResponseUtil.unauthorized(res, 'Authentication required');
            return;
        }

        if (req.user.role !== UserRole.OWNER && !allowedRoles.includes(req.user.role)) {
            ResponseUtil.forbidden(res, 'You do not have permission to access this resource');
            return;
        }

        next();
    };
};

export const requirePermission = (...requiredPermissions: Permission[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            ResponseUtil.unauthorized(res, 'Authentication required');
            return;
        }

        const isOwner = req.user!.role === UserRole.OWNER;
        const hasAny = requiredPermissions.some((p) => hasPermission(req.user!.role, p));

        if (!isOwner && !hasAny) {
            ResponseUtil.forbidden(res, 'You do not have permission to access this resource');
            return;
        }

        next();
    };
};
