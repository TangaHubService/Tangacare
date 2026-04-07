import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import {
    VendorReturn,
    VendorReturnItem,
    VendorReturnStatus,
} from '../../entities/VendorReturn.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../../entities/PurchaseOrder.entity';
import { Stock } from '../../entities/Stock.entity';
import { Batch } from '../../entities/Batch.entity';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { StockMovementType, AdjustmentReason } from '../../entities/StockMovement.entity';
import { CreateVendorReturnDto, VendorReturnFiltersDto } from '../../dto/pharmacy.dto';
import { generateDocumentNumber } from '../../utils/document-number.util';

export class VendorReturnService {
    private vendorReturnRepository: Repository<VendorReturn>;
    private purchaseOrderRepository: Repository<PurchaseOrder>;
    private auditService: AuditService;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.vendorReturnRepository = source.getRepository(VendorReturn);
        this.purchaseOrderRepository = source.getRepository(PurchaseOrder);
        this.auditService = new AuditService(entityManager);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────────────────────────────────────
    async createVendorReturn(
        createDto: CreateVendorReturnDto,
        userId: number,
        facilityId: number,
        organizationId: number,
    ): Promise<VendorReturn> {
        // Validate linked PO exists and has been received (if provided)
        if (createDto.purchase_order_id) {
            const po = await this.purchaseOrderRepository.findOne({
                where: { id: createDto.purchase_order_id, facility_id: facilityId, organization_id: organizationId },
                relations: ['items'],
            });
            if (!po) {
                throw new AppError('Purchase order not found', 404);
            }
            if (
                po.status !== PurchaseOrderStatus.RECEIVED &&
                po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
            ) {
                throw new AppError(
                    'Cannot return items from a purchase order that has not been received',
                    400,
                );
            }
        }

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const returnNumber = generateDocumentNumber('VR');

            // Validate each item and compute totals
            let totalCreditAmount = 0;
            for (const item of createDto.items) {
                // Ensure the batch belongs to this facility
                const stock = await queryRunner.manager.findOne(Stock, {
                    where: {
                        facility_id: facilityId,
                        organization_id: organizationId,
                        medicine_id: item.medicine_id,
                        batch_id: item.batch_id,
                    },
                });
                if (!stock) {
                    throw new AppError(
                        `No stock record found for medicine ${item.medicine_id} / batch ${item.batch_id} in this facility`,
                        404,
                    );
                }
                if (stock.quantity < item.quantity_returned) {
                    throw new AppError(
                        `Insufficient stock for medicine ${item.medicine_id}. Available: ${stock.quantity}`,
                        400,
                    );
                }

                // Resolve unit_cost from batch if not provided
                if (!item.unit_cost) {
                    const batch = await queryRunner.manager.findOne(Batch, {
                        where: { id: item.batch_id, organization_id: organizationId },
                    });
                    item.unit_cost = Number(batch?.unit_cost ?? 0);
                }

                totalCreditAmount += item.unit_cost * item.quantity_returned;
            }

            // Create header
            const vendorReturn = queryRunner.manager.create(VendorReturn, {
                return_number: returnNumber,
                facility_id: facilityId,
                organization_id: organizationId,
                purchase_order_id: createDto.purchase_order_id ?? undefined,
                supplier_id: createDto.supplier_id,
                created_by_id: userId,
                status: VendorReturnStatus.PENDING,
                total_credit_amount: totalCreditAmount,
                reason: createDto.reason,
                notes: createDto.notes,
            });
            const savedReturn = await queryRunner.manager.save(vendorReturn);

            // Create line items
            for (const item of createDto.items) {
                const lineCredit = (item.unit_cost ?? 0) * item.quantity_returned;
                const returnItem = queryRunner.manager.create(VendorReturnItem, {
                    vendor_return_id: savedReturn.id,
                    organization_id: organizationId,
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    quantity_returned: item.quantity_returned,
                    unit_cost: item.unit_cost ?? 0,
                    line_credit_amount: lineCredit,
                    reason: item.reason,
                    notes: item.notes,
                });
                await queryRunner.manager.save(returnItem);
            }

            // Audit log inside transaction
            const txAudit = new AuditService(queryRunner.manager);
            await txAudit.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.CREATE,
                entity_type: AuditEntityType.VENDOR_RETURN,
                entity_id: savedReturn.id,
                entity_name: savedReturn.return_number,
                description: `Vendor return ${savedReturn.return_number} created — pending approval`,
            });

            await queryRunner.commitTransaction();

            return (await this.vendorReturnRepository.findOne({
                where: { id: savedReturn.id, organization_id: organizationId },
                relations: ['items', 'items.medicine', 'items.batch', 'supplier', 'purchase_order', 'created_by'],
            })) as VendorReturn;
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Approve — deducts stock and generates credit note number
    // ─────────────────────────────────────────────────────────────────────────
    async approveVendorReturn(returnId: number, organizationId: number, userId: number, facilityId: number): Promise<VendorReturn> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const vendorReturn = await queryRunner.manager.findOne(VendorReturn, {
                where: { id: returnId, facility_id: facilityId, organization_id: organizationId },
                relations: ['items'],
            });

            if (!vendorReturn) {
                throw new AppError('Vendor return not found', 404);
            }
            if (vendorReturn.status !== VendorReturnStatus.PENDING) {
                throw new AppError(`Vendor return is already ${vendorReturn.status}`, 400);
            }

            // Deduct stock for each item (atomically within this transaction)
            for (const item of vendorReturn.items) {
                // Find stock record
                const stock = await queryRunner.manager.findOne(Stock, {
                    where: {
                        facility_id: facilityId,
                        organization_id: organizationId,
                        medicine_id: item.medicine_id,
                        batch_id: item.batch_id,
                    },
                });
                if (!stock) {
                    throw new AppError(
                        `Stock not found for medicine ${item.medicine_id} / batch ${item.batch_id}`,
                        404,
                    );
                }
                if (stock.quantity < item.quantity_returned) {
                    throw new AppError(
                        `Insufficient stock for medicine ${item.medicine_id}. Available: ${stock.quantity}, Requested: ${item.quantity_returned}`,
                        400,
                    );
                }

                // Deduct from stock
                const previousBalance = stock.quantity;
                stock.quantity -= item.quantity_returned;
                await queryRunner.manager.save(stock);

                // Also decrement batch quantity
                const batch = await queryRunner.manager.findOne(Batch, {
                    where: { id: item.batch_id, organization_id: organizationId },
                });
                if (batch) {
                    batch.current_quantity = Math.max(0, (batch.current_quantity || 0) - item.quantity_returned);
                    await queryRunner.manager.save(batch);
                }

                // Record stock movement
                const { StockMovement } = await import('../../entities/StockMovement.entity');
                const movement = queryRunner.manager.create(StockMovement, {
                    facility_id: facilityId,
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    location_id: stock.location_id ?? undefined,
                    type: StockMovementType.OUT,
                    reason: AdjustmentReason.RETURN_TO_SUPPLIER,
                    quantity: -item.quantity_returned,
                    previous_balance: previousBalance,
                    new_balance: stock.quantity,
                    reference_type: 'VENDOR_RETURN',
                    reference_id: vendorReturn.id,
                    organization_id: organizationId,
                    user_id: userId,
                    notes: `Returned to supplier — VR ${vendorReturn.return_number}`,
                });
                await queryRunner.manager.save(movement);
            }

            // Generate credit note number and update status
            vendorReturn.status = VendorReturnStatus.APPROVED;
            vendorReturn.approved_by_id = userId;
            vendorReturn.approved_at = new Date();
            vendorReturn.credit_note_number = generateDocumentNumber('VCN');
            const savedReturn = await queryRunner.manager.save(vendorReturn);

            // Audit log inside transaction
            const txAudit = new AuditService(queryRunner.manager);
            await txAudit.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.VENDOR_RETURN,
                entity_id: savedReturn.id,
                entity_name: savedReturn.return_number,
                description: `Vendor return ${savedReturn.return_number} approved. Credit note: ${savedReturn.credit_note_number}`,
            });

            await queryRunner.commitTransaction();

            return (await this.vendorReturnRepository.findOne({
                where: { id: savedReturn.id },
                relations: ['items', 'items.medicine', 'items.batch', 'supplier', 'purchase_order', 'approved_by'],
            })) as VendorReturn;
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Reject
    // ─────────────────────────────────────────────────────────────────────────
    async rejectVendorReturn(returnId: number, organizationId: number, userId: number, facilityId: number, reason: string): Promise<VendorReturn> {
        const vendorReturn = await this.vendorReturnRepository.findOne({
            where: { id: returnId, facility_id: facilityId, organization_id: organizationId },
        });
        if (!vendorReturn) {
            throw new AppError('Vendor return not found', 404);
        }
        if (vendorReturn.status !== VendorReturnStatus.PENDING) {
            throw new AppError(`Vendor return is already ${vendorReturn.status}`, 400);
        }

        vendorReturn.status = VendorReturnStatus.REJECTED;
        vendorReturn.approved_by_id = userId;
        vendorReturn.approved_at = new Date();
        vendorReturn.notes = `${vendorReturn.notes ?? ''}\nRejection reason: ${reason}`.trim();

        const saved = await this.vendorReturnRepository.save(vendorReturn);

        await this.auditService.log({
            facility_id: facilityId,
            user_id: userId,
            organization_id: organizationId,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.VENDOR_RETURN,
            entity_id: saved.id,
            entity_name: saved.return_number,
            description: `Vendor return ${saved.return_number} rejected: ${reason}`,
        });

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // List / Get
    // ─────────────────────────────────────────────────────────────────────────
    async listVendorReturns(filters: VendorReturnFiltersDto): Promise<{
        data: VendorReturn[];
        total: number;
        page: number;
        limit: number;
    }> {
        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const skip = (page - 1) * limit;

        const qb = this.vendorReturnRepository
            .createQueryBuilder('vr')
            .leftJoinAndSelect('vr.supplier', 'supplier')
            .leftJoinAndSelect('vr.purchase_order', 'purchase_order')
            .leftJoinAndSelect('vr.created_by', 'created_by')
            .leftJoinAndSelect('vr.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine');

        if (filters.organization_id) {
            qb.where('vr.organization_id = :organizationId', { organizationId: filters.organization_id });
            if (filters.facility_id) {
                qb.andWhere('vr.facility_id = :facilityId', { facilityId: filters.facility_id });
            }
        } else if (filters.facility_id) {
            qb.where('vr.facility_id = :facilityId', { facilityId: filters.facility_id });
        }
        if (filters.status) {
            qb.andWhere('vr.status = :status', { status: filters.status });
        }
        if (filters.supplier_id) {
            qb.andWhere('vr.supplier_id = :supplierId', { supplierId: filters.supplier_id });
        }
        if (filters.start_date) {
            qb.andWhere('vr.created_at >= :startDate', { startDate: filters.start_date });
        }
        if (filters.end_date) {
            qb.andWhere('vr.created_at <= :endDate', { endDate: filters.end_date });
        }

        const [data, total] = await qb
            .skip(skip)
            .take(limit)
            .orderBy('vr.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async getVendorReturn(returnId: number, organizationId?: number, facilityId?: number): Promise<VendorReturn> {
        const where: any = { id: returnId };
        if (organizationId) where.organization_id = organizationId;
        if (facilityId) where.facility_id = facilityId;

        const vendorReturn = await this.vendorReturnRepository.findOne({
            where,
            relations: [
                'items',
                'items.medicine',
                'items.batch',
                'supplier',
                'purchase_order',
                'created_by',
                'approved_by',
                'facility',
            ],
        });
        if (!vendorReturn) {
            throw new AppError('Vendor return not found', 404);
        }
        return vendorReturn;
    }
}
