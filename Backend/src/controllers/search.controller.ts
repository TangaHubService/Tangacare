import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { ResponseUtil } from '../utils/response.util';

export class SearchController {
    private searchService: SearchService;

    constructor() {
        this.searchService = new SearchService();
    }

    search = async (req: Request, res: Response): Promise<void> => {
        try {
            const query = req.query.q as string;

            if (!query) {
                ResponseUtil.error(res, 'Search query is required', 400);
                return;
            }

            const results = await this.searchService.searchAll(query);
            ResponseUtil.success(res, results, 'Search completed successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Search failed', error.message);
        }
    };
}
