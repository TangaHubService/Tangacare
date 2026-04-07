// Define mock instances at the top Level (hoisted with jest.mock)
const mockStockServiceInstance = {
    getStockByLocation: jest.fn(),
    deductStock: jest.fn(),
};

const mockAuditServiceInstance = {
    log: jest.fn(),
};

const mockSettingsServiceInstance = {
    getEffectiveValuesMap: jest.fn().mockResolvedValue({}),
};

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        createQueryRunner: jest.fn(),
    },
}));

jest.mock('../stock.service');
jest.mock('../audit.service');
jest.mock('../safety.service');
jest.mock('../settings.service');

import { DispensingService } from '../dispensing.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateDispenseTransactionDto } from '../../../dto/pharmacy.dto';
import { DispenseType } from '../../../entities/DispenseTransaction.entity';
import { Medicine } from '../../../entities/Medicine.entity';
import { Batch } from '../../../entities/Batch.entity';
import { StockService } from '../stock.service';
import { AuditService } from '../audit.service';
import { SafetyService } from '../safety.service';
import { SettingsService } from '../settings.service';

describe('DispensingService', () => {
    let dispensingService: DispensingService;
    let mockDispenseRepository: any;
    let mockQueryRunner: any;
    let mockSafetyServiceInstance: any;

    beforeEach(() => {
        mockDispenseRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockQueryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            manager: {
                save: jest.fn(),
                findOne: jest.fn(),
            },
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            isTransactionActive: true,
        };

        (StockService as any as jest.Mock).mockImplementation(() => mockStockServiceInstance);
        (AuditService as any as jest.Mock).mockImplementation(() => mockAuditServiceInstance);
        (SettingsService as any as jest.Mock).mockImplementation(() => mockSettingsServiceInstance);
        mockSafetyServiceInstance = {
            performSafetyCheck: jest.fn().mockResolvedValue({
                is_safe: true,
                warnings: [],
                errors: [],
            }),
        };
        (SafetyService as any as jest.Mock).mockImplementation(() => mockSafetyServiceInstance);

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            const name = typeof entity === 'function' ? entity.name : entity;
            if (name === 'DispenseTransaction') return mockDispenseRepository;
            return mockDispenseRepository;
        });
        (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

        mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
            if (entity === Medicine) return Promise.resolve({ id: 1, name: 'Medicine', is_controlled_drug: false });
            if (entity === Batch)
                return Promise.resolve({
                    id: 1,
                    id_deleted: false,
                    batch_number: 'BATCH-001',
                    expiry_date: new Date(Date.now() + 86400000),
                });
            return Promise.resolve(null);
        });

        dispensingService = new DispensingService();
        mockStockServiceInstance.getStockByLocation.mockResolvedValue([]);
        mockStockServiceInstance.deductStock.mockResolvedValue({});
        mockAuditServiceInstance.log.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('dispense', () => {
        const createDto: CreateDispenseTransactionDto = {
            facility_id: 1,
            medicine_id: 1,
            batch_id: 1,
            quantity: 10,
            dispense_type: DispenseType.PRESCRIPTION,
            patient_id: 1,
            prescription_id: 1,
        };

        it('should dispense medicine successfully using FEFO', async () => {
            const dispenseDtoWithoutBatch: CreateDispenseTransactionDto = {
                ...createDto,
                batch_id: undefined as any,
            };

            const availableStocks = [
                {
                    id: 1,
                    facility_id: 1,
                    medicine_id: 1,
                    batch_id: 1,
                    quantity: 100,
                    reserved_quantity: 0,
                    unit_price: 100,
                },
            ];

            mockStockServiceInstance.getStockByLocation.mockResolvedValue(availableStocks);
            mockStockServiceInstance.deductStock.mockResolvedValue({ ...availableStocks[0], quantity: 90 });

            mockDispenseRepository.createQueryBuilder.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
                getMany: jest.fn().mockResolvedValue([]),
            });

            const savedTransaction = {
                id: 1,
                transaction_number: 'DISP-2024-0001',
                ...dispenseDtoWithoutBatch,
                batch_id: 1,
                total_amount: 1000,
            };

            mockQueryRunner.manager.save.mockResolvedValue(savedTransaction);

            const result = await dispensingService.dispense(dispenseDtoWithoutBatch, 1);

            expect(mockStockServiceInstance.getStockByLocation).toHaveBeenCalled();
            expect(mockStockServiceInstance.deductStock).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(result.transaction_number).toBeDefined();
        });

        it('should throw error if no stock available', async () => {
            const dispenseDtoWithoutBatch: CreateDispenseTransactionDto = {
                ...createDto,
                batch_id: undefined as any,
            };
            mockStockServiceInstance.getStockByLocation.mockResolvedValue([]);

            await expect(dispensingService.dispense(dispenseDtoWithoutBatch, 1)).rejects.toThrow(AppError);
            await expect(dispensingService.dispense(dispenseDtoWithoutBatch, 1)).rejects.toThrow(
                'No stock available for this medicine at this location',
            );
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should throw error if insufficient stock', async () => {
            const dispenseDtoWithoutBatch: CreateDispenseTransactionDto = {
                ...createDto,
                batch_id: undefined as any,
                quantity: 10,
            };

            const availableStocks = [
                {
                    id: 1,
                    facility_id: 1,
                    medicine_id: 1,
                    batch_id: 1,
                    quantity: 100,
                    reserved_quantity: 95,
                    unit_price: 100,
                },
            ];

            mockStockServiceInstance.getStockByLocation.mockResolvedValue(availableStocks);

            await expect(dispensingService.dispense(dispenseDtoWithoutBatch, 1)).rejects.toThrow(AppError);
            await expect(dispensingService.dispense(dispenseDtoWithoutBatch, 1)).rejects.toThrow('Insufficient stock');
        });
    });

    describe('findAll', () => {
        it('should return paginated dispense transactions', async () => {
            const transactions = [
                { id: 1, transaction_number: 'DISP-001', quantity: 10 },
                { id: 2, transaction_number: 'DISP-002', quantity: 5 },
            ];
            const total = 2;

            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([transactions, total]),
            };

            mockDispenseRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await dispensingService.findAll(1, undefined, 1, 10);

            expect(result.data).toEqual(transactions);
            expect(result.total).toBe(total);
        });
    });
});
