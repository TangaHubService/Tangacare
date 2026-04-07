import { Request } from 'express';

export function resolveFacilityId(req: Request): number | undefined {
    const user = (req as any).user;
    const authReq = req as any;
    const scope = authReq.scope;
    const role = String(user?.role || '').toLowerCase();
    const isHighLevel = role === 'super_admin' || role === 'owner' || role === 'admin';

    const parseId = (val: any): number | undefined => {
        if (val === undefined || val === null || val === 'undefined' || val === 'null' || val === '') {
            return undefined;
        }
        const parsed = Number(val);
        return isNaN(parsed) ? undefined : parsed;
    };

    // 1. Canonical resolved scope (set by scopeMiddleware)
    let id = parseId(scope?.facilityId);
    if (id) return id;

    // 2. Scoped Facility ID (set by requireFacilityScope)
    id = parseId(authReq.scopedFacilityId);
    if (id) return id;

    // 3. Fixed-role users are locked to their assigned facility.
    if (!isHighLevel) {
        id = parseId(user?.facilityId);
        if (id) return id;
        id = parseId(user?.facility_id);
        if (id) return id;
        return undefined;
    }

    // 4. High-level roles may explicitly select a facility.
    id = parseId(req.params?.facilityId);
    if (id) return id;
    id = parseId(authReq.params?.facility_id);
    if (id) return id;
    id = parseId(req.headers?.['x-tenant-id']);
    if (id) return id;
    id = parseId(req.headers?.['x-facility-id']);
    if (id) return id;

    // 5. Query Parameters
    id = parseId(req.query?.facilityId);
    if (id) return id;
    id = parseId(req.query?.facility_id);
    if (id) return id;

    // 6. Body Parameters
    id = parseId(req.body?.facilityId);
    if (id) return id;
    id = parseId(req.body?.facility_id);
    if (id) return id;

    return undefined;
}

/**
 * Resolve organizationId from request.
 * Strictly derives from authenticated user context.
 */
export function resolveOrganizationId(req: Request): number | undefined {
    const user = (req as any).user;
    const scope = (req as any).scope;

    const parseId = (val: any): number | undefined => {
        if (val === undefined || val === null || val === 'undefined' || val === 'null' || val === '') {
            return undefined;
        }
        const parsed = Number(val);
        return isNaN(parsed) ? undefined : parsed;
    };

    // 1. Canonical resolved scope
    let id = parseId(scope?.organizationId);
    if (id) return id;

    // 2. Explicit in authenticated user session
    id = parseId(user?.organizationId || user?.organization_id);
    if (id) return id;

    return undefined;
}
