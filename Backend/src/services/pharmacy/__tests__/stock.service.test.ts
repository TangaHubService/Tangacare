import { StockService } from '../stock.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { StockQueryDto } from '../../../dto/pharmacy.dto';
import { Stock } from '../../../entities/Stock.entity';
import { Facility } from '../../../entities/Facility.entity';
import { Medicine } from '../../../entities/Medicine.entity';
import { StorageLocation } from '../../../entities/StorageLocation.entity';
import { FacilityMedicineConfig } from '../../../entities/FacilityMedicineConfig.entity';
import { StockMovement } from '../../../entities/StockMovement.entity';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        createQueryRunner: jest.fn(),
    },
}));

jest.mock('../batch.service', () => ({
    BatchService: jest.fn().mockImplementation(() => ({
        decreaseQuantity: jest.fn(),
        increaseQuantity: jest.fn(),
        findOne: jest.fn(),
    })),
}));

jest.mock('../alert.service', () => ({
    AlertService: jest.fn().mockImplementation(() => ({
        checkLowStock: jest.fn().mockResolvedValue(undefined),
    })),
}));

describe('StockService', () => {
    let stockService: StockService;
    let mockStockRepository: any;
    let mockFacilityRepository: any;
    let mockMedicineRepository: any;
    let mockStorageLocationRepository: any;
    let mockFacilityMedicineConfigRepository: any;
    let mockStockMovementRepository: any;

    beforeEach(() => {
        mockStockRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockFacilityRepository = {
            findOne: jest.fn(),
        };

        mockMedicineRepository = {
            findOne: jest.fn(),
        };

        mockStorageLocationRepository = {
            findOne: jest.fn(),
        };

        mockFacilityMedicineConfigRepository = {
            findOne: jest.fn(),
            create: jest.fn((d) => d),
            save: jest.fn((d) => Promise.resolve(d)),
        };

        mockStockMovementRepository = {
            create: jest.fn((d) => d),
            save: jest.fn((d) => Promise.resolve(d)),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity === Stock) return mockStockRepository;
            if (entity === Facility) return mockFacilityRepository;
            if (entity === Medicine) return mockMedicineRepository;
            if (entity === StorageLocation) return mockStorageLocationRepository;
            if (entity === FacilityMedicineConfig) return mockFacilityMedicineConfigRepository;
            if (entity === StockMovement) return mockStockMovementRepository;
            return {};
        });

        stockService = new StockService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('addStock', () => {
        it('should add stock to existing stock record', async () => {
            const existingStock = {
                id: 1,
                facility_id: 1,
                department_id: null,
                medicine_id: 1,
                batch_id: 1,
                quantity: 100,
            };
            mockFacilityRepository.findOne.mockResolvedValue({ id: 1, name: 'Hospital' });
            mockStockRepository.findOne.mockResolvedValue(existingStock);
            mockStockRepository.save.mockResolvedValue({ ...existingStock, quantity: 150 });

            const result = await stockService.addStock(1, 1, null, null, 1, 1, 50);

            expect(mockStockRepository.save).toHaveBeenCalled();
            expect(result.quantity).toBe(150);
        });

        it('should create new stock record if not exists', async () => {
            const newStock = {
                id: 1,
                facility_id: 1,
                department_id: null,
                medicine_id: 1,
                batch_id: 1,
                quantity: 50,
            };
            mockFacilityRepository.findOne.mockResolvedValue({ id: 1 });
            mockStockRepository.findOne.mockResolvedValue(null);
            mockStockRepository.create.mockReturnValue(newStock);
            mockStockRepository.save.mockResolvedValue(newStock);

            const result = await stockService.addStock(1, 1, null, null, 1, 1, 50);

            expect(mockStockRepository.create).toHaveBeenCalled();
            expect(mockStockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(newStock);
        });

        it('should throw error if facility not found', async () => {
            mockFacilityRepository.findOne.mockResolvedValue(null);

            await expect(stockService.addStock(999, 1, null, null, 1, 1, 50)).rejects.toThrow(AppError);
            await expect(stockService.addStock(999, 1, null, null, 1, 1, 50)).rejects.toThrow(
                'Facility not found or access denied',
            );
        });

        it('should correctly update WAC when adding stock', async () => {
            const facility = { id: 1, wac_enabled: true };
            const existingConfig = { id: 1, average_cost: 10, last_purchase_price: 10 };

            mockFacilityRepository.findOne.mockResolvedValue(facility);
            mockStockRepository.findOne.mockResolvedValue(null);
            mockStockRepository.save.mockResolvedValue({ id: 1, quantity: 50 });
            mockMedicineRepository.findOne.mockResolvedValue({ id: 1 });
            mockFacilityMedicineConfigRepository.findOne.mockResolvedValue(existingConfig);

            // Mock getTotalAvailableStock (private call)
            // It calls this.stockRepository.createQueryBuilder
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([{ quantity: 50, reserved_quantity: 0 }]),
            };
            mockStockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await stockService.addStock(1, 1, null, null, 1, 1, 10, 20); // Add 10 units at $20

            // Formula: (40 items at $10 + 10 items at $20) / 50 = (400 + 200) / 50 = 12
            expect(mockFacilityMedicineConfigRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    average_cost: 12,
                    last_purchase_price: 20
                })
            );
        });
    });

    describe('deductStock', () => {
        it('should deduct stock and record movement', async () => {
            const stock = {
                id: 1,
                facility_id: 1,
                medicine_id: 1,
                batch_id: 1,
                quantity: 100,
                reserved_quantity: 0,
                location_id: 1,
                is_frozen: false,
            };
            const mockQueryBuilder = {
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(stock),
            };
            mockStockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
            mockStockRepository.save.mockResolvedValue({ ...stock, quantity: 90 });

            const BatchService = require('../batch.service').BatchService;
            const batchServiceInstance = new BatchService();
            batchServiceInstance.decreaseQuantity = jest.fn().mockResolvedValue({ current_quantity: 90 });

            const result = await stockService.deductStock(1, 1, 10);

            expect(result.quantity).toBe(90);
            expect(mockStockRepository.save).toHaveBeenCalled();
        });

        it('should throw error if insufficient stock', async () => {
            const stock = { id: 1, quantity: 5, batch_id: 1, is_frozen: false };
            const mockQueryBuilder = {
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(stock),
            };
            mockStockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await expect(stockService.deductStock(1, 1, 10)).rejects.toThrow(AppError);
            await expect(stockService.deductStock(1, 1, 10)).rejects.toThrow('Insufficient stock');
        });

        it('should throw error if stock is frozen during deduction', async () => {
            const frozenStock = { id: 1, is_frozen: true };
            const mockQueryBuilder = {
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(frozenStock),
            };
            mockStockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await expect(stockService.deductStock(1, 1, 10)).rejects.toThrow(AppError);
            await expect(stockService.deductStock(1, 1, 10)).rejects.toThrow('Stock is currently frozen');
        });
    });

    describe('getBatchCost', () => {
        it('returns batch unit_cost when set', async () => {
            const batchSvc = (stockService as any).batchService;
            batchSvc.findOne.mockResolvedValue({ id: 1, unit_cost: 42.5 });

            const cost = await stockService.getBatchCost(1, 1);
            expect(cost).toBe(42.5);
        });

        it('falls back to stock row unit_cost when batch cost missing', async () => {
            const batchSvc = (stockService as any).batchService;
            batchSvc.findOne.mockResolvedValue({ id: 1, unit_cost: null });

            const qb = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ unit_cost: '7.25' }),
            };
            mockStockRepository.createQueryBuilder.mockReturnValue(qb);

            const cost = await stockService.getBatchCost(1, 1);
            expect(cost).toBe(7.25);
        });

        it('returns 0 when no cost on batch or stock', async () => {
            const batchSvc = (stockService as any).batchService;
            batchSvc.findOne.mockResolvedValue({ id: 1, unit_cost: 0 });

            const qb = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue(null),
            };
            mockStockRepository.createQueryBuilder.mockReturnValue(qb);

            const cost = await stockService.getBatchCost(1, 1);
            expect(cost).toBe(0);
        });
    });

    describe('getStock', () => {
        it('should return paginated stock list', async () => {
            const stocks = [
                { id: 1, facility_id: 1, medicine_id: 1, quantity: 100 },
                { id: 2, facility_id: 1, medicine_id: 2, quantity: 50 },
            ];
            const total = 2;

            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([stocks, total]),
            };

            mockStockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const query: StockQueryDto = { page: 1, limit: 10, facility_id: 1 };
            const result = await stockService.getStock(query);

            expect(result.data).toEqual(stocks);
            expect(result.total).toBe(total);
        });
    });
});
