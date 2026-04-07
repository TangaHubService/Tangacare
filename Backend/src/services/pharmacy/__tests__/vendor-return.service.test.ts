import { VendorReturnService } from '../vendor-return.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { VendorReturnStatus, VendorReturnReason } from '../../../entities/VendorReturn.entity';
import { PurchaseOrderStatus } from '../../../entities/PurchaseOrder.entity';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        createQueryRunner: jest.fn(),
    },
}));

const mockAuditServiceInstance = {
    log: jest.fn(),
};

jest.mock('../audit.service', () => ({
    AuditService: jest.fn().mockImplementation(() => mockAuditServiceInstance),
}));

describe('VendorReturnService', () => {
    let vendorReturnService: VendorReturnService;
    let mockVRRepository: any;
    let mockPORepository: any;
    let mockQueryRunner: any;

    beforeEach(() => {
        mockVRRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockPORepository = {
            findOne: jest.fn(),
        };

        mockQueryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            manager: {
                create: jest.fn((_entity: any, data: any) => data),
                save: jest.fn((data: any) => ({ id: 1, ...data })),
                findOne: jest.fn(),
            },
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            isTransactionActive: true,
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity.name === 'VendorReturn' || entity.name === 'vendor_returns') {
                return mockVRRepository;
            }
            if (entity.name === 'PurchaseOrder') {
                return mockPORepository;
            }
            return { findOne: jest.fn() };
        });

        (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

        vendorReturnService = new VendorReturnService();
    });

    describe('createVendorReturn', () => {
        const createDto = {
            purchase_order_id: 1,
            supplier_id: 1,
            reason: 'Damaged items',
            items: [
                {
                    medicine_id: 1,
                    batch_id: 1,
                    quantity_returned: 5,
                    unit_cost: 10,
                    reason: VendorReturnReason.DAMAGED_ARRIVAL,
                },
            ],
        };

        it('should create a vendor return successfully', async () => {
            mockPORepository.findOne.mockResolvedValue({
                id: 1,
                status: PurchaseOrderStatus.RECEIVED,
            });

            mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'Stock') return { quantity: 10 };
                if (entity.name === 'Batch') return { unit_cost: 10 };
                return null;
            });

            mockVRRepository.findOne.mockResolvedValue({ id: 1, return_number: 'VR-001' });

            const result = await vendorReturnService.createVendorReturn(createDto, 1, 1, 1);

            expect(result).toBeDefined();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should throw error if insufficient stock', async () => {
            mockPORepository.findOne.mockResolvedValue({
                id: 1,
                status: PurchaseOrderStatus.RECEIVED,
            });

            mockQueryRunner.manager.findOne.mockResolvedValue({ quantity: 2 });

            await expect(vendorReturnService.createVendorReturn(createDto, 1, 1, 1)).rejects.toThrow(AppError);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('approveVendorReturn', () => {
        it('should approve and deduct stock', async () => {
            const vendorReturn = {
                id: 1,
                return_number: 'VR-001',
                status: VendorReturnStatus.PENDING,
                items: [
                    {
                        medicine_id: 1,
                        batch_id: 1,
                        quantity_returned: 5,
                    },
                ],
            };

            mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'VendorReturn') return vendorReturn;
                if (entity.name === 'Stock') return { quantity: 10, location_id: 1 };
                if (entity.name === 'Batch') return { current_quantity: 10 };
                return null;
            });

            mockVRRepository.findOne.mockResolvedValue({
                ...vendorReturn,
                status: VendorReturnStatus.APPROVED,
            });

            const result = await vendorReturnService.approveVendorReturn(1, 1, 1, 1);

            expect(result.status).toBe(VendorReturnStatus.APPROVED);
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });
    });
});
