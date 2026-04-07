import { PhysicalCountService } from '../physical-count.service';
import { AppDataSource } from '../../../config/database';
import { PhysicalCountStatus } from '../../../entities/PhysicalCount.entity';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        transaction: jest.fn(),
    },
}));

describe('PhysicalCountService', () => {
    let service: PhysicalCountService;
    let mockPhysicalCountRepository: any;
    let mockPhysicalCountItemRepository: any;

    beforeEach(() => {
        mockPhysicalCountRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        };
        mockPhysicalCountItemRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity.name === 'PhysicalCount') return mockPhysicalCountRepository;
            if (entity.name === 'PhysicalCountItem') return mockPhysicalCountItemRepository;
            return {};
        });

        service = new PhysicalCountService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('freezePhysicalCount', () => {
        it('should freeze stocks and update count status to frozen', async () => {
            const mockCount = {
                id: 1,
                facility_id: 1,
                status: PhysicalCountStatus.IN_PROGRESS,
                items: [
                    { medicine_id: 1, batch_id: 1, location_id: null },
                    { medicine_id: 2, batch_id: 2, location_id: 5 },
                ],
            };

            const mockManager = {
                findOne: jest.fn().mockResolvedValue(mockCount),
                update: jest.fn().mockResolvedValue({}),
                save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
            };

            (AppDataSource.transaction as jest.Mock).mockImplementation((cb) => cb(mockManager));

            const result = await service.freezePhysicalCount(1, 1);

            expect(mockManager.findOne).toHaveBeenCalled();
            expect(mockManager.update).toHaveBeenCalledTimes(2);
            expect(result.status).toBe(PhysicalCountStatus.FROZEN);
        });

        it('should throw error if count is not in_progress', async () => {
            const mockCount = {
                id: 1,
                status: PhysicalCountStatus.COMPLETED,
            };

            const mockManager = {
                findOne: jest.fn().mockResolvedValue(mockCount),
            };

            (AppDataSource.transaction as jest.Mock).mockImplementation((cb) => cb(mockManager));

            await expect(service.freezePhysicalCount(1, 1)).rejects.toThrow('Only counts in progress can be frozen');
        });
    });

    describe('approvePhysicalCount', () => {
        it('should unfreeze stocks and set status to approved', async () => {
            const mockCount = {
                id: 1,
                facility_id: 1,
                status: PhysicalCountStatus.FROZEN,
                items: [
                    { medicine_id: 1, batch_id: 1, location_id: null, variance: 0 },
                ],
            };

            const mockManager = {
                findOne: jest.fn().mockImplementation((entity) => {
                    if (entity.name === 'PhysicalCount') return Promise.resolve(mockCount);
                    return Promise.resolve(null);
                }),
                update: jest.fn().mockResolvedValue({}),
                save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
            };

            (AppDataSource.transaction as jest.Mock).mockImplementation((cb) => cb(mockManager));

            const result = await service.approvePhysicalCount(1, 1, 12);

            expect(mockManager.update).toHaveBeenCalled();
            expect(result.status).toBe(PhysicalCountStatus.APPROVED);
        });
    });
});
