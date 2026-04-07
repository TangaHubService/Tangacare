import { SaleService } from '../sale.service';
import { AppDataSource } from '../../../config/database';
import { CreateSaleDto } from '../../../dto/pharmacy.dto';
import { DispenseType } from '../../../entities/DispenseTransaction.entity';
import { AuditAction } from '../../../entities/AuditLog.entity';
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
            'controlled_medicines.rules_enabled': true,
            'controlled_medicines.require_prescription': true,
            'controlled_medicines.require_patient_id': false,
            'inventory_rules.fefo_strict': true,
            'tax_fiscal.vat_enabled': true,
            'currency_pricing.base_currency': 'RWF',
        }),
        normalizeVatRateToDecimal: jest.fn().mockImplementation(async (vatRate?: number) => {
            if (typeof vatRate === 'number') return vatRate;
            return 0.18;
        }),
        getEffectiveValue: jest.fn().mockResolvedValue('RWF'),
    })),
}));

const StockService = require('../stock.service').StockService;
const AuditService = require('../audit.service').AuditService;

describe('SaleService', () => {
    let saleService: SaleService;
    let mockEntityManager: any;
    let mockSaleRepo: any;
    let mockSaleItemRepo: any;
    let mockSalePaymentRepo: any;
    let mockBatchRepo: any;
    let mockStockRepo: any;
    let mockStockService: any;
    let mockAuditService: any;

    beforeEach(() => {
        // Setup Mocks
        mockSaleRepo = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
            })),
        };
        mockSaleItemRepo = {
            create: jest.fn(),
            save: jest.fn(),
        };
        mockSalePaymentRepo = {
            create: jest.fn(),
            save: jest.fn((payment: any) =>
                Promise.resolve({
                    id: 1,
                    ...payment,
                }),
            ),
        };
        mockBatchRepo = {
            findOne: jest.fn(),
        };
        mockStockRepo = {
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue({
                    id: 1,
                    is_frozen: false,
                }),
            })),
        };

        mockEntityManager = {
            getRepository: jest.fn((entity) => {
                if (entity === Sale) return mockSaleRepo;
                if (entity.name === 'SaleItem') return mockSaleItemRepo;
                if (entity.name === 'SalePayment') return mockSalePaymentRepo;
                if (entity === Batch) return mockBatchRepo;
                if (entity === Stock) return mockStockRepo;
                return {};
            }),
            findOne: jest.fn(),
        };

        (AppDataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
            return await cb(mockEntityManager);
        });

        // Mock StockService instance
        mockStockService = {
            checkStockAvailability: jest.fn().mockResolvedValue(true),
            getBatchCost: jest.fn().mockResolvedValue(100),
            deductStockForSale: jest.fn().mockResolvedValue(true),
            deductStock: jest.fn().mockResolvedValue(true),
            getEarliestExpiringBatch: jest.fn().mockResolvedValue(null),
        };
        (StockService as jest.Mock).mockImplementation(() => mockStockService);

        // Mock AuditService instance
        mockAuditService = {
            log: jest.fn(),
        };
        (AuditService as jest.Mock).mockImplementation(() => mockAuditService);

        saleService = new SaleService();
        // Manually inject saleRepository for generateSaleNumber if valid
        (saleService as any).saleRepository = mockSaleRepo;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createSale', () => {
        const validSaleDto: CreateSaleDto = {
            patient_id: 1,
            items: [{ medicine_id: 1, batch_id: 101, quantity: 2, unit_price: 500 }],
            payments: [{ method: 'cash', amount: 1000 }],
            vat_rate: 0,
            dispense_type: DispenseType.OTC,
        };

        it('should successfully create a sale with single payment', async () => {
            mockBatchRepo.findOne.mockResolvedValue({
                id: 101,
                expiry_date: new Date(Date.now() + 10000000), // Future date
                medicine: { name: 'Paracetamol' },
            });
            mockSaleRepo.create.mockReturnValue({ id: 1, ...validSaleDto });
            mockSaleRepo.save.mockResolvedValue({ id: 1, ...validSaleDto });
            mockSaleItemRepo.create.mockReturnValue({});
            mockSalePaymentRepo.create.mockReturnValue({});
            mockSaleRepo.findOne.mockResolvedValue({ id: 1, status: 'PAID' });

            const result = await saleService.createSale(validSaleDto, 1, 1, 1);

            expect(AppDataSource.transaction).toHaveBeenCalled();
            expect(mockStockService.checkStockAvailability).toHaveBeenCalled();
            expect(mockSaleRepo.save).toHaveBeenCalled();
            expect(mockStockService.deductStockForSale).toHaveBeenCalled();
            expect(mockSalePaymentRepo.save).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should successfully create a sale with multiple payments', async () => {
            const multiPaymentDto = {
                ...validSaleDto,
                payments: [
                    { method: 'cash', amount: 500 },
                    { method: 'mobile_money', amount: 500, reference: 'TX123' },
                ],
            };

            mockBatchRepo.findOne.mockResolvedValue({
                id: 101,
                expiry_date: new Date(Date.now() + 10000000),
                medicine: { name: 'Paracetamol' },
            });
            mockSaleRepo.create.mockReturnValue({ id: 1 });
            mockSaleRepo.save.mockResolvedValue({ id: 1 });
            mockSaleRepo.findOne.mockResolvedValue({ id: 1, status: 'PAID' });

            await saleService.createSale(multiPaymentDto as any, 1, 1, 1);

            expect(mockSalePaymentRepo.create).toHaveBeenCalledTimes(2);
            expect(mockSalePaymentRepo.save).toHaveBeenCalledTimes(2);
        });

        it('should throw error and not save sale if stock is insufficient', async () => {
            mockBatchRepo.findOne.mockResolvedValue({
                id: 101,
                expiry_date: new Date(Date.now() + 10000000),
                medicine: { name: 'Paracetamol' },
            });
            mockStockService.checkStockAvailability.mockResolvedValue(false);

            await expect(saleService.createSale(validSaleDto, 1, 1, 1)).rejects.toThrow('Insufficient stock');

            expect(mockSaleRepo.save).not.toHaveBeenCalled();
            expect(mockStockService.deductStockForSale).not.toHaveBeenCalled();
        });

        it('should throw error if batch is expired', async () => {
            mockBatchRepo.findOne.mockResolvedValue({
                id: 101,
                expiry_date: new Date(Date.now() - 10000000), // Past date
                batch_number: 'B123',
                medicine: { name: 'Paracetamol' },
            });

            await expect(saleService.createSale(validSaleDto, 1, 1, 1)).rejects.toThrow(/Cannot sell expired item/);

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: AuditAction.ACCESS_DENIED,
                    description: expect.stringContaining('BLOCKED: Attempted to sell expired item'),
                }),
            );
            expect(mockSaleRepo.save).not.toHaveBeenCalled();
        });

        it('should throw error if selling price is below cost', async () => {
            mockBatchRepo.findOne.mockResolvedValue({
                id: 101,
                expiry_date: new Date(Date.now() + 10000000),
                medicine: { name: 'Paracetamol' },
            });
            mockStockService.checkStockAvailability.mockResolvedValue(true);
            mockStockService.getBatchCost.mockResolvedValue(600); // Cost 600, Price 500

            await expect(saleService.createSale(validSaleDto, 1, 1, 1)).rejects.toThrow(
                /Selling price cannot be below cost/,
            );

            expect(mockSaleRepo.save).not.toHaveBeenCalled();
        });

        it('should use selected stock row when stock_id is provided', async () => {
            const saleWithStockId: CreateSaleDto = {
                ...validSaleDto,
                items: [{ medicine_id: 1, batch_id: 101, stock_id: 77, quantity: 2, unit_price: 500 }],
            };

            mockStockRepo.findOne = jest.fn().mockResolvedValue({
                id: 77,
                facility_id: 1,
                medicine_id: 1,
                batch_id: 101,
                quantity: 10,
                reserved_quantity: 0,
                is_frozen: false,
                is_deleted: false,
            });
            mockBatchRepo.findOne.mockResolvedValue({
                id: 101,
                expiry_date: new Date(Date.now() + 10000000),
                medicine: { name: 'Paracetamol' },
            });
            mockSaleRepo.create.mockReturnValue({ id: 1, ...saleWithStockId });
            mockSaleRepo.save.mockResolvedValue({ id: 1, ...saleWithStockId });
            mockSaleItemRepo.create.mockReturnValue({});
            mockSalePaymentRepo.create.mockReturnValue({});
            mockSaleRepo.findOne.mockResolvedValue({ id: 1, status: 'PAID' });

            await saleService.createSale(saleWithStockId, 1, 1, 1);

            expect(mockStockService.deductStock).toHaveBeenCalledWith(
                77,
                1,
                2,
                expect.objectContaining({
                    reference_type: 'sale',
                }),
            );
            expect(mockStockService.deductStockForSale).not.toHaveBeenCalled();
        });
    });
});
