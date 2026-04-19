import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import {
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    PurchaseOrderItemStatus,
} from '../../entities/PurchaseOrder.entity';
import { GoodsReceipt, GoodsReceiptItem } from '../../entities/GoodsReceipt.entity';
import { PurchaseOrderActivity, ActivityAction, ActivityActorType } from '../../entities/PurchaseOrderActivity.entity';
import { PurchasePriceHistory } from '../../entities/PurchasePriceHistory.entity';
import { StockService } from './stock.service';
import { BatchService } from './batch.service';
import { Batch } from '../../entities/Batch.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { Facility } from '../../entities/Facility.entity';
import { Supplier, SupplierQualificationStatus } from '../../entities/Supplier.entity';
import { StockStatus } from '../../entities/Stock.entity';
import {
    CreatePurchaseOrderDto,
    UpdatePurchaseOrderDto,
    ReceivePurchaseOrderDto,
    PurchaseOrderItemDto,
} from '../../dto/pharmacy.dto';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { resolveMarkupPercent } from '../../utils/pricing.util';
import { StockMovementType } from '../../entities/StockMovement.entity';
import { UomService } from './uom.service';
import * as ExcelJS from 'exceljs';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../../entities/Notification.entity';
import { User, UserRole } from '../../entities/User.entity';
import { EmailUtil } from '../../utils/email.util';
import { eventBus, EventTypes } from '../../utils/eventBus';
import { v4 as uuidv4 } from 'uuid';
import { generateDocumentNumber } from '../../utils/document-number.util';
import { SettingsService } from './settings.service';
import { SETTINGS_KEYS } from './settings.constants';

export class ProcurementService {
    private purchaseOrderRepository: Repository<PurchaseOrder>;
    private goodsReceiptRepository: Repository<GoodsReceipt>;
    private medicineRepository: Repository<Medicine>;
    private auditService: AuditService;
    private notificationService: NotificationService;
    private userRepository: Repository<User>;
    /**
     * Order-level statuses that are allowed to move into the receiving flow.
     * Includes legacy approval statuses plus the new quotation/acceptance ones.
     */
    private static readonly RECEIVABLE_STATUSES: PurchaseOrderStatus[] = [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.CONFIRMED,
        PurchaseOrderStatus.ACCEPTED,
        PurchaseOrderStatus.PARTIALLY_ACCEPTED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.BACKORDERED,
    ];
    private static readonly CANCELLABLE_STATUSES: PurchaseOrderStatus[] = [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.PENDING,
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.CONFIRMED,
    ];

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.purchaseOrderRepository = source.getRepository(PurchaseOrder);
        this.goodsReceiptRepository = source.getRepository(GoodsReceipt);
        this.medicineRepository = source.getRepository(Medicine);
        this.auditService = new AuditService(entityManager);
        this.notificationService = new NotificationService();
        this.userRepository = source.getRepository(User);
    }

    private parseStatusFilter(status?: string): PurchaseOrderStatus[] {
        if (!status) return [];

        const validStatuses = new Set<string>(Object.values(PurchaseOrderStatus));
        const requested = status
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean);

        if (requested.length === 0) return [];

        const uniqueRequested = Array.from(new Set(requested));
        const parsed = uniqueRequested.filter((value): value is PurchaseOrderStatus => validStatuses.has(value));

        if (parsed.length !== uniqueRequested.length) {
            throw new AppError('Invalid purchase order status filter', 400);
        }

        return parsed;
    }

    private assertSupplierActionAllowed(
        action: 'approve' | 'confirm' | 'clarification' | 'reject' | 'delivered',
        status: PurchaseOrderStatus,
    ): void {
        const closedStatuses = new Set<PurchaseOrderStatus>([
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.BACKORDERED,
            PurchaseOrderStatus.RECEIVED,
            PurchaseOrderStatus.CANCELLED,
        ]);

        if (closedStatuses.has(status)) {
            throw new AppError(`Supplier cannot ${action} an order in ${status} status`, 400);
        }

        if (action === 'approve' && ![PurchaseOrderStatus.PENDING, PurchaseOrderStatus.APPROVED].includes(status)) {
            throw new AppError(`Supplier cannot approve an order in ${status} status`, 400);
        }

        if (
            action === 'confirm' &&
            ![PurchaseOrderStatus.PENDING, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CONFIRMED].includes(status)
        ) {
            throw new AppError(`Supplier cannot confirm an order in ${status} status`, 400);
        }

        if (
            action === 'clarification' &&
            ![PurchaseOrderStatus.PENDING, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CONFIRMED].includes(status)
        ) {
            throw new AppError(`Supplier cannot request clarification in ${status} status`, 400);
        }

        if (
            action === 'reject' &&
            ![PurchaseOrderStatus.PENDING, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CONFIRMED].includes(status)
        ) {
            throw new AppError(`Supplier cannot reject an order in ${status} status`, 400);
        }

        if (
            action === 'delivered' &&
            ![PurchaseOrderStatus.PENDING, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CONFIRMED].includes(status)
        ) {
            throw new AppError(`Supplier cannot mark delivered in ${status} status`, 400);
        }
    }

    /**
     * Automatically creates a draft Purchase Order based on reorder suggestions.
     * Includes critical/high urgency items and groups them by preferred supplier.
     */
    async createDraftPOsFromReorderSuggestions(
        facilityId: number,
        organizationId: number,
        suggestions: any[],
        userId: number,
    ): Promise<PurchaseOrder[]> {
        const highUrgencyItems = suggestions
            .filter((s) => s.urgency === 'high' || s.urgency === 'critical')
            .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
                const byUrgency = (order[a.urgency] ?? 9) - (order[b.urgency] ?? 9);
                if (byUrgency !== 0) return byUrgency;
                return Number(b.suggested_quantity || 0) - Number(a.suggested_quantity || 0);
            });

        if (highUrgencyItems.length === 0) return [];

        const bySupplier = new Map<number, any[]>();
        for (const suggestion of highUrgencyItems) {
            const supplierId = Number(suggestion.preferred_supplier_id || 0);
            if (!supplierId) continue;
            if (!bySupplier.has(supplierId)) {
                bySupplier.set(supplierId, []);
            }
            (bySupplier.get(supplierId) as any[]).push(suggestion);
        }
        if (bySupplier.size === 0) return [];

        const created: PurchaseOrder[] = [];
        for (const [supplierId, supplierItems] of bySupplier.entries()) {
            if (!supplierItems.length) continue;
            const items: PurchaseOrderItemDto[] = supplierItems.map((item) => ({
                medicine_id: item.medicine_id || item.id,
                quantity_ordered: Math.ceil(item.suggested_quantity || item.reorder_point || 10),
                unit_price: Number(item.avg_unit_cost || item.last_purchase_price || 0),
                notes: `Automated reorder due to low stock (${item.current_quantity} remaining)`,
            }));

            const createDto: CreatePurchaseOrderDto = {
                facility_id: facilityId,
                organization_id: organizationId,
                supplier_id: supplierId,
                items,
                order_date: new Date().toISOString(),
                notes: 'SYSTEM GENERATED: Critical stock reorder suggestion',
            };
            created.push(await this.create(createDto, userId));
        }

        return created;
    }

    async createDraftPOFromReorderSuggestions(
        facilityId: number,
        organizationId: number,
        suggestions: any[],
        userId: number,
    ): Promise<PurchaseOrder | null> {
        const orders = await this.createDraftPOsFromReorderSuggestions(
            facilityId,
            organizationId,
            suggestions,
            userId,
        );
        return orders[0] || null;
    }

    async generateOrderNumber(_facilityId: number): Promise<string> {
        for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = generateDocumentNumber('PO');
            const existing = await this.purchaseOrderRepository
                .createQueryBuilder('po')
                .select('po.id')
                .where('po.order_number = :orderNumber', { orderNumber: candidate })
                .getOne();

            if (!existing) {
                return candidate;
            }
        }

        throw new AppError('Failed to generate a unique purchase order number', 500);
    }

    private isOrderNumberDuplicateError(error: unknown): boolean {
        return (
            (error as any)?.code === '23505' &&
            (((error as any)?.constraint || '') === 'UQ_b297010fff05faf7baf4e67afa7' ||
                String((error as any)?.detail || '').includes('(order_number)'))
        );
    }

    async create(createDto: CreatePurchaseOrderDto, createdById: number): Promise<PurchaseOrder> {
        for (let attempt = 0; attempt < 3; attempt++) {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const supplierCheck = await queryRunner.manager.findOne(Supplier, {
                    where: { id: createDto.supplier_id, organization_id: createDto.organization_id },
                });
                if (!supplierCheck) {
                    throw new AppError('Supplier not found for this organization', 404);
                }
                if (supplierCheck.qualification_status === SupplierQualificationStatus.SUSPENDED) {
                    throw new AppError('Supplier is suspended and cannot be used on purchase orders', 400);
                }
                const settingsServiceEarly = new SettingsService(queryRunner.manager);
                const supplierCtx = {
                    tenantId: createDto.organization_id!,
                    branchId: createDto.facility_id!,
                    userId: createdById,
                };
                const requireQualifiedSupplier = await settingsServiceEarly
                    .getEffectiveValue<boolean>(SETTINGS_KEYS.SUPPLIER_REQUIRE_QUALIFIED_FOR_PO, supplierCtx)
                    .catch(() => false);
                if (
                    requireQualifiedSupplier &&
                    supplierCheck.qualification_status !== SupplierQualificationStatus.QUALIFIED
                ) {
                    throw new AppError('Supplier must be qualified before creating a purchase order', 400);
                }

                const orderNumber = await this.generateOrderNumber(createDto.facility_id!);

                const { items: _, ...orderData } = createDto;
                const purchaseOrder = this.purchaseOrderRepository.create({
                    ...orderData,
                    order_number: orderNumber,
                    created_by_id: createdById,
                    status: PurchaseOrderStatus.DRAFT,
                    order_date: createDto.order_date ? new Date(createDto.order_date) : new Date(),
                    expected_delivery_date: createDto.expected_delivery_date
                        ? new Date(createDto.expected_delivery_date)
                        : undefined,
                    token: uuidv4(),
                    token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                });

                const savedOrder = await queryRunner.manager.save(purchaseOrder);

                let subtotalAmount = 0;
                const items: PurchaseOrderItem[] = [];

                for (const itemDto of createDto.items) {
                    const medicine = await this.medicineRepository.findOne({
                        where: { id: itemDto.medicine_id, organization_id: createDto.organization_id },
                    });

                    if (!medicine) {
                        throw new AppError(`Medicine with ID ${itemDto.medicine_id} not found`, 404);
                    }

                    const quantity_ordered = Number(itemDto.quantity_ordered) || 0;
                    const unit_price = Number(itemDto.unit_price) || 0;
                    const itemTotal = quantity_ordered * unit_price;
                    subtotalAmount += itemTotal;

                    const item = queryRunner.manager.create(PurchaseOrderItem, {
                        purchase_order_id: savedOrder.id,
                        medicine_id: itemDto.medicine_id,
                        organization_id: createDto.organization_id,
                        quantity_ordered,
                        quantity_received: 0,
                        unit_price,
                        total_price: itemTotal,
                        notes: itemDto.notes || '',
                    });

                    items.push(await queryRunner.manager.save(item));
                }

                const settingsService = new SettingsService(queryRunner.manager);
                const context = {
                    tenantId: createDto.organization_id,
                    branchId: createDto.facility_id,
                    userId: createdById,
                };
                const runtimeConfig = await settingsService.getRuntimeConfig(context);
                const discountPercent = createDto.discount_percent;
                if (typeof discountPercent === 'number' && discountPercent > runtimeConfig.maxDiscountPercent) {
                    throw new AppError(
                        `Discount percent cannot exceed ${runtimeConfig.maxDiscountPercent}% (configured max)`,
                        400,
                    );
                }
                const discountAmount =
                    typeof createDto.discount_amount === 'number'
                        ? createDto.discount_amount
                        : typeof discountPercent === 'number'
                          ? (subtotalAmount * discountPercent) / 100
                          : 0;

                const safeDiscount = Math.min(Math.max(discountAmount, 0), subtotalAmount);
                const taxableBase = subtotalAmount - safeDiscount;

                const vatEnabled = await settingsService
                    .getEffectiveValue<boolean>(SETTINGS_KEYS.TAX_VAT_ENABLED, context)
                    .catch(() => true);
                const vatRate = vatEnabled
                    ? await settingsService.normalizeVatRateToPercent(createDto.vat_rate, context)
                    : 0;
                const vatAmount = vatRate > 0 ? (taxableBase * vatRate) / 100 : 0;

                const shippingCost = Number(createDto.shipping_cost ?? 0);
                const tariffAmount = Number(createDto.tariff_amount ?? 0);
                const handlingFee = Number(createDto.handling_fee ?? 0);
                const landedCostTotal = shippingCost + tariffAmount + handlingFee;

                const { roundMoney } = await import('../../utils/money.util');
                const decimals = runtimeConfig.currencyDecimals;
                savedOrder.subtotal_amount = roundMoney(subtotalAmount, decimals);
                savedOrder.discount_percent = discountPercent ?? 0;
                savedOrder.discount_amount = roundMoney(safeDiscount, decimals);
                savedOrder.vat_rate = vatRate ?? 0;
                savedOrder.vat_amount = roundMoney(vatAmount, decimals);
                savedOrder.total_amount = roundMoney(taxableBase + vatAmount + landedCostTotal, decimals);
                savedOrder.shipping_cost = shippingCost;
                savedOrder.tariff_amount = tariffAmount;
                savedOrder.handling_fee = handlingFee;
                savedOrder.landed_cost_total = landedCostTotal;
                savedOrder.items = items;
                const finalOrder = await queryRunner.manager.save(savedOrder);

                const transactionalAuditService = new AuditService(queryRunner.manager);
                await transactionalAuditService.log({
                    facility_id: createDto.facility_id,
                    user_id: createdById,
                    organization_id: createDto.organization_id,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.PURCHASE_ORDER,
                    entity_id: finalOrder.id,
                    entity_name: finalOrder.order_number,
                    description: `Purchase order ${finalOrder.order_number} created`,
                });

                await queryRunner.commitTransaction();
                return finalOrder;
            } catch (error) {
                if (queryRunner.isTransactionActive) {
                    await queryRunner.rollbackTransaction();
                }
                if (this.isOrderNumberDuplicateError(error)) {
                    if (attempt < 2) {
                        continue;
                    }
                    throw new AppError('A duplicate purchase order number was detected. Please retry the import.', 409);
                }
                throw error;
            } finally {
                await queryRunner.release();
            }
        }

        throw new AppError('Failed to generate a unique purchase order number', 500);
    }

    async receiveOrder(
        orderId: number,
        receiveDto: ReceivePurchaseOrderDto,
        receivedById: number,
        organizationId: number,
        facilityId?: number,
    ): Promise<{ order: PurchaseOrder; skippedItems: any[]; goods_receipt?: GoodsReceipt | null }> {
        if (!receiveDto.received_items?.length) {
            throw new AppError('At least one receipt line is required', 400);
        }

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const purchaseOrder = await queryRunner.manager
                .createQueryBuilder(PurchaseOrder, 'po')
                .setLock('pessimistic_write', undefined, ['po'])
                .leftJoinAndSelect('po.items', 'items')
                .leftJoinAndSelect('po.facility', 'facility')
                .leftJoinAndSelect('po.supplier', 'supplier')
                .where('po.id = :orderId', { orderId })
                .andWhere('po.organization_id = :organizationId', { organizationId })
                .getOne();

            if (!purchaseOrder) {
                throw new AppError('Purchase order not found or access denied', 404);
            }

            if (facilityId && purchaseOrder.facility_id !== facilityId) {
                throw new AppError('You do not have permission to access this purchase order', 403);
            }

            if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
                throw new AppError('Purchase order already fully received', 400);
            }

            if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
                throw new AppError('Cannot receive a cancelled order', 400);
            }

            if (purchaseOrder.supplier?.qualification_status === SupplierQualificationStatus.SUSPENDED) {
                throw new AppError('Cannot receive against a suspended supplier', 400);
            }

            if (!ProcurementService.RECEIVABLE_STATUSES.includes(purchaseOrder.status)) {
                throw new AppError(
                    `Cannot receive an order in ${purchaseOrder.status} status. Approve/confirm it first.`,
                    400,
                );
            }

            const transactionalBatchService = new BatchService(queryRunner.manager);
            const transactionalStockService = new StockService(queryRunner.manager);

            let allItemsReceived = true;
            const skippedItems: any[] = [];
            let hasReceiptOrBackorderChange = false;

            const orderSubtotal = purchaseOrder.items.reduce((sum, i) => sum + (i.total_price || 0), 0);
            const orderDiscount = Math.min(Math.max(purchaseOrder.discount_amount || 0, 0), orderSubtotal);
            const orderVatRate = purchaseOrder.vat_rate || 0;

            /** Persisted on first physical receipt line so stock movements can reference GOODS_RECEIPT (append-only ledger). */
            let savedGr: GoodsReceipt | null = null;

            const currentGRItems: GoodsReceiptItem[] = [];

            let overallBackordered = false;

            for (const receivedItem of receiveDto.received_items) {
                const orderItem = purchaseOrder.items.find((item) => item.id === receivedItem.item_id);

                if (!orderItem) {
                    throw new AppError(`Purchase order item with ID ${receivedItem.item_id} not found`, 404);
                }

                const qtyReceivedThisTime = Number(receivedItem.quantity_received || 0);
                const backorderQtyThisTime = Number(receivedItem.backorder_qty || 0);
                const quantityReceivedSoFar = Number(orderItem.quantity_received || 0);
                const quantityOrdered = Number(orderItem.quantity_ordered || 0);
                const quantityRemainingForThisLine = quantityOrdered - quantityReceivedSoFar;

                if (qtyReceivedThisTime < 0 || backorderQtyThisTime < 0) {
                    throw new AppError(`Negative quantities are not allowed for item ${orderItem.id}`, 400);
                }

                if (qtyReceivedThisTime + backorderQtyThisTime > quantityRemainingForThisLine) {
                    throw new AppError(
                        `Received + backordered quantity exceeds outstanding quantity for item ${orderItem.id}`,
                        400,
                    );
                }

                if (qtyReceivedThisTime > 0 || backorderQtyThisTime > 0) {
                    hasReceiptOrBackorderChange = true;
                }

                if (qtyReceivedThisTime > 0 && (!receivedItem.batch_number || !receivedItem.expiry_date)) {
                    throw new AppError(
                        `Batch number and expiry date are required for received quantity on item ${orderItem.id}`,
                        400,
                    );
                }

                let targetBatch: Batch | null = null;
                if (qtyReceivedThisTime > 0 && receivedItem.batch_number) {
                    targetBatch = await queryRunner.manager.findOne(Batch, {
                        where: {
                            facility_id: purchaseOrder.facility_id,
                            organization_id: purchaseOrder.organization_id,
                            medicine_id: orderItem.medicine_id,
                            batch_number: receivedItem.batch_number,
                        },
                        lock: { mode: 'pessimistic_write' },
                    });

                    if (targetBatch && receivedItem.expiry_date) {
                        const existingExpiry = new Date(targetBatch.expiry_date).toISOString().split('T')[0];
                        const incomingExpiry = new Date(receivedItem.expiry_date).toISOString().split('T')[0];

                        if (existingExpiry !== incomingExpiry) {
                            skippedItems.push({
                                item_id: orderItem.id,
                                medicine_name: orderItem.medicine?.name || 'Unknown Medicine',
                                batch_number: receivedItem.batch_number,
                                reason: `Batch exists with different expiry date (${existingExpiry})`,
                            });
                            allItemsReceived = false;
                            continue;
                        }
                    }
                }

                orderItem.quantity_received = quantityReceivedSoFar + qtyReceivedThisTime;
                orderItem.backorder_qty = backorderQtyThisTime;
                orderItem.remaining_qty = quantityOrdered - orderItem.quantity_received - orderItem.backorder_qty;

                if (orderItem.remaining_qty < 0) {
                    throw new AppError(
                        `Received + Backordered quantity exceeds ordered quantity for item ${orderItem.id}`,
                        400,
                    );
                }

                if (orderItem.remaining_qty > 0 || orderItem.backorder_qty > 0) {
                    allItemsReceived = false;
                }
                if (orderItem.backorder_qty > 0) {
                    overallBackordered = true;
                }

                await queryRunner.manager.save(orderItem);

                if (qtyReceivedThisTime > 0 && receivedItem.batch_number && receivedItem.expiry_date) {
                    // Use accepted_unit_price if available, fallback to unit_price
                    const effectivePrice = Number(orderItem.accepted_unit_price || orderItem.unit_price);
                    const lineBase = effectivePrice * (orderItem.quantity_ordered || 0);

                    const lineDiscount = orderSubtotal > 0 ? (orderDiscount * lineBase) / orderSubtotal : 0;
                    const lineTaxable = lineBase - lineDiscount;
                    const lineVat = orderVatRate > 0 ? (lineTaxable * orderVatRate) / 100 : 0;

                    const landedCostTotal = Number(purchaseOrder.landed_cost_total ?? 0);
                    const lineRatio = orderSubtotal > 0 ? lineBase / orderSubtotal : 0;
                    const landedSurchargePerUnit =
                        orderItem.quantity_ordered > 0 ? (landedCostTotal * lineRatio) / orderItem.quantity_ordered : 0;

                    const effectiveUnitCost =
                        orderItem.quantity_ordered > 0
                            ? (lineTaxable + lineVat) / orderItem.quantity_ordered + landedSurchargePerUnit
                            : effectivePrice + landedSurchargePerUnit;

                    const medicine = await queryRunner.manager.findOne(Medicine, {
                        where: { id: orderItem.medicine_id, organization_id: purchaseOrder.organization_id },
                        relations: ['category'],
                    });
                    const facility = await queryRunner.manager.findOne(Facility, {
                        where: { id: purchaseOrder.facility_id, organization_id: purchaseOrder.organization_id },
                    });

                    // Use explicit selling_price from receiveDto if provided, else fall back
                    // to orderItem value or computed markup.
                    const sellingPrice =
                        typeof receivedItem.selling_price === 'number'
                            ? Number(receivedItem.selling_price)
                            : orderItem.selling_price
                              ? Number(orderItem.selling_price)
                              : effectiveUnitCost *
                                (1 +
                                    resolveMarkupPercent(
                                        medicine?.markup_percent,
                                        (medicine as any)?.category?.default_markup_percent,
                                        facility?.default_markup_percent,
                                        20,
                                    ) /
                                        100);

                    const baseQty = UomService.toBaseUnits(qtyReceivedThisTime, medicine!);
                    const baseUnitCost = UomService.toBaseUnitCost(effectiveUnitCost, medicine!);
                    const baseSellingPrice = UomService.toBaseUnitCost(sellingPrice, medicine!);

                    const varianceQty =
                        receivedItem.variance_quantity !== undefined && receivedItem.variance_quantity !== null
                            ? Number(receivedItem.variance_quantity)
                            : null;
                    const lineFailsQc = receivedItem.qc_pass === false;
                    const forceQuarantine = Boolean(receivedItem.receive_into_quarantine);
                    const hasVariance = varianceQty !== null && !Number.isNaN(varianceQty) && varianceQty !== 0;
                    const receiptLineStatus =
                        lineFailsQc || forceQuarantine || hasVariance ? StockStatus.QUARANTINE : StockStatus.SALEABLE;

                    if (!savedGr) {
                        savedGr = await queryRunner.manager.save(
                            queryRunner.manager.create(GoodsReceipt, {
                                receipt_number: generateDocumentNumber('GR'),
                                facility_id: purchaseOrder.facility_id,
                                organization_id: purchaseOrder.organization_id,
                                purchase_order_id: purchaseOrder.id,
                                received_by_id: receivedById,
                                received_date: receiveDto.received_date
                                    ? new Date(receiveDto.received_date)
                                    : new Date(),
                                notes: receiveDto.notes,
                                storage_condition_note: receiveDto.storage_condition_note ?? null,
                                qc_pass: typeof receiveDto.qc_pass === 'boolean' ? receiveDto.qc_pass : null,
                                coa_attachment_url: receiveDto.coa_attachment_url ?? null,
                            }),
                        );
                    }

                    if (medicine && Number(medicine.selling_price || 0) < baseSellingPrice) {
                        medicine.selling_price = Number(baseSellingPrice.toFixed(2));
                        await queryRunner.manager.save(medicine);
                    }

                    const batch = targetBatch
                        ? targetBatch
                        : await transactionalBatchService.create(
                              {
                                  medicine_id: orderItem.medicine_id,
                                  facility_id: purchaseOrder.facility_id,
                                  organization_id: purchaseOrder.organization_id,
                                  supplier_id: purchaseOrder.supplier_id,
                                  batch_number: receivedItem.batch_number,
                                  expiry_date: receivedItem.expiry_date,
                                  manufacturing_date: receivedItem.manufacturing_date || new Date().toISOString(),
                                  initial_quantity: baseQty,
                                  unit_cost: baseUnitCost,
                                  unit_price: baseSellingPrice, // selling price stored from above logic
                                  purchase_order_item_id: orderItem.id, // New link
                                  supplier: purchaseOrder.supplier?.name,
                              },
                              purchaseOrder.organization_id,
                          );

                    // Existing lots must keep batch-level quantities synchronized when receiving additional stock.
                    if (targetBatch) {
                        await transactionalBatchService.increaseQuantity(
                            batch.id,
                            baseQty,
                            purchaseOrder.organization_id,
                        );
                    }

                    await transactionalStockService.addStock(
                        purchaseOrder.facility_id,
                        purchaseOrder.organization_id,
                        null, // department_id
                        receivedItem.location_id || null,
                        orderItem.medicine_id,
                        batch.id,
                        baseQty,
                        baseUnitCost,
                        baseSellingPrice,
                        {
                            type: StockMovementType.IN,
                            reference_type: 'GOODS_RECEIPT',
                            reference_id: savedGr!.id,
                            user_id: receivedById,
                            notes: `GR ${savedGr!.receipt_number} · PO ${purchaseOrder.order_number}${targetBatch ? ' · existing batch' : ''} · ${qtyReceivedThisTime} pkg → ${baseQty} base units`,
                            initial_stock_status: receiptLineStatus,
                        },
                    );

                    orderItem.last_receipt_qc_pass =
                        typeof receivedItem.qc_pass === 'boolean' ? receivedItem.qc_pass : null;
                    orderItem.last_receipt_variance_qty = hasVariance ? varianceQty : null;
                    await queryRunner.manager.save(orderItem);

                    currentGRItems.push(
                        queryRunner.manager.create(GoodsReceiptItem, {
                            goods_receipt_id: savedGr!.id,
                            purchase_order_item_id: orderItem.id,
                            medicine_id: orderItem.medicine_id,
                            batch_id: batch.id,
                            quantity_received: qtyReceivedThisTime,
                            unit_cost: effectiveUnitCost,
                            batch_number: receivedItem.batch_number,
                            expiry_date: receivedItem.expiry_date ? new Date(receivedItem.expiry_date) : undefined,
                            qc_pass: typeof receivedItem.qc_pass === 'boolean' ? receivedItem.qc_pass : null,
                            variance_quantity: varianceQty,
                            storage_condition_note: receivedItem.storage_condition_note ?? null,
                        }),
                    );
                }
            }

            if (!hasReceiptOrBackorderChange) {
                throw new AppError('No received or backordered quantities were provided', 400);
            }

            if (currentGRItems.length > 0 && savedGr) {
                await queryRunner.manager.save(currentGRItems);
                purchaseOrder.last_goods_receipt_id = savedGr.id;
            }

            allItemsReceived = purchaseOrder.items.every(
                (item) => Number(item.quantity_received || 0) >= Number(item.quantity_ordered || 0),
            );
            overallBackordered = purchaseOrder.items.some((item) => Number(item.backorder_qty || 0) > 0);

            if (allItemsReceived) {
                purchaseOrder.status = PurchaseOrderStatus.RECEIVED;
                purchaseOrder.received_date = receiveDto.received_date
                    ? new Date(receiveDto.received_date)
                    : new Date();
            } else if (overallBackordered) {
                purchaseOrder.status = PurchaseOrderStatus.BACKORDERED;
            } else {
                purchaseOrder.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
            }

            const updatedOrder = await queryRunner.manager.save(purchaseOrder);

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: purchaseOrder.facility_id,
                user_id: receivedById,
                organization_id: purchaseOrder.organization_id,
                action: AuditAction.RECEIVE,
                entity_type: AuditEntityType.PURCHASE_ORDER,
                entity_id: updatedOrder.id,
                entity_name: updatedOrder.order_number,
                description: `Purchase order ${updatedOrder.order_number} received`,
            });

            if (savedGr && currentGRItems.length > 0) {
                await transactionalAuditService.log({
                    facility_id: purchaseOrder.facility_id,
                    user_id: receivedById,
                    organization_id: purchaseOrder.organization_id,
                    action: AuditAction.RECEIVE,
                    entity_type: AuditEntityType.GOODS_RECEIPT,
                    entity_id: savedGr.id,
                    entity_name: savedGr.receipt_number,
                    description: `Goods receipt ${savedGr.receipt_number} posted for PO ${updatedOrder.order_number} (${currentGRItems.length} line(s))`,
                });
            }

            await queryRunner.commitTransaction();

            // Side-effects after commit (non-critical; failure won't corrupt data)
            await this.notifyAdmins(
                updatedOrder.organization_id,
                updatedOrder.facility_id,
                NotificationType.PO_RECEIVED,
                'Purchase Order Received',
                `PO ${updatedOrder.order_number} has been fully/partially received.`,
                { order_id: updatedOrder.id },
            );

            return { order: updatedOrder, skippedItems, goods_receipt: savedGr };
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(
        organizationId: number,
        facilityId?: number,
        status?: string,
        page: number = 1,
        limit: number = 10,
    ): Promise<{ data: PurchaseOrder[]; total: number; totalValue: number; page: number; limit: number }> {
        const statuses = this.parseStatusFilter(status);
        const queryBuilder = this.purchaseOrderRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .leftJoinAndSelect('po.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .leftJoinAndSelect('po.created_by', 'created_by');

        queryBuilder.where('po.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            queryBuilder.andWhere('po.facility_id = :facilityId', { facilityId });
        }

        if (statuses.length === 1) {
            queryBuilder.andWhere('po.status = :status', { status: statuses[0] });
        } else if (statuses.length > 1) {
            queryBuilder.andWhere('po.status IN (:...statuses)', { statuses });
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('po.created_at', 'DESC')
            .getManyAndCount();

        // Calculate total value of all orders (not just current page)
        const totalValueQuery = this.purchaseOrderRepository
            .createQueryBuilder('po')
            .select('SUM(po.total_amount)', 'totalValue');

        totalValueQuery.where('po.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            totalValueQuery.andWhere('po.facility_id = :facilityId', { facilityId });
        }

        if (statuses.length === 1) {
            totalValueQuery.andWhere('po.status = :status', { status: statuses[0] });
        } else if (statuses.length > 1) {
            totalValueQuery.andWhere('po.status IN (:...statuses)', { statuses });
        }

        const totalValueResult = await totalValueQuery.getRawOne();
        const totalValue = parseFloat(totalValueResult?.totalValue || '0') || 0;

        return { data, total, totalValue, page, limit };
    }

    async findOne(id: number, organizationId: number, facilityId?: number): Promise<PurchaseOrder> {
        const where: any = { id };
        where.organization_id = organizationId;
        if (facilityId) where.facility_id = facilityId;

        const order = await this.purchaseOrderRepository.findOne({
            where,
            relations: ['items', 'items.medicine', 'facility', 'supplier', 'created_by', 'activities'],
            order: {
                activities: {
                    created_at: 'DESC',
                } as any,
            },
        });

        if (!order) {
            throw new AppError('Purchase order not found', 404);
        }

        return order;
    }

    async findGoodsReceipts(
        organizationId: number,
        facilityId?: number,
        page: number = 1,
        limit: number = 10,
    ): Promise<{ data: GoodsReceipt[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.goodsReceiptRepository
            .createQueryBuilder('gr')
            .leftJoinAndSelect('gr.purchase_order', 'purchase_order')
            .leftJoinAndSelect('purchase_order.supplier', 'supplier')
            .leftJoinAndSelect('gr.received_by', 'received_by')
            .leftJoinAndSelect('gr.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine');

        queryBuilder.where('gr.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            queryBuilder.andWhere('gr.facility_id = :facilityId', { facilityId });
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('gr.received_date', 'DESC')
            .addOrderBy('gr.id', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async findGoodsReceiptById(id: number, organizationId: number, facilityId?: number): Promise<GoodsReceipt> {
        const where: any = { id };
        where.organization_id = organizationId;
        if (facilityId) where.facility_id = facilityId;

        const goodsReceipt = await this.goodsReceiptRepository.findOne({
            where,
            relations: [
                'purchase_order',
                'purchase_order.supplier',
                'purchase_order.items',
                'purchase_order.items.medicine',
                'received_by',
                'items',
                'items.medicine',
                'items.batch',
            ],
        });

        if (!goodsReceipt) {
            throw new AppError('Goods receipt not found', 404);
        }

        return goodsReceipt;
    }

    async update(
        id: number,
        updateDto: UpdatePurchaseOrderDto,
        organizationId: number,
        facilityId?: number,
    ): Promise<PurchaseOrder> {
        const order = await this.findOne(id, organizationId, facilityId);

        if (updateDto.status !== undefined) {
            throw new AppError(
                'Direct PO status updates are not allowed. Use submit, approve, receive, or cancel actions.',
                400,
            );
        }

        if (updateDto.received_date !== undefined) {
            throw new AppError(
                'Direct received_date updates are not allowed. Receive the order to update inventory and dates.',
                400,
            );
        }

        Object.assign(order, {
            ...updateDto,
            order_date: updateDto.order_date ? new Date(updateDto.order_date) : order.order_date,
            expected_delivery_date: updateDto.expected_delivery_date
                ? new Date(updateDto.expected_delivery_date)
                : order.expected_delivery_date,
        });

        return await this.purchaseOrderRepository.save(order);
    }

    async generateTemplate(organizationId: number): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Purchase Order Template');

        worksheet.columns = [
            { header: 'Medicine ID', key: 'medicine_id', width: 15 },
            { header: 'Medicine Name (Reference only)', key: 'medicine_name', width: 30 },
            { header: 'Quantity Ordered', key: 'quantity_ordered', width: 20 },
            { header: 'Unit Price', key: 'unit_price', width: 15 },
            { header: 'Notes', key: 'notes', width: 30 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        // Fetch actual medicines from the database
        const medicines = await this.medicineRepository.find({
            where: { is_active: true, organization_id: organizationId },
            order: { name: 'ASC' },
            take: 500, // Limit to 500 medicines to avoid huge files
        });

        // Add all medicines to the template with empty quantity and price
        medicines.forEach((medicine) => {
            worksheet.addRow({
                medicine_id: medicine.id,
                medicine_name: medicine.name,
                quantity_ordered: '',
                unit_price: '',
                notes: '',
            });
        });

        // Add instruction row at the bottom
        const instructionRow = worksheet.addRow([]);
        instructionRow.getCell(1).value = 'Instructions:';
        instructionRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' } };

        const noteRow = worksheet.addRow([]);
        noteRow.getCell(1).value =
            "Fill in Quantity Ordered and Unit Price for the medicines you want to order. Delete rows you don't need.";
        noteRow.getCell(1).font = { italic: true };

        return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    }

    async importFromExcel(
        buffer: Buffer,
        facilityId: number,
        supplierId: number,
        organizationId: number,
        createdById: number,
    ): Promise<PurchaseOrder> {
        const items = await this.parseExcel(buffer);

        const createDto: CreatePurchaseOrderDto = {
            facility_id: facilityId,
            organization_id: organizationId,
            supplier_id: supplierId,
            items,
            order_date: new Date().toISOString(),
        };

        return await this.create(createDto, createdById);
    }

    async parseExcel(buffer: Buffer): Promise<PurchaseOrderItemDto[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw new AppError('Invalid Excel file: No worksheet found', 400);
        }

        const items: PurchaseOrderItemDto[] = [];

        const headerRow = worksheet.getRow(1);
        let colMap = {
            medicine_id: 1,
            medicine_code: -1,
            quantity_ordered: 3,
            unit_price: 4,
            notes: 5,
        };

        const headerValues = headerRow.values as any[];
        if (headerValues && headerValues.length > 0) {
            headerValues.forEach((val, idx) => {
                if (!val) return;
                const s = val.toString().toLowerCase();
                if (s.includes('id')) colMap.medicine_id = idx;
                else if (s.includes('code') || s.includes('sku') || s.includes('barcode')) colMap.medicine_code = idx;
                else if (s.includes('qty') || s.includes('quantity')) colMap.quantity_ordered = idx;
                else if (s.includes('price') || s.includes('cost')) colMap.unit_price = idx;
                else if (s.includes('note')) colMap.notes = idx;
            });
        }

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const medicine_id = row.getCell(colMap.medicine_id).value
                ? Number(row.getCell(colMap.medicine_id).value)
                : null;
            const medicine_code = colMap.medicine_code !== -1 ? row.getCell(colMap.medicine_code).text?.trim() : null;
            const quantity_ordered = row.getCell(colMap.quantity_ordered).value
                ? Number(row.getCell(colMap.quantity_ordered).value)
                : null;
            const unit_price = row.getCell(colMap.unit_price).value
                ? Number(row.getCell(colMap.unit_price).value)
                : null;
            const notes = row.getCell(colMap.notes).value?.toString() || '';

            if ((medicine_id || medicine_code) && quantity_ordered && unit_price) {
                items.push({
                    medicine_id: medicine_id || (null as any),
                    medicine_code,
                    quantity_ordered,
                    unit_price,
                    notes,
                } as any);
            }
        });

        if (items.length === 0) {
            throw new AppError('No valid items found in Excel file', 400);
        }

        return items;
    }

    async validateImport(
        buffer: Buffer,
        _facilityId: number,
        _organizationId: number,
    ): Promise<{ items: any[]; total_amount: number }> {
        const rawItems = await this.parseExcel(buffer);
        const itemsWithDetails: any[] = [];
        let total_amount = 0;

        for (let i = 0; i < rawItems.length; i++) {
            const item = rawItems[i];
            const rowNum = i + 2;

            let medicine: Medicine | null = null;

            if (item.medicine_id) {
                medicine = await this.medicineRepository.findOne({
                    where: { id: item.medicine_id },
                });
            }

            if (!medicine && (item as any).medicine_code) {
                medicine = await this.medicineRepository.findOne({
                    where: { code: (item as any).medicine_code },
                });
            }

            if (!medicine) {
                const identifier = item.medicine_id || (item as any).medicine_code || 'Unknown';
                throw new AppError(`Medicine "${identifier}" not found in your organization (Row ${rowNum})`, 404);
            }

            const quantity_ordered = Number(item.quantity_ordered) || 0;
            const unit_price = Number(item.unit_price) || 0;
            const itemTotal = quantity_ordered * unit_price;
            total_amount += itemTotal;

            itemsWithDetails.push({
                ...item,
                medicine_id: medicine.id,
                medicine_name: medicine.name,
                medicine_code: medicine.code,
                total_price: itemTotal,
            });
        }

        return { items: itemsWithDetails, total_amount };
    }

    async approveOrder(id: number, organizationId: number, userId: number): Promise<PurchaseOrder> {
        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            const order = await manager.findOne(PurchaseOrder, {
                where: { id, organization_id: organizationId },
                relations: ['items', 'items.medicine', 'facility', 'supplier', 'created_by'],
            });

            if (!order) {
                throw new AppError('Purchase order not found', 404);
            }

            if (order.status !== PurchaseOrderStatus.PENDING) {
                throw new AppError(`Cannot approve an order in ${order.status} status`, 400);
            }

            order.status = PurchaseOrderStatus.APPROVED;
            const saved = await manager.save(order);

            await this.auditService.log({
                facility_id: order.facility_id,
                user_id: userId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.PURCHASE_ORDER,
                entity_id: order.id,
                entity_name: order.order_number,
                description: `Purchase order ${order.order_number} approved`,
            });

            const admins = await manager.find(User, {
                where: [
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.FACILITY_ADMIN,
                        is_active: true,
                    },
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.STORE_MANAGER,
                        is_active: true,
                    },
                ],
            });

            for (const admin of admins) {
                await this.notificationService.createNotification(
                    admin.id,
                    NotificationType.PO_APPROVED,
                    'Purchase Order Approved',
                    `PO ${order.order_number} has been approved.`,
                    { order_id: order.id },
                    manager,
                );
            }

            // also inform supplier by email so they can deliver
            if (order.supplier && order.supplier.email) {
                const subject = `PO Approved: ${order.order_number}`;
                const body = `<p>Your purchase order <strong>${order.order_number}</strong> has been approved. Please prepare and deliver the shipment as soon as possible.</p>`;
                EmailUtil.sendEmail(order.supplier.email, subject, body).catch((err) =>
                    console.error('Failed to send approval notice to supplier:', err),
                );
            }

            return saved;
        });
    }

    async cancelOrder(id: number, organizationId: number, userId: number): Promise<PurchaseOrder> {
        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            const order = await manager.findOne(PurchaseOrder, {
                where: { id, organization_id: organizationId },
                relations: ['items', 'facility', 'supplier', 'created_by'],
            });

            if (!order) {
                throw new AppError('Purchase order not found', 404);
            }

            if (!ProcurementService.CANCELLABLE_STATUSES.includes(order.status)) {
                throw new AppError(`Cannot cancel an order in ${order.status} status`, 400);
            }

            const hasAnyReceivedQuantity = order.items.some((item) => Number(item.quantity_received || 0) > 0);
            if (hasAnyReceivedQuantity) {
                throw new AppError('Cannot cancel an order that has already been partially received', 400);
            }

            order.status = PurchaseOrderStatus.CANCELLED;
            const saved = await manager.save(order);

            await this.auditService.log({
                facility_id: order.facility_id,
                user_id: userId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.PURCHASE_ORDER,
                entity_id: order.id,
                entity_name: order.order_number,
                description: `Purchase order ${order.order_number} cancelled`,
            });

            const admins = await manager.find(User, {
                where: [
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.FACILITY_ADMIN,
                        is_active: true,
                    },
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.STORE_MANAGER,
                        is_active: true,
                    },
                ],
            });

            for (const admin of admins) {
                await this.notificationService.createNotification(
                    admin.id,
                    NotificationType.PO_CANCELLED,
                    'Purchase Order Cancelled',
                    `PO ${order.order_number} has been cancelled.`,
                    { order_id: order.id },
                    manager,
                );
            }

            // inform supplier by email as well
            if (order.supplier && order.supplier.email) {
                const subject = `PO Cancelled: ${order.order_number}`;
                const body = `<p>Your purchase order <strong>${order.order_number}</strong> has been cancelled by the pharmacy. No further action is required.</p>`;
                EmailUtil.sendEmail(order.supplier.email, subject, body).catch((err) =>
                    console.error('Failed to send cancellation notice to supplier:', err),
                );
            }

            return saved;
        });
    }

    async submitOrder(id: number, organizationId: number): Promise<PurchaseOrder> {
        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            const order = await manager.findOne(PurchaseOrder, {
                where: { id, organization_id: organizationId },
                relations: ['items', 'items.medicine', 'facility', 'supplier', 'created_by'],
            });

            if (!order) {
                throw new AppError('Purchase order not found', 404);
            }

            if (order.status !== PurchaseOrderStatus.DRAFT) {
                throw new AppError(`Cannot submit an order in ${order.status} status`, 400);
            }

            order.status = PurchaseOrderStatus.PENDING;
            const saved = await manager.save(order);

            const admins = await manager.find(User, {
                where: [
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.FACILITY_ADMIN,
                        is_active: true,
                    },
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.STORE_MANAGER,
                        is_active: true,
                    },
                ],
            });

            for (const admin of admins) {
                await this.notificationService.createNotification(
                    admin.id,
                    NotificationType.PO_SUBMITTED,
                    'New Purchase Order Submitted',
                    `PO ${order.order_number} has been submitted for approval.`,
                    { order_id: order.id },
                    manager,
                );
            }

            if (order.supplier?.email) {
                EmailUtil.sendPurchaseOrderToSupplier(order.supplier.email, order).catch(console.error);
            }

            return saved;
        });
    }

    async exportOrderToExcel(id: number, organizationId: number): Promise<ExcelJS.Buffer> {
        const order = await this.purchaseOrderRepository.findOne({
            where: { id, organization_id: organizationId },
            relations: ['supplier', 'items', 'items.medicine'],
        });

        if (!order) {
            throw new AppError('Purchase order not found', 404);
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Purchase Order');

        worksheet.addRow(['Purchase Order', order.order_number]);
        worksheet.addRow(['Supplier', order.supplier?.name]);
        worksheet.addRow(['Date', order.order_date]);
        worksheet.addRow(['Status', order.status]);
        worksheet.addRow(['Total Amount', order.total_amount]);
        worksheet.addRow([]);

        worksheet.addRow(['Item Code', 'Item Name', 'Quantity', 'Unit Price', 'Total']);
        order.items.forEach((item) => {
            worksheet.addRow([
                item.medicine?.code,
                item.medicine?.name,
                item.quantity_ordered,
                item.unit_price,
                item.total_price,
            ]);
        });

        worksheet.getColumn(1).width = 15;
        worksheet.getColumn(2).width = 30;
        worksheet.getRow(1).font = { bold: true, size: 14 };
        worksheet.getRow(7).font = { bold: true };

        return (await workbook.xlsx.writeBuffer()) as any;
    }

    async getOrderByToken(token: string): Promise<PurchaseOrder> {
        const order = await this.purchaseOrderRepository.findOne({
            where: { token },
            relations: ['items', 'items.medicine', 'facility', 'supplier', 'created_by', 'activities'],
            order: {
                activities: {
                    created_at: 'DESC',
                } as any,
            },
        });

        if (!order) {
            throw new AppError('Invalid or expired token', 404);
        }

        if (order.token_expires_at && order.token_expires_at < new Date()) {
            throw new AppError('This link has expired', 400);
        }

        // track views
        if (!order.is_viewed_by_supplier) {
            order.is_viewed_by_supplier = true;
            await this.purchaseOrderRepository.save(order);

            await this.logActivity(
                order.id,
                ActivityAction.VIEWED,
                ActivityActorType.SUPPLIER,
                'Supplier viewed the purchase order',
            );
        }

        return order;
    }

    async supplierAction(
        token: string,
        action: 'approve' | 'confirm' | 'clarification' | 'reject' | 'delivered',
        data?: { message?: string },
    ): Promise<PurchaseOrder> {
        const order = await this.getOrderByToken(token);
        this.assertSupplierActionAllowed(action, order.status);

        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            let activityAction: ActivityAction;
            let description: string;
            let emailSubject: string;

            if (action === 'approve') {
                activityAction = ActivityAction.APPROVED; // Ensure this enum exists or use CONFIRMED/UPDATED
                description = 'Supplier approved the order';
                emailSubject = `PO Approved: ${order.order_number}`;
                order.status = PurchaseOrderStatus.APPROVED;
                await manager.save(order);
            } else if (action === 'confirm') {
                activityAction = ActivityAction.CONFIRMED;
                description = 'Supplier confirmed the order (Ready for Delivery)';
                emailSubject = `PO Confirmed: ${order.order_number}`;
                order.status = PurchaseOrderStatus.CONFIRMED; // Or appropriate status
                await manager.save(order);
            } else if (action === 'clarification') {
                activityAction = ActivityAction.CLARIFICATION_REQUESTED;
                description = data?.message || 'Supplier requested clarification';
                emailSubject = `Clarification Requested for PO: ${order.order_number}`;
            } else if (action === 'reject') {
                activityAction = ActivityAction.REJECTED;
                description = data?.message || 'Supplier rejected the order';
                emailSubject = `PO Rejected: ${order.order_number}`;

                // Optionally update status if REJECTED exists, otherwise CANCELLED.
                order.status = PurchaseOrderStatus.CANCELLED;
                await manager.save(order);
            } else if (action === 'delivered') {
                // 'delivered' means supplier has shipped/delivered, waiting for receiving at facility.
                // We might want a specific status like 'SHIPPED' or just log it.
                // Using 'UPDATED' generic action for now, or 'CONFIRMED' if it implies delivery.
                // Let's use COMMENTED or UPDATED with description.
                activityAction = ActivityAction.UPDATED;
                description = data?.message || 'Supplier marked order as delivered/shipped';
                emailSubject = `PO Marked Delivered: ${order.order_number}`;
            } else {
                throw new AppError('Invalid action', 400);
            }

            await this.logActivity(
                order.id,
                activityAction,
                ActivityActorType.SUPPLIER,
                description,
                null,
                data,
                manager,
            );

            // Notify facility admins
            const admins = await manager.find(User, {
                where: [
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.FACILITY_ADMIN,
                        is_active: true,
                    },
                    {
                        organization_id: order.organization_id,
                        facility_id: order.facility_id,
                        role: UserRole.STORE_MANAGER,
                        is_active: true,
                    },
                ],
            });

            // Emit real-time event
            const adminIds = admins.map((a) => a.id);
            // Also notify creator
            if (order.created_by_id && !adminIds.includes(order.created_by_id)) {
                adminIds.push(order.created_by_id);
            }

            eventBus.emit(EventTypes.PO_UPDATED, {
                orderId: order.id,
                recipientIds: adminIds,
                action,
            });

            const emailContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>${emailSubject}</h2>
                    <p><strong>Order Number:</strong> ${order.order_number}</p>
                    <p><strong>Supplier:</strong> ${order.supplier.name}</p>
                    <p><strong>Action:</strong> ${action.toUpperCase()}</p>
                    <p><strong>Message:</strong></p>
                    <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #0d9488;">
                        ${description}
                    </blockquote>
                    <p>Please log in to the system to view details and respond.</p>
                </div>
            `;

            for (const admin of admins) {
                // In-app notification
                await this.notificationService.createNotification(
                    admin.id,
                    NotificationType.PO_APPROVED, // Reusing existing type or use appropriate one
                    `Supplier Update: ${order.order_number}`,
                    `${description}`,
                    { order_id: order.id, action },
                    manager,
                );

                // Email notification
                if (admin.email) {
                    EmailUtil.sendEmail(admin.email, emailSubject, emailContent).catch((err) =>
                        console.error(`Failed to send email to ${admin.email}`, err),
                    );
                }
            }

            // Also notify the creator if they are not one of the admins found (optional but good practice)
            if (order.created_by && order.created_by.email && !admins.find((a) => a.id === order.created_by.id)) {
                EmailUtil.sendEmail(order.created_by.email, emailSubject, emailContent).catch((err) =>
                    console.error(`Failed to send email to creator ${order.created_by.email}`, err),
                );
            }

            return order;
        });
    }

    private async logActivity(
        purchaseOrderId: number,
        action: ActivityAction,
        actorType: ActivityActorType,
        description: string,
        userId: number | null = null,
        metadata: any = null,
        entityManager?: EntityManager,
    ): Promise<void> {
        const manager = entityManager || this.purchaseOrderRepository.manager;
        const activity = manager.create(PurchaseOrderActivity, {
            purchase_order_id: purchaseOrderId,
            action,
            actor_type: actorType,
            description,
            user_id: userId || undefined,
            metadata,
        });
        await manager.save(activity);
    }

    private async notifyAdmins(
        organizationId: number,
        facilityId: number,
        type: NotificationType,
        title: string,
        message: string,
        data?: Record<string, any>,
    ) {
        const admins = await this.userRepository.find({
            where: [
                {
                    organization_id: organizationId,
                    facility_id: facilityId,
                    role: UserRole.FACILITY_ADMIN,
                    is_active: true,
                },
                {
                    organization_id: organizationId,
                    facility_id: facilityId,
                    role: UserRole.STORE_MANAGER,
                    is_active: true,
                },
            ],
        });

        for (const admin of admins) {
            await this.notificationService.createNotification(admin.id, type, title, message, data);
        }
    }

    async submitRequest(id: number, organizationId: number, userId: number): Promise<PurchaseOrder> {
        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            const order = await manager.findOne(PurchaseOrder, {
                where: { id, organization_id: organizationId },
                relations: ['supplier', 'facility', 'items', 'items.medicine'],
            });

            if (!order) throw new AppError('Purchase order not found', 404);
            if (order.status !== PurchaseOrderStatus.DRAFT) {
                throw new AppError(`Cannot submit order in ${order.status} status`, 400);
            }
            if (!order.items || order.items.length === 0) {
                throw new AppError('Cannot submit an empty purchase request. Add at least one item.', 400);
            }

            // Map Draft Purchase Request → Submitted Request
            order.status = PurchaseOrderStatus.SUBMITTED;
            order.submitted_at = new Date();
            const saved = await manager.save(order);

            await this.logActivity(
                order.id,
                ActivityAction.SUBMITTED,
                ActivityActorType.USER,
                `Purchase request ${order.order_number} submitted to supplier`,
                userId,
                null,
                manager,
            );

            // Notify supplier (via email or internal message if they have an account)
            if (order.supplier?.email) {
                EmailUtil.sendPurchaseOrderToSupplier(order.supplier.email, order).catch(console.error);
            }

            return saved;
        });
    }

    async supplierQuote(
        id: number,
        items: { medicine_id: number; quoted_unit_price: number; quantity_available?: number; notes?: string }[],
        organizationId: number,
        actorType: ActivityActorType = ActivityActorType.SUPPLIER,
        userId?: number,
    ): Promise<PurchaseOrder> {
        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            const order = await manager.findOne(PurchaseOrder, {
                where: { id, organization_id: organizationId },
                relations: ['items'],
            });

            if (!order) throw new AppError('Purchase order not found', 404);
            if (
                ![
                    PurchaseOrderStatus.SUBMITTED,
                    PurchaseOrderStatus.PARTIALLY_QUOTED,
                    PurchaseOrderStatus.QUOTED,
                ].includes(order.status)
            ) {
                throw new AppError(`Order in ${order.status} status cannot be quoted`, 400);
            }

            if (!order.items || order.items.length === 0) {
                throw new AppError('Cannot quote an order with no items', 400);
            }

            // Apply quotations per line
            for (const itemQuote of items) {
                const orderItem = order.items.find((i) => i.medicine_id === itemQuote.medicine_id);
                if (orderItem) {
                    orderItem.quoted_unit_price = itemQuote.quoted_unit_price;
                    if (itemQuote.quantity_available !== undefined) {
                        orderItem.backorder_qty = Math.max(
                            0,
                            orderItem.quantity_ordered - itemQuote.quantity_available,
                        );
                    }
                    orderItem.notes = itemQuote.notes || orderItem.notes;
                    orderItem.status = PurchaseOrderItemStatus.QUOTED;
                    await manager.save(orderItem);
                }
            }

            // Determine if every order line has been quoted at least once
            const allItemsQuoted = order.items.every((item) => item.status === PurchaseOrderItemStatus.QUOTED);

            order.status = allItemsQuoted ? PurchaseOrderStatus.QUOTED : PurchaseOrderStatus.PARTIALLY_QUOTED;
            order.quoted_at = new Date();
            const saved = await manager.save(order);

            await this.logActivity(
                order.id,
                ActivityAction.QUOTED,
                actorType,
                'Supplier updated quotation prices',
                userId,
                { quoted_items: items },
                manager,
            );

            return saved;
        });
    }

    async reviewQuotation(
        id: number,
        items: {
            medicine_id: number;
            accepted_unit_price: number;
            selling_price: number;
            status: PurchaseOrderItemStatus;
            notes?: string;
        }[],
        organizationId: number,
        userId: number,
    ): Promise<PurchaseOrder> {
        return await this.purchaseOrderRepository.manager.transaction(async (manager) => {
            const order = await manager.findOne(PurchaseOrder, {
                where: { id, organization_id: organizationId },
                relations: ['items', 'supplier'],
            });

            if (!order) throw new AppError('Purchase order not found', 404);
            if (![PurchaseOrderStatus.QUOTED, PurchaseOrderStatus.PARTIALLY_QUOTED].includes(order.status)) {
                throw new AppError(
                    `Cannot review quotation for order in ${order.status} status. Expected quoted status.`,
                    400,
                );
            }
            if (!order.items || order.items.length === 0) {
                throw new AppError('Cannot review quotation for an order with no items', 400);
            }

            // Ensure caller provided a decision for every existing order item
            const missingDecisions = order.items.filter(
                (orderItem) => !items.find((i) => i.medicine_id === orderItem.medicine_id),
            );
            if (missingDecisions.length > 0) {
                throw new AppError(
                    'Every order line must be explicitly accepted or rejected during quotation review',
                    400,
                );
            }

            let acceptedCount = 0;
            let rejectedCount = 0;
            let totalOrderAmount = 0;

            for (const itemReview of items) {
                const orderItem = order.items.find((i) => i.medicine_id === itemReview.medicine_id);
                if (orderItem) {
                    // Only allow review of items that have been quoted
                    if (orderItem.status !== PurchaseOrderItemStatus.QUOTED) {
                        throw new AppError(
                            `Item for medicine ${orderItem.medicine_id} cannot be reviewed because it is not in quoted status`,
                            400,
                        );
                    }

                    orderItem.accepted_unit_price = itemReview.accepted_unit_price;
                    orderItem.selling_price = itemReview.selling_price;
                    orderItem.status = itemReview.status;
                    orderItem.notes = itemReview.notes || orderItem.notes;

                    if (itemReview.status === PurchaseOrderItemStatus.ACCEPTED) {
                        acceptedCount++;
                        totalOrderAmount += Number(itemReview.accepted_unit_price) * Number(orderItem.quantity_ordered);

                        // Track history
                        const history = manager.create(PurchasePriceHistory, {
                            organization_id: organizationId,
                            supplier_id: order.supplier_id,
                            medicine_id: orderItem.medicine_id,
                            purchase_order_id: order.id,
                            quoted_unit_price: orderItem.quoted_unit_price || orderItem.unit_price,
                            accepted_unit_price: itemReview.accepted_unit_price,
                            selling_price: itemReview.selling_price,
                        });
                        await manager.save(history);
                    } else if (itemReview.status === PurchaseOrderItemStatus.REJECTED) {
                        rejectedCount++;
                    }
                    await manager.save(orderItem);
                }
            }

            if (acceptedCount === 0 && rejectedCount > 0) {
                order.status = PurchaseOrderStatus.REJECTED;
            } else if (acceptedCount === order.items.length) {
                order.status = PurchaseOrderStatus.ACCEPTED;
            } else {
                order.status = PurchaseOrderStatus.PARTIALLY_ACCEPTED;
            }

            order.accepted_at = new Date();
            order.total_amount = totalOrderAmount;
            const saved = await manager.save(order);

            await this.logActivity(
                order.id,
                ActivityAction.APPROVED,
                ActivityActorType.USER,
                `Pharmacy reviewed and ${order.status} the quotation`,
                userId,
                null,
                manager,
            );

            return saved;
        });
    }

    async getPriceSuggestions(supplierId: number, medicineId: number, organizationId: number) {
        const history = await this.purchaseOrderRepository.manager.findOne(PurchasePriceHistory, {
            where: { supplier_id: supplierId, medicine_id: medicineId, organization_id: organizationId },
            order: { created_at: 'DESC' },
        });

        if (!history) return null;

        return {
            last_quoted_price: history.quoted_unit_price,
            last_accepted_price: history.accepted_unit_price,
            last_selling_price: history.selling_price,
            last_purchase_date: history.created_at,
        };
    }
    async supplierQuoteByToken(token: string, items: any[]): Promise<PurchaseOrder> {
        const order = await this.getOrderByToken(token);
        return await this.supplierQuote(order.id, items, order.organization_id, ActivityActorType.SUPPLIER);
    }
}
