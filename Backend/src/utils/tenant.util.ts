import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { AppError } from '../middleware/error.middleware';

export const MISSING_ORGANIZATION_CONTEXT_MESSAGE = 'Organization context missing';
export const CROSS_TENANT_ACCESS_MESSAGE = 'Resource not found or access denied';
export const LEGACY_MANUAL_REVIEW_MESSAGE =
    'Legacy tenant ownership is ambiguous and requires manual review';

export function requireOrganizationId(organizationId?: number | null): number {
    if (!organizationId || !Number.isInteger(organizationId) || organizationId <= 0) {
        throw new AppError(MISSING_ORGANIZATION_CONTEXT_MESSAGE, 400);
    }

    return organizationId;
}

export function buildOrganizationWhere<T extends { organization_id?: number | null }>(
    organizationId: number,
    extra: FindOptionsWhere<T> = {},
): FindOptionsWhere<T> {
    return {
        ...(extra as object),
        organization_id: organizationId,
    } as FindOptionsWhere<T>;
}

export function assertEntityBelongsToOrganization(
    entity: { organization_id?: number | null } | null | undefined,
    organizationId: number,
    message: string = CROSS_TENANT_ACCESS_MESSAGE,
): void {
    if (!entity || entity.organization_id !== organizationId) {
        throw new AppError(message, 404);
    }
}

export async function scopedFindOneOrFail<T extends { organization_id?: number | null }>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
    organizationId: number,
    options: {
        relations?: string[];
        message?: string;
    } = {},
): Promise<T> {
    const entity = await repository.findOne({
        where: buildOrganizationWhere<T>(organizationId, where),
        relations: options.relations,
    });

    if (!entity) {
        throw new AppError(options.message || CROSS_TENANT_ACCESS_MESSAGE, 404);
    }

    return entity;
}

export function normalizeScopedText(value?: string | null): string | undefined {
    const normalized = value
        ?.normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ');

    return normalized ? normalized : undefined;
}

export function normalizeMedicineName(name: string): string {
    const normalized = normalizeScopedText(name);
    if (!normalized) {
        throw new AppError('Medicine name is required', 400);
    }

    return normalized.toLowerCase();
}

export function toNullOrganizationWhere<T extends { organization_id?: number | null }>(
    extra: FindOptionsWhere<T> = {},
): FindOptionsWhere<T> {
    return {
        ...(extra as object),
        organization_id: IsNull(),
    } as FindOptionsWhere<T>;
}
