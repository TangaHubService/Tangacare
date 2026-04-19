import { Request, Response } from 'express';
import { StockService } from '../../services/pharmacy/stock.service';
import { ResponseUtil } from '../../utils/response.util';
import { StockAdjustmentDto, StockQueryDto, ReleaseStockQcDto } from '../../dto/pharmacy.dto';
import { AuditService } from '../../services/pharmacy/audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { StockMovementType } from '../../entities/StockMovement.entity';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import { StockTransferService } from '../../services/pharmacy/stock-transfer.service';
import { CreateStockTransferDto } from '../../dto/pharmacy.dto';

export class StockController {
    private stockService: StockService;
    private auditService: AuditService;
    private stockTransferService: StockTransferService;

    constructor() {
        this.stockService = new StockService();
        this.auditService = new AuditService();
        this.stockTransferService = new StockTransferService();
    }

    getStock = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const query: StockQueryDto = {
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 10,
                organization_id: organizationId,
                facility_id: facilityId,
                department_id: req.query.department_id ? parseInt(req.query.department_id as string) : undefined,
                medicine_id: req.query.medicine_id ? parseInt(req.query.medicine_id as string) : undefined,
                search: req.query.search as string,
                low_stock_only: req.query.low_stock_only === 'true',
            };
            const result = await this.stockService.getStock(query);
            ResponseUtil.success(res, result, 'Stock retrieved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to retrieve stock', error.message);
        }
    };

    adjustStock = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const dto = req.body as StockAdjustmentDto;

            const facilityId = resolveFacilityId(req);
            const userId = user?.userId;
            const organizationId = user?.organizationId;

            if (!facilityId || !userId || !organizationId) {
                ResponseUtil.forbidden(res, 'Missing authentication or facility context.');
                return;
            }

            const departmentId = dto.department_id ?? null;

            const stock = await this.stockService.findStockByBatch(facilityId, organizationId, dto.batch_id, departmentId);
            if (!stock) {
                ResponseUtil.notFound(res, 'Stock not found for this batch');
                return;
            }

            const delta = dto.type === 'increase' || dto.type === 'return' ? dto.quantity : -dto.quantity;
            const newQty = stock.quantity + delta;
            if (newQty < 0) {
                ResponseUtil.badRequest(res, 'Adjustment would make stock negative');
                return;
            }

            const updated = await this.stockService.adjustStock(stock.id, organizationId, newQty, {
                type: dto.type === 'return' ? StockMovementType.RETURN : StockMovementType.ADJUSTMENT,
                reason: dto.reason,
                notes: dto.notes || `Stock adjustment: ${dto.type}`,
                user_id: userId,
                reference_type: 'STOCK_ADJUSTMENT',
                reference_id: dto.batch_id,
            });

            await this.auditService.log({
                facility_id: facilityId,
                user_id: userId,
                action: AuditAction.ADJUSTMENT,
                entity_type: AuditEntityType.STOCK,
                entity_id: updated.id,
                entity_name: `Stock ${updated.id}`,
                description: `Stock adjustment (${dto.type}): batch ${dto.batch_id}, qty ${dto.quantity}. Reason: ${dto.reason}`,
                old_values: { quantity: stock.quantity },
                new_values: { quantity: updated.quantity, type: dto.type, reason: dto.reason },
            });

            ResponseUtil.success(res, updated, 'Stock adjusted successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to adjust stock', error.message);
        }
    };

    transferBetweenLocations = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const userId = user?.userId;

            if (!facilityId || !userId) {
                ResponseUtil.forbidden(res, 'Authentication/Facility context missing');
                return;
            }

            const { source_stock_id, target_location_id, quantity, notes } = req.body;

            await this.stockService.transferStockBetweenLocations(
                facilityId,
                source_stock_id,
                target_location_id,
                quantity,
                userId,
                notes,
            );

            ResponseUtil.success(res, null, 'Stock transferred successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to transfer stock', error.message);
        }
    };

    transferStockCompat = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const userId = user?.userId;
            const body = req.body || {};

            if (!facilityId || !userId) {
                ResponseUtil.forbidden(res, 'Authentication/Facility context missing');
                return;
            }

            const quantity = Number(body.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                ResponseUtil.badRequest(res, 'quantity must be a positive number');
                return;
            }

            // Shape A (existing canonical location transfer)
            if (body.source_stock_id !== undefined && body.source_stock_id !== null) {
                const sourceStockId = Number(body.source_stock_id);
                const targetLocationId = Number(body.target_location_id);

                if (!Number.isFinite(sourceStockId) || sourceStockId <= 0) {
                    ResponseUtil.badRequest(res, 'source_stock_id must be a valid positive number');
                    return;
                }

                if (!Number.isFinite(targetLocationId) || targetLocationId <= 0) {
                    ResponseUtil.badRequest(res, 'target_location_id must be a valid positive number');
                    return;
                }

                await this.stockService.transferStockBetweenLocations(
                    facilityId,
                    sourceStockId,
                    targetLocationId,
                    quantity,
                    userId,
                    body.notes,
                );

                ResponseUtil.success(res, null, 'Stock transferred successfully');
                return;
            }

            // Shape B (legacy UI department/location transfer payload)
            const medicineId = Number(body.medicine_id);
            const batchId = Number(body.batch_id);
            const targetDepartmentId = body.target_department_id;

            if (!Number.isFinite(medicineId) || medicineId <= 0 || !Number.isFinite(batchId) || batchId <= 0) {
                ResponseUtil.badRequest(
                    res,
                    'Invalid transfer payload. Use either {source_stock_id, target_location_id, quantity} or legacy {medicine_id, batch_id, ...}',
                );
                return;
            }

            if (targetDepartmentId === undefined || targetDepartmentId === null || targetDepartmentId === '') {
                ResponseUtil.badRequest(res, 'target_department_id is required for legacy transfer payload');
                return;
            }

            const sourceDepartmentId =
                body.source_department_id === undefined ||
                    body.source_department_id === null ||
                    body.source_department_id === ''
                    ? null
                    : Number(body.source_department_id);
            const parsedTargetDepartmentId = Number(targetDepartmentId);

            if (!Number.isFinite(parsedTargetDepartmentId) || parsedTargetDepartmentId <= 0) {
                ResponseUtil.badRequest(res, 'target_department_id must be a valid positive number');
                return;
            }

            const sourceLocationId =
                body.source_location_id === undefined ||
                    body.source_location_id === null ||
                    body.source_location_id === ''
                    ? undefined
                    : Number(body.source_location_id);
            const targetLocationId =
                body.target_location_id === undefined ||
                    body.target_location_id === null ||
                    body.target_location_id === ''
                    ? undefined
                    : Number(body.target_location_id);

            const isCrossDepartment = sourceDepartmentId === null || sourceDepartmentId !== parsedTargetDepartmentId;

            if (isCrossDepartment) {
                const createTransferDto: CreateStockTransferDto = {
                    facility_id: facilityId,
                    from_department_id: sourceDepartmentId ?? undefined,
                    to_department_id: parsedTargetDepartmentId,
                    from_location_id: sourceLocationId,
                    to_location_id: targetLocationId,
                    items: [
                        {
                            medicine_id: medicineId,
                            batch_id: batchId,
                            quantity,
                        },
                    ],
                    notes: body.notes,
                };

                const organizationId = user?.organizationId;
                const createdTransfer = await this.stockTransferService.create(createTransferDto, userId);
                const completedTransfer = await this.stockTransferService.completeTransfer(
                    createdTransfer.id,
                    userId,
                    organizationId,
                    facilityId,
                );

                ResponseUtil.success(res, completedTransfer, 'Stock transfer created and completed successfully');
                return;
            }

            if (!targetLocationId || !Number.isFinite(targetLocationId) || targetLocationId <= 0) {
                ResponseUtil.badRequest(res, 'target_location_id is required for same-department location transfer');
                return;
            }

            const sourceStock = await this.stockService.findSourceStockForTransfer(
                facilityId,
                medicineId,
                batchId,
                sourceDepartmentId,
                sourceLocationId ?? null,
            );

            if (!sourceStock) {
                ResponseUtil.notFound(
                    res,
                    'Source stock not found for the provided medicine, batch, department, and location',
                );
                return;
            }

            await this.stockService.transferStockBetweenLocations(
                facilityId,
                sourceStock.id,
                targetLocationId,
                quantity,
                userId,
                body.notes,
            );

            ResponseUtil.success(res, null, 'Stock transferred successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to transfer stock', error.message);
        }
    };

    addBatches = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const userId = user?.userId;

            if (!facilityId) {
                ResponseUtil.forbidden(res, 'Facility context missing');
                return;
            }

            const { medicine_id, batches, storage_location_id } = req.body;

            if (!medicine_id || !batches || !Array.isArray(batches)) {
                ResponseUtil.badRequest(res, 'Invalid request data. medicine_id and batches array are required.');
                return;
            }

            const result = await this.stockService.addBatches(
                facilityId,
                user?.organizationId,
                medicine_id,
                batches,
                storage_location_id,
                userId,
            );

            ResponseUtil.success(res, result, 'Stock batches added successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to add stock batches', error.message);
        }
    };

    downloadTemplate = async (_req: Request, res: Response): Promise<void> => {
        try {
            const buffer = await this.stockService.downloadTemplate();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="stock_template.xlsx"');
            res.send(buffer);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to download stock template', error.message);
        }
    };

    importStock = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const userId = user?.userId;

            if (!facilityId) {
                ResponseUtil.forbidden(res, 'Facility context missing');
                return;
            }

            if (!req.file) {
                ResponseUtil.badRequest(res, 'No file uploaded');
                return;
            }

            const result = await this.stockService.importBatchesFromExcel(req.file.buffer, facilityId, user?.organizationId, userId);
            ResponseUtil.success(res, result, 'Stock imported successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to import stock', error.message);
        }
    };

    releaseStockFromQc = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const organizationId = user?.organizationId;
            const userId = user?.userId;
            if (!facilityId || !organizationId || !userId) {
                ResponseUtil.forbidden(res, 'Missing authentication or facility context.');
                return;
            }
            const dto = req.body as ReleaseStockQcDto;
            const stock = await this.stockService.releaseStockFromQc(dto.stock_id, facilityId, organizationId, userId);
            await this.auditService.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.STOCK,
                entity_id: stock.id,
                entity_name: `Stock #${stock.id}`,
                description: `Stock row ${stock.id} released from pending QC to saleable`,
            });
            ResponseUtil.success(res, stock, 'Stock released from QC');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to release stock from QC', error.message);
        }
    };
}
