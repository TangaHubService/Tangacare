import { Request, Response } from 'express';
import { MedicineService } from '../../services/pharmacy/medicine.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateMedicineDto, UpdateMedicineDto } from '../../dto/pharmacy.dto';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

export class MedicineController {
    private medicineService: MedicineService;

    constructor() {
        this.medicineService = new MedicineService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.create(req.body as CreateMedicineDto, organizationId);
            ResponseUtil.created(res, result, 'Medicine created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create medicine', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string;
            const isActive =
                req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined;
            const startDate = req.query.start_date as string;
            const endDate = req.query.end_date as string;
            const sortBy = req.query.sort_by as string;
            const order = (req.query.order as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const minStock = req.query.min_stock ? parseInt(req.query.min_stock as string) : undefined;
            const category = req.query.category as string | undefined;

            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            const result = await this.medicineService.findAll(
                page,
                limit,
                search,
                isActive,
                startDate,
                endDate,
                facilityId,
                sortBy,
                order,
                minStock,
                category,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Medicines retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve medicines', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) { ResponseUtil.error(res, 'Invalid medicine ID', 400); return; }
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.findOne(id, organizationId);
            ResponseUtil.success(res, result, 'Medicine retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve medicine', error.message);
            }
        }
    };

    findByCode = async (req: Request, res: Response): Promise<void> => {
        try {
            const code = req.params.code;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.findByCode(code, organizationId);
            ResponseUtil.success(res, result, 'Medicine retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve medicine', error.message);
            }
        }
    };

    findByBarcode = async (req: Request, res: Response): Promise<void> => {
        try {
            const barcode = req.params.barcode;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.findByBarcode(barcode, organizationId);
            ResponseUtil.success(res, result, 'Medicine retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve medicine', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) { ResponseUtil.error(res, 'Invalid medicine ID', 400); return; }
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.update(id, req.body as UpdateMedicineDto, organizationId);
            ResponseUtil.success(res, result, 'Medicine updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update medicine', error.message);
            }
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) { ResponseUtil.error(res, 'Invalid medicine ID', 400); return; }
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            await this.medicineService.delete(id, organizationId);
            ResponseUtil.success(res, null, 'Medicine deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete medicine', error.message);
            }
        }
    };

    downloadTemplate = async (_req: Request, res: Response): Promise<void> => {
        try {
            const buffer = await this.medicineService.downloadTemplate();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="medicine_template.xlsx"');
            res.send(buffer);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to download template', error.message);
        }
    };

    importExcel = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.file) { ResponseUtil.error(res, 'No file uploaded', 400); return; }
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.importExcel(req.file.buffer, organizationId);
            ResponseUtil.success(res, result, 'Import completed');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to import medicines', error.message);
        }
    };

    validateImport = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.file) { ResponseUtil.error(res, 'No file uploaded', 400); return; }
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const result = await this.medicineService.validateImportExcel(req.file.buffer, organizationId);
            ResponseUtil.success(res, result, 'Validation complete');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to validate medicines', error.message);
        }
    };

    getStatistics = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req);
            const stats = await this.medicineService.getStatistics(organizationId);
            ResponseUtil.success(res, stats, 'Statistics fetched');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch medicine statistics', error.message);
        }
    };

    exportExcel = async (_req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(_req);
            if (!organizationId) { ResponseUtil.error(res, 'Organization context missing', 400); return; }
            const buffer = await this.medicineService.exportToExcel(organizationId);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="medicine_inventory.xlsx"');
            res.send(buffer);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to export inventory', error.message);
        }
    };
}
