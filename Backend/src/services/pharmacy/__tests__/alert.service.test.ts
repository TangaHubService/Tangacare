jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

jest.mock('../inventory-notification.service', () => ({
    InventoryNotificationService: jest.fn().mockImplementation(() => ({
        notifyLowStock: jest.fn().mockResolvedValue(undefined),
        notifyExpiry: jest.fn().mockResolvedValue(undefined),
    })),
}));

import { AlertService } from '../alert.service';
import { AppDataSource } from '../../../config/database';
import { AlertType, AlertStatus } from '../../../entities/Alert.entity';

describe('AlertService', () => {
    let service: AlertService;
    let mockAlertRepository: any;
    let mockStockRepository: any;
    let mockMedicineRepository: any;
    let mockFacilityRepository: any;
    let mockSettingsRepository: any;

    beforeEach(() => {
        mockAlertRepository = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockImplementation(async (v: any) => ({ id: 1, ...v })),
            create: jest.fn().mockImplementation((v: any) => ({ ...v })),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
        };

        mockStockRepository = {
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([{ medicine_id: '1', total_quantity: '5' }]),
            }),
            find: jest.fn().mockResolvedValue([]),
        };

        mockMedicineRepository = {
            findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Paracetamol', min_stock_level: 10 }),
        };

        mockFacilityRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: 1,
                expiry_critical_days: 30,
                expiry_warning_days: 60,
                expiry_alert_days: 90,
            }),
        };

        mockSettingsRepository = {
            findOne: jest.fn().mockResolvedValue(null),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
            const name = typeof entity === 'function' ? entity.name : entity?.name || entity;
            if (name === 'Alert') return mockAlertRepository;
            if (name === 'Stock') return mockStockRepository;
            if (name === 'Facility') return mockFacilityRepository;
            if (name === 'Medicine') return mockMedicineRepository;
            if (name === 'MedicineFacilitySetting') return mockSettingsRepository;
            return mockAlertRepository;
        });

        service = new AlertService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('checkLowStock creates low-stock alert candidates', async () => {
        await service.checkLowStock(1, 1);

        expect(mockStockRepository.createQueryBuilder).toHaveBeenCalled();
        const qb = mockStockRepository.createQueryBuilder.mock.results[0].value;
        expect(qb.andWhere).toHaveBeenCalledWith('stock.is_deleted = :isDeleted', { isDeleted: false });
        expect(mockAlertRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                facility_id: 1,
                organization_id: 1,
                alert_type: AlertType.LOW_STOCK,
                status: AlertStatus.ACTIVE,
                medicine_id: 1,
            }),
        );
        expect(mockAlertRepository.save).toHaveBeenCalled();
    });

    it('runAllChecks executes without errors', async () => {
        await expect(service.runAllChecks(1, 1)).resolves.toBeUndefined();
    });

    it('findAll returns paginated alerts', async () => {
        mockAlertRepository.findAndCount.mockResolvedValue([
            [{ id: 1, alert_type: AlertType.LOW_STOCK, status: AlertStatus.ACTIVE }],
            1,
        ]);

        const result = await service.findAll(1, 1, 'active', undefined, 1, 10);
        expect(result.total).toBe(1);
        expect(result.data[0].alert_type).toBe(AlertType.LOW_STOCK);
    });
});
