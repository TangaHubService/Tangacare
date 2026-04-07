import { DisposalService } from '../disposal.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { DisposalStatus, DisposalType, DisposalReason } from '../../../entities/DisposalRequest.entity';

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

const mockStockServiceInstance = {
    deductStock: jest.fn(),
};

jest.mock('../stock.service', () => ({
    StockService: jest.fn().mockImplementation(() => mockStockServiceInstance),
}));

describe('DisposalService', () => {
    let disposalService: DisposalService;
    let mockDisposalRepository: any;
    let mockDisposalItemRepository: any;
    let mockQueryRunner: any;

    beforeEach(() => {
        mockDisposalRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockDisposalItemRepository = {
            create: jest.fn(),
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
            if (entity.name === 'DisposalRequest') return mockDisposalRepository;
            if (entity.name === 'DisposalItem') return mockDisposalItemRepository;
            return { findOne: jest.fn() };
        });

        (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

        disposalService = new DisposalService();
    });

    describe('createDisposalRequest', () => {
        const createDto = {
            facility_id: 1,
            type: DisposalType.REGULAR,
            reason: DisposalReason.EXPIRED,
            items: [
                {
                    medicine_id: 1,
                    batch_id: 1,
                    quantity: 10,
                },
            ],
        };

        it('should create a disposal request successfully', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValue({
                id: 1,
                quantity: 20,
                unit_cost: 100,
            });

            mockDisposalRepository.create.mockReturnValue({ ...createDto, id: 1, request_number: 'DISP-001' });

            const result = await disposalService.createDisposalRequest(createDto, 1);

            expect(result).toBeDefined();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(mockAuditServiceInstance.log).toHaveBeenCalled();
        });

        it('should throw error if insufficient stock', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValue({
                id: 1,
                quantity: 5,
            });

            await expect(disposalService.createDisposalRequest(createDto, 1)).rejects.toThrow(AppError);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('postDisposalRequest', () => {
        it('should deduct stock and move status to POSTED', async () => {
            const request = {
                id: 1,
                request_number: 'DISP-001',
                status: DisposalStatus.APPROVED,
                facility_id: 1,
                organization_id: 1,
                reason: DisposalReason.EXPIRED,
                items: [
                    {
                        medicine_id: 1,
                        batch_id: 1,
                        quantity: 10,
                    },
                ],
            };

            mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DisposalRequest') return request;
                if (entity.name === 'Stock') return { id: 100, quantity: 50 };
                return null;
            });

            const result = await disposalService.postDisposalRequest(1, 1, 7);

            expect(result.status).toBe(DisposalStatus.POSTED);
            expect(mockStockServiceInstance.deductStock).toHaveBeenCalledWith(100, 1, 10, expect.any(Object));
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should throw error if controlled drugs disposal lacks witness', async () => {
            const request = {
                id: 1,
                status: DisposalStatus.APPROVED,
                type: DisposalType.CONTROLLED,
                witness_by_id: null,
                items: [],
            };

            mockQueryRunner.manager.findOne.mockResolvedValue(request);

            await expect(disposalService.postDisposalRequest(1, 1, 7)).rejects.toThrow(
                'Controlled drugs disposal require a witness signature',
            );
        });
    });
});
