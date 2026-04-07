import { ProcurementService } from '../procurement.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreatePurchaseOrderDto } from '../../../dto/pharmacy.dto';
import { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItemStatus } from '../../../entities/PurchaseOrder.entity';
import { Batch } from '../../../entities/Batch.entity';
import { Medicine } from '../../../entities/Medicine.entity';
import { Facility } from '../../../entities/Facility.entity';

// Define mock instances at the top Level (hoisted with jest.mock)
const mockStockServiceInstance = {
    addStock: jest.fn(),
};
const mockBatchServiceInstance = {
    create: jest.fn(),
    increaseQuantity: jest.fn(),
};
const mockAuditServiceInstance = {
    log: jest.fn(),
};
const mockNotificationServiceInstance = {
    createNotification: jest.fn(),
};

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        createQueryRunner: jest.fn(),
    },
}));

jest.mock('../stock.service', () => ({
    StockService: jest.fn().mockImplementation(() => mockStockServiceInstance),
}));

jest.mock('../batch.service', () => ({
    BatchService: jest.fn().mockImplementation(() => mockBatchServiceInstance),
}));

jest.mock('../audit.service', () => ({
    AuditService: jest.fn().mockImplementation(() => mockAuditServiceInstance),
}));

jest.mock('../../notification.service', () => ({
    NotificationService: jest.fn().mockImplementation(() => mockNotificationServiceInstance),
}));

describe('ProcurementService', () => {
    let procurementService: ProcurementService;
    let mockPORepository: any;
    let mockPOItemRepository: any;
    let mockMedicineRepository: any;
    let mockUserRepository: any;
    let mockQueryRunner: any;
    let lockedPurchaseOrder: any;

    beforeEach(() => {
        const poQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
            getCount: jest.fn().mockResolvedValue(0),
            getMany: jest.fn().mockResolvedValue([]),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            getRawOne: jest.fn().mockResolvedValue({ totalValue: 0 }),
        };

        // Shared transaction manager used by submitRequest / supplierQuote / reviewQuotation
        const mockTxManager = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
            create: jest.fn((data: any) => data),
            getRepository: jest.fn().mockReturnValue({
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                save: jest.fn().mockResolvedValue({}),
                create: jest.fn((d: any) => d),
                createQueryBuilder: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnThis(),
                    andWhere: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockReturnThis(),
                    take: jest.fn().mockReturnThis(),
                    getMany: jest.fn().mockResolvedValue([]),
                }),
            }),
        };

        mockPORepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(poQueryBuilder),
            manager: {
                transaction: jest.fn().mockImplementation((cb: any) => cb(mockTxManager)),
                findOne: mockTxManager.findOne,
                save: mockTxManager.save,
            },
        };

        // Expose txManager so individual tests can configure findOne behaviour
        (mockPORepository as any)._txManager = mockTxManager;

        mockPOItemRepository = {
            create: jest.fn(),
            save: jest.fn(),
        };

        mockMedicineRepository = {
            findOne: jest.fn(),
        };

        mockQueryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            manager: {
                create: jest.fn((_entity, data) => data),
                save: jest.fn(),
                findOne: jest.fn(),
                createQueryBuilder: jest.fn((_entity: any) => ({
                    setLock: jest.fn().mockReturnThis(),
                    leftJoinAndSelect: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    andWhere: jest.fn().mockReturnThis(),
                    getOne: jest.fn().mockImplementation(async () => lockedPurchaseOrder),
                })),
                getRepository: jest.fn().mockReturnValue({
                    find: jest.fn().mockResolvedValue([]),
                    findOne: jest.fn().mockResolvedValue(null),
                    save: jest.fn().mockResolvedValue(null),
                    create: jest.fn((data) => data),
                    createQueryBuilder: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnThis(),
                        andWhere: jest.fn().mockReturnThis(),
                        orderBy: jest.fn().mockReturnThis(),
                        take: jest.fn().mockReturnThis(),
                        getMany: jest.fn().mockResolvedValue([]),
                    }),
                }),
            },
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            isTransactionActive: true,
        };

        mockUserRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity.name === 'PurchaseOrder') {
                return mockPORepository;
            }
            if (entity.name === 'PurchaseOrderItem') {
                return mockPOItemRepository;
            }
            if (entity.name === 'User') {
                return mockUserRepository;
            }
            return mockMedicineRepository;
        });

        (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);
        lockedPurchaseOrder = null;

        procurementService = new ProcurementService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        const createDto: CreatePurchaseOrderDto = {
            facility_id: 1,
            supplier_id: 1,
            items: [
                {
                    medicine_id: 1,
                    quantity_ordered: 100,
                    unit_price: 50,
                },
            ],
        };

        it('should create purchase order successfully', async () => {
            mockMedicineRepository.findOne.mockResolvedValue({ id: 1, name: 'Paracetamol' });

            const savedPO = {
                id: 1,
                order_number: 'PO-2024-0001',
                ...createDto,
                status: PurchaseOrderStatus.DRAFT,
                total_amount: 5000,
            };

            mockQueryRunner.manager.save
                .mockResolvedValueOnce(savedPO)
                .mockResolvedValueOnce({ id: 1, ...createDto.items[0], total_price: 5000 })
                .mockResolvedValueOnce({ ...savedPO, total_amount: 5000 });

            const result = await procurementService.create(createDto, 1);

            expect(mockQueryRunner.connect).toHaveBeenCalled();
            expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(result.total_amount).toBe(5000);
        });

        it('should throw error if medicine not found', async () => {
            mockMedicineRepository.findOne.mockResolvedValue(null);

            await expect(procurementService.create(createDto, 1)).rejects.toThrow(AppError);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('receiveOrder', () => {
        it('should receive purchase order and create batches', async () => {
            const purchaseOrder = {
                id: 1,
                order_number: 'PO-2024-0001',
                facility_id: 1,
                organization_id: 1,
                status: PurchaseOrderStatus.APPROVED,
                items: [
                    {
                        id: 1,
                        medicine_id: 1,
                        quantity_ordered: 100,
                        quantity_received: 0,
                        unit_price: 50,
                    },
                ],
                supplier: { name: 'ABC Pharma' },
            };

            mockUserRepository.find.mockResolvedValue([]);
            lockedPurchaseOrder = purchaseOrder;
            mockQueryRunner.manager.findOne.mockImplementation((entity: any, _options?: any) => {
                if (entity.name === 'Batch') return Promise.resolve(null);
                if (entity.name === 'PurchaseOrder' || entity === PurchaseOrder) return Promise.resolve(purchaseOrder);
                // for Medicine/Facility queries, return units_per_package=1 to keep math simple
                return Promise.resolve({ id: 1, units_per_package: 1 });
            });

            const mockBatch = {
                id: 1,
                batch_number: 'BATCH-001',
                medicine_id: 1,
                initial_quantity: 100,
                current_quantity: 100,
            };

            mockBatchServiceInstance.create.mockResolvedValue(mockBatch);
            mockStockServiceInstance.addStock.mockResolvedValue({
                id: 1,
                facility_id: 1,
                medicine_id: 1,
                batch_id: 1,
                quantity: 100,
            });

            mockQueryRunner.manager.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const receiveDto = {
                received_items: [
                    {
                        item_id: 1,
                        quantity_received: 100,
                        batch_number: 'BATCH-001',
                        expiry_date: '2025-12-31',
                        manufacturing_date: '2024-01-01',
                        selling_price: 123, // user-supplied selling price
                    },
                ],
            };

            const result = await procurementService.receiveOrder(1, receiveDto, 1, 1);

            expect(result.order.status).toBe(PurchaseOrderStatus.RECEIVED);
            // ensure service attempted to create batch with our supplied selling price (divided by units per package = 123)
            expect(mockBatchServiceInstance.create).toHaveBeenCalled();
            const createdArg = mockBatchServiceInstance.create.mock.calls[0][0];
            expect(createdArg.unit_price).toBeCloseTo(123); // since units_per_package=1
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should handle partial receipt with backorder', async () => {
            const purchaseOrder = {
                id: 1,
                order_number: 'PO-2024-0001',
                facility_id: 1,
                organization_id: 1,
                status: PurchaseOrderStatus.CONFIRMED,
                items: [
                    {
                        id: 1,
                        medicine_id: 1,
                        quantity_ordered: 100,
                        quantity_received: 0,
                        backorder_qty: 0,
                        remaining_qty: 100,
                        unit_price: 50,
                    },
                ],
                supplier: { name: 'ABC Pharma' },
            };

            mockPORepository.findOne.mockResolvedValue(purchaseOrder);
            lockedPurchaseOrder = purchaseOrder;
            mockQueryRunner.manager.findOne.mockImplementation((entity: any, _options?: any) => {
                if (entity.name === 'Batch' || entity === Batch) return Promise.resolve(null);
                if (entity.name === 'PurchaseOrder' || entity === PurchaseOrder) return Promise.resolve(purchaseOrder);
                return Promise.resolve({ id: 1, units_per_package: 10 });
            });
            mockUserRepository.find.mockResolvedValue([]);

            const receiveDto = {
                received_items: [
                    {
                        item_id: 1,
                        quantity_received: 40,
                        backorder_qty: 60,
                        batch_number: 'BATCH-PARTIAL',
                        expiry_date: '2025-12-31',
                    },
                ],
            };

            mockBatchServiceInstance.create.mockResolvedValue({ id: 10 });
            mockQueryRunner.manager.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const result = await procurementService.receiveOrder(1, receiveDto, 1, 1);

            expect(result.order.status).toBe(PurchaseOrderStatus.BACKORDERED);
            const updatedItem = result.order.items[0];
            expect(updatedItem.quantity_received).toBe(40);
            expect(updatedItem.backorder_qty).toBe(60);
            expect(updatedItem.remaining_qty).toBe(0);
        });

        it('should receive into an existing batch instead of skipping duplicate batch number', async () => {
            const purchaseOrder = {
                id: 1,
                order_number: 'PO-2024-EXISTING',
                facility_id: 1,
                organization_id: 1,
                status: PurchaseOrderStatus.CONFIRMED,
                items: [
                    {
                        id: 1,
                        medicine_id: 1,
                        quantity_ordered: 100,
                        quantity_received: 20,
                        backorder_qty: 0,
                        remaining_qty: 80,
                        unit_price: 50,
                    },
                ],
                supplier: { name: 'ABC Pharma' },
            };

            const existingBatch = {
                id: 99,
                medicine_id: 1,
                batch_number: 'BATCH-EXISTING',
                expiry_date: new Date('2025-12-31'),
            };

            mockPORepository.findOne.mockResolvedValue(purchaseOrder);
            mockUserRepository.find.mockResolvedValue([]);
            lockedPurchaseOrder = purchaseOrder;
            mockQueryRunner.manager.findOne.mockImplementation((entity: any, _options?: any) => {
                if (entity.name === 'Batch' || entity === Batch) return Promise.resolve(existingBatch);
                if (entity.name === 'Medicine' || entity === Medicine)
                    return Promise.resolve({ id: 1, units_per_package: 1 });
                if (entity.name === 'Facility' || entity === Facility)
                    return Promise.resolve({ id: 1, default_markup_percent: 20 });
                if (entity.name === 'PurchaseOrder' || entity === PurchaseOrder) return Promise.resolve(purchaseOrder);
                return Promise.resolve(null);
            });

            mockStockServiceInstance.addStock.mockResolvedValue({
                id: 500,
                facility_id: 1,
                medicine_id: 1,
                batch_id: 99,
                quantity: 30,
            });
            mockBatchServiceInstance.increaseQuantity.mockResolvedValue({ ...existingBatch, current_quantity: 30 });
            mockQueryRunner.manager.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const receiveDto = {
                received_items: [
                    {
                        item_id: 1,
                        quantity_received: 10,
                        batch_number: 'BATCH-EXISTING',
                        expiry_date: '2025-12-31',
                    },
                ],
            };

            const result = await procurementService.receiveOrder(1, receiveDto, 1, 1);

            expect(result.skippedItems).toEqual([]);
            expect(mockBatchServiceInstance.create).not.toHaveBeenCalled();
            expect(mockBatchServiceInstance.increaseQuantity).toHaveBeenCalledWith(99, 10, 1);
            expect(mockStockServiceInstance.addStock).toHaveBeenCalledWith(
                1,
                1,
                null,
                null,
                1,
                99,
                10,
                expect.any(Number),
                expect.any(Number),
                expect.objectContaining({
                    type: 'in',
                    reference_type: 'PURCHASE_ORDER',
                }),
            );
            expect(result.order.items[0].quantity_received).toBe(30);
            expect(result.order.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
        });

        it('should handle partial receipt with remaining quantity', async () => {
            const purchaseOrder = {
                id: 1,
                order_number: 'PO-2024-0001',
                facility_id: 1,
                organization_id: 1,
                status: PurchaseOrderStatus.CONFIRMED,
                items: [
                    {
                        id: 1,
                        medicine_id: 1,
                        quantity_ordered: 100,
                        quantity_received: 0,
                        backorder_qty: 0,
                        remaining_qty: 100,
                        unit_price: 50,
                    },
                ],
                supplier: { name: 'ABC Pharma' },
            };

            mockPORepository.findOne.mockResolvedValue(purchaseOrder);
            lockedPurchaseOrder = purchaseOrder;
            mockQueryRunner.manager.findOne.mockImplementation((entity: any, _options?: any) => {
                if (entity.name === 'Batch' || entity === Batch) return Promise.resolve(null);
                if (entity.name === 'PurchaseOrder' || entity === PurchaseOrder) return Promise.resolve(purchaseOrder);
                return Promise.resolve({ id: 1, units_per_package: 10 });
            });
            mockUserRepository.find.mockResolvedValue([]);

            const receiveDto = {
                received_items: [
                    {
                        item_id: 1,
                        quantity_received: 40,
                        // No backorder_qty sent
                        batch_number: 'BATCH-PARTIAL-2',
                        expiry_date: '2025-12-31',
                    },
                ],
            };

            mockBatchServiceInstance.create.mockResolvedValue({ id: 11 });
            mockQueryRunner.manager.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const result = await procurementService.receiveOrder(1, receiveDto, 1, 1);

            expect(result.order.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
            const updatedItem = result.order.items[0];
            expect(updatedItem.quantity_received).toBe(40);
            expect(updatedItem.remaining_qty).toBe(60);
        });

        it('should throw error if order already fully received', async () => {
            const purchaseOrder = {
                id: 1,
                status: PurchaseOrderStatus.RECEIVED,
            };
            mockPORepository.findOne.mockResolvedValue(purchaseOrder);
            lockedPurchaseOrder = purchaseOrder;
            mockQueryRunner.manager.findOne.mockResolvedValue(purchaseOrder);

            await expect(procurementService.receiveOrder(1, { received_items: [] }, 1, 1)).rejects.toThrow(AppError);
        });

        it('should reject receiving when order is still pending approval', async () => {
            const purchaseOrder = {
                id: 1,
                order_number: 'PO-2024-0002',
                facility_id: 1,
                organization_id: 1,
                status: PurchaseOrderStatus.PENDING,
                items: [],
                supplier: { name: 'ABC Pharma' },
            };

            mockPORepository.findOne.mockResolvedValue(purchaseOrder);
            lockedPurchaseOrder = purchaseOrder;
            mockQueryRunner.manager.findOne.mockResolvedValue(purchaseOrder);

            await expect(
                procurementService.receiveOrder(
                    1,
                    {
                        received_items: [
                            { item_id: 1, quantity_received: 1, batch_number: 'B-1', expiry_date: '2026-12-31' },
                        ],
                    } as any,
                    1,
                    1,
                ),
            ).rejects.toThrow(AppError);
        });
    });

    // ---------------------------------------------------------------------------
    // submitRequest
    // ---------------------------------------------------------------------------
    describe('submitRequest', () => {
        let txManager: any;
        beforeEach(() => {
            txManager = (mockPORepository as any)._txManager;
        });

        it('should transition a DRAFT order to SUBMITTED', async () => {
            const draftOrder = {
                id: 10,
                order_number: 'PO-2024-0010',
                status: PurchaseOrderStatus.DRAFT,
                organization_id: 1,
                facility_id: 1,
                supplier: null,
                items: [{ id: 1, medicine_id: 1, quantity_ordered: 10 }],
            };
            txManager.findOne.mockResolvedValue(draftOrder);

            const result = await procurementService.submitRequest(10, 1, 99);
            expect(result.status).toBe(PurchaseOrderStatus.SUBMITTED);
        });

        it('should reject submission if order is not in DRAFT status', async () => {
            const submittedOrder = {
                id: 11,
                status: PurchaseOrderStatus.SUBMITTED,
                organization_id: 1,
                items: [{ id: 1 }],
            };
            txManager.findOne.mockResolvedValue(submittedOrder);

            await expect(procurementService.submitRequest(11, 1, 99)).rejects.toThrow(AppError);
        });

        it('should reject submission if order has no items', async () => {
            const emptyDraft = {
                id: 12,
                status: PurchaseOrderStatus.DRAFT,
                organization_id: 1,
                items: [],
            };
            txManager.findOne.mockResolvedValue(emptyDraft);

            await expect(procurementService.submitRequest(12, 1, 99)).rejects.toThrow(AppError);
        });

        it('should throw 404 if order not found', async () => {
            txManager.findOne.mockResolvedValue(null);
            await expect(procurementService.submitRequest(999, 1, 99)).rejects.toThrow(AppError);
        });
    });

    // ---------------------------------------------------------------------------
    // supplierQuote
    // ---------------------------------------------------------------------------
    describe('supplierQuote', () => {
        let txManager: any;
        beforeEach(() => {
            txManager = (mockPORepository as any)._txManager;
        });

        const buildSubmittedOrder = (overrides = {}) => ({
            id: 20,
            order_number: 'PO-2024-0020',
            status: PurchaseOrderStatus.SUBMITTED,
            organization_id: 1,
            facility_id: 1,
            items: [
                { id: 1, medicine_id: 1, quantity_ordered: 10, status: 'pending' },
                { id: 2, medicine_id: 2, quantity_ordered: 5, status: 'pending' },
            ],
            ...overrides,
        });

        it('should set order to QUOTED when all items are quoted', async () => {
            const order = buildSubmittedOrder();
            txManager.findOne.mockResolvedValue(order);

            const quoteItems = [
                { medicine_id: 1, quoted_unit_price: 100, quantity_available: 10 },
                { medicine_id: 2, quoted_unit_price: 200, quantity_available: 5 },
            ];

            const result = await procurementService.supplierQuote(20, quoteItems, 1);
            expect(result.status).toBe(PurchaseOrderStatus.QUOTED);
        });

        it('should set order to PARTIALLY_QUOTED when only some items are quoted', async () => {
            const order = buildSubmittedOrder();
            txManager.findOne.mockResolvedValue(order);

            // Only quote one item
            const quoteItems = [{ medicine_id: 1, quoted_unit_price: 100, quantity_available: 10 }];

            const result = await procurementService.supplierQuote(20, quoteItems, 1);
            expect(result.status).toBe(PurchaseOrderStatus.PARTIALLY_QUOTED);
        });

        it('should reject quoting an order that is not in submitted/partially_quoted/quoted status', async () => {
            const order = buildSubmittedOrder({ status: PurchaseOrderStatus.ACCEPTED });
            txManager.findOne.mockResolvedValue(order);

            await expect(
                procurementService.supplierQuote(20, [{ medicine_id: 1, quoted_unit_price: 100 }], 1),
            ).rejects.toThrow(AppError);
        });

        it('should throw 404 if order not found', async () => {
            txManager.findOne.mockResolvedValue(null);
            await expect(
                procurementService.supplierQuote(999, [{ medicine_id: 1, quoted_unit_price: 50 }], 1),
            ).rejects.toThrow(AppError);
        });
    });

    // ---------------------------------------------------------------------------
    // reviewQuotation
    // ---------------------------------------------------------------------------
    describe('reviewQuotation', () => {
        let txManager: any;
        beforeEach(() => {
            txManager = (mockPORepository as any)._txManager;
        });

        const buildQuotedOrder = (overrides = {}) => ({
            id: 30,
            order_number: 'PO-2024-0030',
            status: PurchaseOrderStatus.QUOTED,
            organization_id: 1,
            facility_id: 1,
            supplier_id: 5,
            items: [
                {
                    id: 1,
                    medicine_id: 1,
                    quantity_ordered: 10,
                    quoted_unit_price: 100,
                    status: PurchaseOrderItemStatus.QUOTED,
                },
                {
                    id: 2,
                    medicine_id: 2,
                    quantity_ordered: 5,
                    quoted_unit_price: 200,
                    status: PurchaseOrderItemStatus.QUOTED,
                },
            ],
            ...overrides,
        });

        it('should transition to ACCEPTED when all items are accepted', async () => {
            const order = buildQuotedOrder();
            txManager.findOne.mockResolvedValue(order);

            const items = [
                {
                    medicine_id: 1,
                    status: PurchaseOrderItemStatus.ACCEPTED,
                    accepted_unit_price: 100,
                    selling_price: 150,
                },
                {
                    medicine_id: 2,
                    status: PurchaseOrderItemStatus.ACCEPTED,
                    accepted_unit_price: 200,
                    selling_price: 280,
                },
            ];

            const result = await procurementService.reviewQuotation(30, items, 1, 99);
            expect(result.status).toBe(PurchaseOrderStatus.ACCEPTED);
        });

        it('should transition to REJECTED when all items are rejected', async () => {
            const order = buildQuotedOrder();
            txManager.findOne.mockResolvedValue(order);

            const items = [
                { medicine_id: 1, status: PurchaseOrderItemStatus.REJECTED, accepted_unit_price: 0, selling_price: 0 },
                { medicine_id: 2, status: PurchaseOrderItemStatus.REJECTED, accepted_unit_price: 0, selling_price: 0 },
            ];

            const result = await procurementService.reviewQuotation(30, items, 1, 99);
            expect(result.status).toBe(PurchaseOrderStatus.REJECTED);
        });

        it('should transition to PARTIALLY_ACCEPTED when some items accepted, some rejected', async () => {
            const order = buildQuotedOrder();
            txManager.findOne.mockResolvedValue(order);

            const items = [
                {
                    medicine_id: 1,
                    status: PurchaseOrderItemStatus.ACCEPTED,
                    accepted_unit_price: 100,
                    selling_price: 130,
                },
                { medicine_id: 2, status: PurchaseOrderItemStatus.REJECTED, accepted_unit_price: 0, selling_price: 0 },
            ];

            const result = await procurementService.reviewQuotation(30, items, 1, 99);
            expect(result.status).toBe(PurchaseOrderStatus.PARTIALLY_ACCEPTED);
        });

        it('should reject review if order is not in quoted/partially_quoted status', async () => {
            const order = buildQuotedOrder({ status: PurchaseOrderStatus.ACCEPTED });
            txManager.findOne.mockResolvedValue(order);

            await expect(
                procurementService.reviewQuotation(
                    30,
                    [
                        {
                            medicine_id: 1,
                            status: PurchaseOrderItemStatus.ACCEPTED,
                            accepted_unit_price: 100,
                            selling_price: 100,
                        },
                    ],
                    1,
                    99,
                ),
            ).rejects.toThrow(AppError);
        });

        it('should reject review if not all items have an explicit decision', async () => {
            const order = buildQuotedOrder();
            txManager.findOne.mockResolvedValue(order);

            // Only decision for one of the two items
            const items = [
                {
                    medicine_id: 1,
                    status: PurchaseOrderItemStatus.ACCEPTED,
                    accepted_unit_price: 100,
                    selling_price: 130,
                },
            ];

            await expect(procurementService.reviewQuotation(30, items, 1, 99)).rejects.toThrow(AppError);
        });

        it('should throw 404 if order not found', async () => {
            txManager.findOne.mockResolvedValue(null);
            await expect(
                procurementService.reviewQuotation(
                    999,
                    [
                        {
                            medicine_id: 1,
                            status: PurchaseOrderItemStatus.ACCEPTED,
                            accepted_unit_price: 100,
                            selling_price: 100,
                        },
                    ],
                    1,
                    99,
                ),
            ).rejects.toThrow(AppError);
        });
    });

    // ---------------------------------------------------------------------------
    // Multi-tenant isolation
    // ---------------------------------------------------------------------------
    describe('multi-tenant isolation', () => {
        let txManager: any;
        beforeEach(() => {
            txManager = (mockPORepository as any)._txManager;
        });

        it('should not return orders from a different organization', async () => {
            // Simulate TypeORM org-scoped query returning null for a different org
            txManager.findOne.mockImplementation((_entity: any, opts: any) => {
                if (opts?.where?.organization_id === 2) return Promise.resolve(null);
                return Promise.resolve({
                    id: 50,
                    status: PurchaseOrderStatus.DRAFT,
                    organization_id: 1,
                    items: [{ id: 1 }],
                });
            });

            await expect(procurementService.submitRequest(50, 2, 99)).rejects.toThrow(AppError);
        });

        it('should allow access when organization_id matches', async () => {
            const orgAOrder = {
                id: 51,
                status: PurchaseOrderStatus.DRAFT,
                organization_id: 1,
                supplier: null,
                items: [{ id: 1, medicine_id: 1 }],
            };
            txManager.findOne.mockResolvedValue(orgAOrder);

            const result = await procurementService.submitRequest(51, 1, 99);
            expect(result.status).toBe(PurchaseOrderStatus.SUBMITTED);
        });
    });
});
