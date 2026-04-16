const mockStockServiceInstance = {
    getStockByLocation: jest.fn(),
    deductStock: jest.fn(),
    getEarliestExpiringBatch: jest.fn(),
    checkStockAvailability: jest.fn(),
};

const mockAuditServiceInstance = {
    log: jest.fn(),
};

const mockSettingsServiceInstance = {
    getEffectiveValuesMap: jest.fn().mockResolvedValue({}),
};

const mockCreateSale = jest.fn();

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        createQueryRunner: jest.fn(),
        manager: {
            findOne: jest.fn(),
        },
    },
}));

jest.mock('../stock.service');
jest.mock('../audit.service');
jest.mock('../safety.service');
jest.mock('../settings.service');
jest.mock('../sale.service', () => ({
    SaleService: jest.fn().mockImplementation(() => ({
        createSale: mockCreateSale,
    })),
}));

import { DispensingService } from '../dispensing.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateDispenseTransactionDto } from '../../../dto/pharmacy.dto';
import { DispenseType } from '../../../entities/DispenseTransaction.entity';
import { Medicine } from '../../../entities/Medicine.entity';
import { Batch } from '../../../entities/Batch.entity';
import { User } from '../../../entities/User.entity';
import { StockService } from '../stock.service';
import { AuditService } from '../audit.service';
import { SafetyService } from '../safety.service';
import { SettingsService } from '../settings.service';

describe('DispensingService', () => {
    let dispensingService: DispensingService;
    let mockDispenseRepository: any;

    beforeEach(() => {
        mockCreateSale.mockReset();
        mockDispenseRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        (StockService as any as jest.Mock).mockImplementation(() => mockStockServiceInstance);
        (AuditService as any as jest.Mock).mockImplementation(() => mockAuditServiceInstance);
        (SettingsService as any as jest.Mock).mockImplementation(() => mockSettingsServiceInstance);
        (SafetyService as any as jest.Mock).mockImplementation(() => ({
            performSafetyCheck: jest.fn().mockResolvedValue({
                is_safe: true,
                warnings: [],
                errors: [],
            }),
        }));

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            const name = typeof entity === 'function' ? entity.name : entity;
            if (name === 'DispenseTransaction') return mockDispenseRepository;
            return mockDispenseRepository;
        });

        (AppDataSource.manager.findOne as jest.Mock).mockImplementation((entity: any) => {
            if (entity === Medicine)
                return Promise.resolve({ id: 1, name: 'Medicine', is_controlled_drug: false });
            if (entity === Batch)
                return Promise.resolve({
                    id: 1,
                    batch_number: 'BATCH-001',
                    expiry_date: new Date(Date.now() + 86400000),
                });
            if (entity === User) return Promise.resolve({ id: 1, role: 'admin', license_number: 'LIC-1' });
            return Promise.resolve(null);
        });

        dispensingService = new DispensingService();
        mockStockServiceInstance.getStockByLocation.mockReset();
        mockStockServiceInstance.deductStock.mockReset();
        mockStockServiceInstance.getEarliestExpiringBatch.mockReset();
        mockStockServiceInstance.checkStockAvailability.mockReset();
        mockAuditServiceInstance.log.mockResolvedValue(undefined);

        mockCreateSale.mockResolvedValue({
            sale: {
                id: 42,
                sale_number: 'SALE-2024-0001',
                facility_id: 1,
                organization_id: 1,
                patient_id: 1,
                prescription_id: 1,
                cashier_id: 1,
                patient_id_type: null,
                patient_id_number: null,
                total_amount: 1000,
                created_at: new Date(),
                updated_at: new Date(),
                items: [
                    {
                        medicine_id: 1,
                        batch_id: 1,
                        quantity: 10,
                        unit_price: 100,
                        unit_cost: 50,
                    },
                ],
            },
            warnings: [],
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('dispense', () => {
        const createDto: CreateDispenseTransactionDto = {
            facility_id: 1,
            organization_id: 1,
            medicine_id: 1,
            batch_id: 1,
            quantity: 10,
            dispense_type: DispenseType.PRESCRIPTION,
            patient_id: 1,
            prescription_id: 1,
        };

        it('should record legacy dispense via createSale (unified ledger)', async () => {
            const availableStocks = [
                {
                    id: 1,
                    facility_id: 1,
                    medicine_id: 1,
                    batch_id: 1,
                    quantity: 100,
                    reserved_quantity: 0,
                    unit_price: 100,
                    unit_cost: 50,
                },
            ];

            mockStockServiceInstance.getStockByLocation.mockResolvedValue(availableStocks);

            const result = await dispensingService.dispense(createDto, 1);

            expect(mockCreateSale).toHaveBeenCalled();
            expect(result.transaction_number).toBe('SALE-2024-0001');
            expect(result.id).toBe(42);
            expect(mockAuditServiceInstance.log).toHaveBeenCalled();
        });

        it('should throw error if no stock available', async () => {
            mockStockServiceInstance.getStockByLocation.mockResolvedValue([]);

            await expect(dispensingService.dispense(createDto, 1)).rejects.toThrow(AppError);
            await expect(dispensingService.dispense(createDto, 1)).rejects.toThrow(
                'No stock available for this medicine at this location',
            );
            expect(mockCreateSale).not.toHaveBeenCalled();
        });

        it('should throw error if insufficient stock', async () => {
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

            await expect(dispensingService.dispense(createDto, 1)).rejects.toThrow(AppError);
            await expect(dispensingService.dispense(createDto, 1)).rejects.toThrow('Insufficient stock');
            expect(mockCreateSale).not.toHaveBeenCalled();
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
