import { SelectQueryBuilder } from 'typeorm';
import { RequestScope, ScopeLevel } from '../middleware/auth.middleware';

/**
 * Applies organization or facility scoping to a TypeORM SelectQueryBuilder.
 * 
 * @param queryBuilder The QueryBuilder to apply scoping to.
 * @param scope The resolved scope from req.scope.
 * @param options Configuration for the scoping logic.
 */
export function applyScope(
    queryBuilder: SelectQueryBuilder<any>,
    scope: RequestScope | undefined,
    options: {
        alias?: string;
        facilityField?: string;
        orgField?: string;
        useFacilityJoin?: boolean;
        allowOrgFallback?: boolean;
        allowGlobal?: boolean;
    } = {}
) {
    if (!scope) return queryBuilder;

    const alias = options.alias || queryBuilder.alias;
    const facilityField = options.facilityField || 'facility_id';
    const orgField = options.orgField || 'organization_id';

    // 1. GLOBAL Scope: Block by default (prevents accidental cross-tenant leaks).
    if (scope.level === ScopeLevel.GLOBAL) {
        if (!options.allowGlobal) queryBuilder.andWhere('1=0');
        return queryBuilder;
    }

    // 2. FACILITY Scope: Strict filter (with optional Org fallback)
    if (scope.level === ScopeLevel.FACILITY) {
        if (scope.facilityId) {
            if (options.allowOrgFallback && scope.organizationId) {
                // Return items specifically for this facility OR shared items for this organization
                queryBuilder.andWhere(`(${alias}.${facilityField} = :scopeFacilityId OR ${alias}.${facilityField} IS NULL AND ${alias}.${orgField} = :scopeOrgId)`, {
                    scopeFacilityId: scope.facilityId,
                    scopeOrgId: scope.organizationId
                });
            } else {
                queryBuilder.andWhere(`${alias}.${facilityField} = :scopeFacilityId`, {
                    scopeFacilityId: scope.facilityId
                });
            }
        } else {
            // Safety: Level says FACILITY but no ID present -> Block
            queryBuilder.andWhere('1=0');
        }
    }
    // 3. ORGANIZATION Scope: Aggregated filter
    else if (scope.level === ScopeLevel.ORGANIZATION) {
        if (scope.organizationId) {
            if (options.orgField) {
                // Direct link to organization
                queryBuilder.andWhere(`${alias}.${options.orgField} = :scopeOrgId`, {
                    scopeOrgId: scope.organizationId
                });
            } else {
                // Link via facility join (default)
                const joinAlias = `scoped_${alias}_facility`;
                queryBuilder.innerJoin(`${alias}.facility`, joinAlias)
                    .andWhere(`${joinAlias}.organization_id = :scopeOrgId`, {
                        scopeOrgId: scope.organizationId
                    });
            }
        } else {
            // Safety: Level says ORGANIZATION but no ID present -> Block
            queryBuilder.andWhere('1=0');
        }
    }


    return queryBuilder;
}
