import { Response, NextFunction } from 'express';
import { AuthRequest, ScopeLevel } from './auth.middleware';
import { ResponseUtil } from '../utils/response.util';
import { logger } from './logger.middleware';
import { UserRole } from '../entities/User.entity';
import { AppDataSource } from '../config/database';
import { Facility } from '../entities/Facility.entity';

/**
 * Canonical middleware to resolve and freeze the data scope of a request.
 * Must be applied after authenticate middleware.
 */
export const scopeMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
        ResponseUtil.unauthorized(res, 'Authentication required for scope resolution');
        return;
    }

    const { role } = user;
    const headerFacId = req.headers['x-facility-id'] || req.headers['x-tenant-id'];
    const paramFacId = req.params.facilityId || req.params.facility_id;
    const queryFacId = req.query.facilityId || req.query.facility_id;
    const bodyFacId = req.body.facilityId || req.body.facility_id;

    const parseId = (val: any): number | undefined => {
        if (val === undefined || val === null || val === 'undefined' || val === 'null' || val === '') return undefined;
        const parsed = Number(val);
        return isNaN(parsed) ? undefined : parsed;
    };

    const isHighLevel = role === UserRole.SUPER_ADMIN || role === UserRole.OWNER;
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;

    // 1. Resolve Organization ID
    const organizationId: number | undefined = user.organizationId;

    // 2. Resolve Facility ID (Priority: Header > Query > Body > User Default)
    let facilityId: number | undefined =
        parseId(headerFacId) || parseId(paramFacId) || parseId(queryFacId) || parseId(bodyFacId);

    // 3. Apply Role-Based Default/Restriction Logic
    if (isHighLevel) {
        // High level roles can explicitly select a facility or remain at org-level (null)
        // If they didn't select one, facilityId remains undefined (Org Scope)
    } else {
        // Staff/FacilityAdmin are locked to their assigned facility
        // They cannot override via headers/query (Safety Enforcement)
        facilityId = user.facilityId;
    }

    // SECURITY: Platform SUPER_ADMIN must select an organization context via approved flows (e.g. impersonation).
    // Never allow SUPER_ADMIN to operate in GLOBAL scope on normal business endpoints.
    if (isSuperAdmin && !organizationId) {
        ResponseUtil.badRequest(
            res,
            'Organization context required for Super Admin. Use approved admin flows to select a target organization.',
        );
        return;
    }

    // SECURITY: Cross-tenant validation
    // If both are provided, ensure the facility belongs to the organization
    if (facilityId && organizationId) {
        try {
            const facilityRepo = AppDataSource.getRepository(Facility);
            const facility = await facilityRepo.findOne({
                where: { id: facilityId },
                select: ['id', 'organization_id'],
            });

            if (!facility || facility.organization_id !== organizationId) {
                ResponseUtil.forbidden(res, `Facility ${facilityId} does not belong to Organization ${organizationId}`);
                return;
            }
        } catch (error) {
            logger.error('[ScopeValidation] Database error during facility validation', error);
            ResponseUtil.error(res, 'Internal server error during scope resolution');
            return;
        }
    }

    // 4. Determine Scope Level
    let level: ScopeLevel = ScopeLevel.ORGANIZATION;

    if (facilityId) {
        level = ScopeLevel.FACILITY;
    } else if (organizationId) {
        level = ScopeLevel.ORGANIZATION;
    } else {
        // Fallback for users with no org/facility (e.g. fresh USER role)
        level = ScopeLevel.GLOBAL;
    }


    // 5. Finalize and Freeze Scope
    req.scope = {
        level,
        role,
        organizationId,
        facilityId,
    };


    logger.debug(
        `[ScopeResolved] User:${user.userId} Role:${role} -> Level:${level} Org:${organizationId ?? 'N/A'} Fac:${facilityId ?? 'N/A'}`,
    );

    // Maintain legacy fields for compatibility during migration
    if (req.user) {
        req.user.organizationId = organizationId;
        req.user.facilityId = facilityId;
    }

    next();
};
