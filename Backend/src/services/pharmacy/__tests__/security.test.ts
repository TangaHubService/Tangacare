import { SaleService } from '../sale.service';
import { AppDataSource } from '../../../config/database';
import { CreateSaleDto } from '../../../dto/pharmacy.dto';
import { DispenseType } from '../../../entities/DispenseTransaction.entity';
import { Stock } from '../../../entities/Stock.entity';
import { Batch } from '../../../entities/Batch.entity';
import { Sale } from '../../../entities/Sale.entity';

// Mock dependencies
jest.mock('../../../config/database', () => ({
    AppDataSource: {
        transaction: jest.fn(),
        getRepository: jest.fn(),
    },
}));

jest.mock('../stock.service');
jest.mock('../audit.service');
jest.mock('../settings.service', () => ({
    SettingsService: jest.fn().mockImplementation(() => ({
        getEffectiveValuesMap: jest.fn().mockResolvedValue({
            'inventory_rules.fefo_strict': true,
            'tax_fiscal.vat_enabled': true,
        }),
        normalizeVatRateToDecimal: jest.fn().mockResolvedValue(0.18),
        getEffectiveValue: jest.fn().mockResolvedValue('RWF'),
    })),
}));

const StockService = require('../stock.service').StockService;
const AuditService = require('../audit.service').AuditService;
jest.mock('../audit.service', () => ({
    AuditService: jest.fn().mockImplementation(() => ({
        log: jest.fn().mockResolvedValue(true)
    }))
}));

describe('Pharmacy Security Tests', () => {
    let saleService: SaleService;
    let mockEntityManager: any;
    let mockStockRepo: any;
    let mockBatchRepo: any;
    let mockStockService: any;
    let mockAuditService: any;

    beforeEach(() => {
        // Mock AuditService instance
        mockAuditService = {
            log: jest.fn(),
        };
        (AuditService as jest.Mock).mockImplementation(() => mockAuditService);

        mockStockRepo = {
            findOne: jest.fn(),
            getRepository: jest.fn().mockReturnThis(),
            createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn(),
            })),
        };

        mockBatchRepo = {
            findOne: jest.fn(),
        };

        mockEntityManager = {
            getRepository: jest.fn((entity) => {
                if (entity === Stock) return mockStockRepo;
                if (entity === Batch) return mockBatchRepo;
                if (entity === Sale) return { create: jest.fn(), save: jest.fn() };
                return { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
            }),
        };

        (AppDataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
            return await cb(mockEntityManager);
        });

        mockStockService = {
            checkStockAvailability: jest.fn().mockResolvedValue(true),
            getBatchCost: jest.fn().mockResolvedValue(100),
            deductStock: jest.fn().mockResolvedValue(true),
            getEarliestExpiringBatch: jest.fn().mockResolvedValue(null),
        };
        (StockService as jest.Mock).mockImplementation(() => mockStockService);

        saleService = new SaleService();
    });

    describe('Cross-Tenant Data Isolation', () => {
        it('should block sale if stock_id belongs to a different facility', async () => {
            const maliciousDto: CreateSaleDto = {
                items: [{
                    medicine_id: 1,
                    batch_id: 101,
                    stock_id: 999, //Maliciously provided stock_id from another tenant
                    quantity: 1,
                    unit_price: 500
                }],
                payments: [{ method: 'cash', amount: 500 }],
                dispense_type: DispenseType.OTC,
            };

            // Mock findOne to return null when filtered by the correct facilityId
            mockStockRepo.findOne.mockResolvedValue(null);

            await expect(saleService.createSale(maliciousDto, 1, 10, 77)) // Facility 10
                .rejects.toThrow(/Selected stock row 999 is not available/);

            // Verify that the query included the correct facility_id filter
            expect(mockStockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    id: 999,
                    facility_id: 10, // Correctly enforced facility barrier
                    organization_id: 77,
                })
            }));
        });

        it('should block sale if batch is not available in the facility', async () => {
            const maliciousDto: CreateSaleDto = {
                items: [{
                    medicine_id: 1,
                    batch_id: 888, // Batch from another tenant
                    quantity: 1,
                    unit_price: 500
                }],
                payments: [{ method: 'cash', amount: 500 }],
                dispense_type: DispenseType.OTC,
            };

            // Mock batch - should not be found when filtered by correct facility_id
            mockBatchRepo.findOne.mockResolvedValue(null);

            await expect(saleService.createSale(maliciousDto, 1, 10, 77)) // Facility 10
                .rejects.toThrow(/Batch row is not available/);
        });
    });
});
