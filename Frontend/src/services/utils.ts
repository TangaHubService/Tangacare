import type { PaginatedResponse } from '../types/pharmacy';

export const normalizePaginatedResponse = <T>(body: any): PaginatedResponse<T> => {
    const result: PaginatedResponse<T> = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
    };

    if (!body) return result;

    if (Array.isArray(body.data) && body.meta) {
        return body as PaginatedResponse<T>;
    }

    let payload = body.success && body.data ? body.data : body;

    if (Array.isArray(payload.data)) {
        result.data = payload.data;
    } else if (Array.isArray(payload)) {
        result.data = payload;
    }

    result.meta.total = typeof payload.total === 'number' ? payload.total : result.data.length;
    result.meta.page = typeof payload.page === 'number' ? payload.page : 1;
    result.meta.limit = typeof payload.limit === 'number' ? payload.limit : 10;
    result.meta.totalPages =
        typeof payload.totalPages === 'number'
            ? payload.totalPages
            : Math.ceil(result.meta.total / result.meta.limit) || 1;
    if (typeof payload.totalValue === 'number') {
        result.meta.totalValue = payload.totalValue;
    }

    return result;
};
