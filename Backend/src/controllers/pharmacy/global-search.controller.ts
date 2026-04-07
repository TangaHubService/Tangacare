import { Request, Response } from 'express';
import { PharmacyGlobalSearchService } from '../../services/pharmacy/pharmacy-global-search.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

export class GlobalSearchController {
    private readonly searchService = new PharmacyGlobalSearchService();

    search = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context is required');
                return;
            }

            const facilityId = resolveFacilityId(req) ?? undefined;
            const q = String(req.query.q ?? '').trim();
            const limitRaw = parseInt(String(req.query.limit ?? '5'), 10);
            const limitPerGroup = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 5;

            if (q.length < 2) {
                ResponseUtil.success(
                    res,
                    {
                        medicines: [],
                        batches: [],
                        suppliers: [],
                        purchaseOrders: [],
                        stockMovements: [],
                    },
                    'Query too short',
                );
                return;
            }

            const data = await this.searchService.search({
                organizationId,
                facilityId,
                q,
                limitPerGroup,
            });

            ResponseUtil.success(res, data, 'Search results');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Global search failed', error?.message);
        }
    };
}
