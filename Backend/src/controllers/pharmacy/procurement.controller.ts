import { Request, Response } from 'express';
import { ProcurementService } from '../../services/pharmacy/procurement.service';
import { ReplenishmentService } from '../../services/pharmacy/replenishment.service';
import { ResponseUtil } from '../../utils/response.util';
import { AuthRequest } from '../../middleware/auth.middleware';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, ReceivePurchaseOrderDto } from '../../dto/pharmacy.dto';
import { ActivityActorType } from '../../entities/PurchaseOrderActivity.entity';

export class ProcurementController {
    private procurementService: ProcurementService;
    private replenishmentService: ReplenishmentService;

    constructor() {
        this.procurementService = new ProcurementService();
        this.replenishmentService = new ReplenishmentService();
    }

    create = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const user = req.user!;
            const createDto = req.body as CreatePurchaseOrderDto;
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req as any);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            if (facilityId) {
                createDto.facility_id = facilityId;
            }
            createDto.organization_id = organizationId;

            const result = await this.procurementService.create(createDto, user.userId);
            ResponseUtil.created(res, result, 'Purchase order created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create purchase order', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const facilityId = resolveFacilityId(req);
            const status = req.query.status as string;

            const result = await this.procurementService.findAll(
                organizationId,
                facilityId,
                status as any,
                page,
                limit,
            );
            ResponseUtil.success(res, result, 'Purchase orders retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve purchase orders', error.message);
        }
    };

    findGoodsReceipts = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const facilityId = resolveFacilityId(req);
            const result = await this.procurementService.findGoodsReceipts(organizationId, facilityId, page, limit);
            ResponseUtil.success(res, result, 'Goods receipts retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve goods receipts', error.message);
            }
        }
    };

    findGoodsReceiptById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.receiptId);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const facilityId = resolveFacilityId(req);
            const result = await this.procurementService.findGoodsReceiptById(id, organizationId, facilityId);
            ResponseUtil.success(res, result, 'Goods receipt retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve goods receipt', error.message);
            }
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const facilityId = resolveFacilityId(req);

            const result = await this.procurementService.findOne(id, organizationId, facilityId);
            ResponseUtil.success(res, result, 'Purchase order retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve purchase order', error.message);
            }
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const facilityId = resolveFacilityId(req);

            const result = await this.procurementService.update(
                id,
                req.body as UpdatePurchaseOrderDto,
                organizationId,
                facilityId,
            );
            ResponseUtil.success(res, result, 'Purchase order updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update purchase order', error.message);
            }
        }
    };

    receive = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const organizationId = user.organizationId;
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const facilityId = resolveFacilityId(req);

            // include selling_price field if provided from frontend
            const result = await this.procurementService.receiveOrder(
                id,
                req.body as ReceivePurchaseOrderDto,
                user.userId,
                organizationId,
                facilityId,
            );
            ResponseUtil.success(res, result, 'Purchase order received successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to receive purchase order', error.message);
            }
        }
    };

    downloadTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const organizationId = resolveOrganizationId(req as any);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }
            const buffer = await this.procurementService.generateTemplate(organizationId);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=PO_Template.xlsx');
            res.send(buffer);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to download template', error.message);
        }
    };

    importExcel = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                ResponseUtil.error(res, 'No file uploaded', 400);
                return;
            }

            const user = req.user!;
            const supplierId = parseInt(req.body.supplier_id);
            if (isNaN(supplierId)) {
                ResponseUtil.error(res, 'Invalid supplier_id', 400);
                return;
            }

            const result = await this.procurementService.importFromExcel(
                req.file.buffer,
                user.facilityId!,
                supplierId,
                resolveOrganizationId(req as any)!,
                user.userId,
            );

            ResponseUtil.created(res, result, 'Purchase order imported successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to import purchase order', error.message);
            }
        }
    };

    validateImport = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                ResponseUtil.error(res, 'No file uploaded', 400);
                return;
            }

            const user = req.user!;
            const result = await this.procurementService.validateImport(
                req.file.buffer,
                user.facilityId!,
                resolveOrganizationId(req as any)!,
            );

            ResponseUtil.success(res, result, 'Import validated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to validate import', error.message);
            }
        }
    };

    approve = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const result = await this.procurementService.approveOrder(id, user.organizationId!, user.userId);
            ResponseUtil.success(res, result, 'Purchase order approved');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to approve purchase order', error.message);
            }
        }
    };

    cancel = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const result = await this.procurementService.cancelOrder(id, user.organizationId!, user.userId);
            ResponseUtil.success(res, result, 'Purchase order cancelled');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to cancel purchase order', error.message);
            }
        }
    };

    submit = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const result = await this.procurementService.submitRequest(id, user.organizationId!, user.userId);
            ResponseUtil.success(res, result, 'Purchase request submitted to supplier');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to submit purchase order', error.message);
            }
        }
    };

    quote = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const { items } = req.body;
            
            // Note: In a real scenario, we'd distinguish if this is a supplier user or pharmacy user entering values
            const actorType = (user.role as string) === 'supplier' ? ActivityActorType.SUPPLIER : ActivityActorType.USER;

            const result = await this.procurementService.supplierQuote(
                id, 
                items, 
                user.organizationId!, 
                actorType,
                user.userId
            );
            ResponseUtil.success(res, result, 'Quotation prices updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update quotation', error.message);
            }
        }
    };

    review = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const { items } = req.body;

            const result = await this.procurementService.reviewQuotation(id, items, user.organizationId!, user.userId);
            ResponseUtil.success(res, result, 'Quotation review completed');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to review quotation', error.message);
            }
        }
    };

    getPriceSuggestions = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const supplierId = parseInt(req.query.supplier_id as string);
            const medicineId = parseInt(req.query.medicine_id as string);
            const user = req.user!;

            if (isNaN(supplierId) || isNaN(medicineId)) {
                ResponseUtil.badRequest(res, 'Supplier ID and Medicine ID are required');
                return;
            }

            const result = await this.procurementService.getPriceSuggestions(supplierId, medicineId, user.organizationId!);
            ResponseUtil.success(res, result, 'Price suggestions retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to get price suggestions', error.message);
        }
    };

    export = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user!;
            const buffer = await this.procurementService.exportOrderToExcel(id, user.organizationId!);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=PO_${id}.xlsx`);
            res.send(buffer);
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to export purchase order', error.message);
            }
        }
    };

    autoDraft = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const user = req.user!;
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            // 1. Get canonical replenishment suggestions
            const suggestions = await this.replenishmentService.getSuggestions(
                user.organizationId!,
                facilityId,
            );

            // 2. Create grouped draft POs by supplier
            const orders = await this.procurementService.createDraftPOsFromReorderSuggestions(
                facilityId,
                user.organizationId!,
                suggestions,
                user.userId,
            );

            if (!orders.length) {
                ResponseUtil.success(res, { count: 0 }, 'No high urgency items to reorder');
                return;
            }

            ResponseUtil.success(
                res,
                { count: orders.length, orders },
                'Draft purchase orders created successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to auto-generate draft POs', error.message);
        }
    };
}
