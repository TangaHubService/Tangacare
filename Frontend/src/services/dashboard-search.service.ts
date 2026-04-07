import api from '../lib/api';
import type { GlobalSearchResultItem, GlobalSearchResults } from '../types/pharmacy';

function stripExtraFields(groups: GlobalSearchResults): GlobalSearchResults {
    const pick = (items: GlobalSearchResultItem[]) =>
        items.map(({ id, label, meta, to }) => ({ id, label, meta, to }));

    return {
        medicines: pick(groups.medicines || []),
        batches: pick(groups.batches || []),
        suppliers: pick(groups.suppliers || []),
        purchaseOrders: pick(groups.purchaseOrders || []),
        stockMovements: pick(groups.stockMovements || []),
    };
}

export const dashboardSearchService = {
    async globalSearch(params: { q: string; limit?: number }): Promise<GlobalSearchResults> {
        const response = await api.get<{ data: GlobalSearchResults }>('/pharmacy/search', {
            params: { q: params.q, limit: params.limit ?? 5 },
        });
        const body = response.data as { data?: GlobalSearchResults } & GlobalSearchResults;
        const raw = (body && 'data' in body && body.data ? body.data : body) as GlobalSearchResults;
        return stripExtraFields(raw);
    },
};
