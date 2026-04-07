import { Request, Response } from 'express';
import { CategoryService } from '../../services/pharmacy/category.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveOrganizationId } from '../../utils/request.util';

export class CategoryController {
    private categoryService: CategoryService;

    constructor() {
        this.categoryService = new CategoryService();
    }

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const data = await this.categoryService.findAll(organizationId);
            ResponseUtil.success(res, data, 'Categories retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to list categories', error.message);
        }
    };

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const body: any = { ...(req.body || {}) };
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const category = await this.categoryService.create(body, organizationId);
            ResponseUtil.created(res, category, 'Category created successfully');
        } catch (error: any) {
            if (error.statusCode) ResponseUtil.error(res, error.message, error.statusCode);
            else ResponseUtil.internalError(res, 'Failed to create category', error.message);
        }
    };

    getOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id, 10);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const category = await this.categoryService.findOne(id, organizationId);
            ResponseUtil.success(res, category, 'Category retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) ResponseUtil.error(res, error.message, error.statusCode);
            else ResponseUtil.internalError(res, 'Failed to get category', error.message);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id, 10);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const category = await this.categoryService.update(id, req.body, organizationId);
            ResponseUtil.success(res, category, 'Category updated successfully');
        } catch (error: any) {
            if (error.statusCode) ResponseUtil.error(res, error.message, error.statusCode);
            else ResponseUtil.internalError(res, 'Failed to update category', error.message);
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id, 10);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            await this.categoryService.delete(id, organizationId);
            ResponseUtil.success(res, null, 'Category deleted successfully');
        } catch (error: any) {
            if (error.statusCode) ResponseUtil.error(res, error.message, error.statusCode);
            else ResponseUtil.internalError(res, 'Failed to delete category', error.message);
        }
    };
}
