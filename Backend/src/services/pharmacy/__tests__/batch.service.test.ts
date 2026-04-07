import { BatchService } from '../batch.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateBatchDto } from '../../../dto/pharmacy.dto';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('BatchService', () => {
    let batchService: BatchService;
    let mockBatchRepository: any;
    let mockMedicineRepository: any;

    beforeEach(() => {
        mockBatchRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockMedicineRepository = {
            findOne: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity.name === 'Batch') {
                return mockBatchRepository;
            }
            return mockMedicineRepository;
        });

        batchService = new BatchService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        const createDto: CreateBatchDto = {
            medicine_id: 1,
            batch_number: 'BATCH-2024-001',
            expiry_date: '2025-12-31',
            manufacturing_date: '2024-01-01',
            initial_quantity: 1000,
            unit_cost: 45,
        };

        it('should create a new batch successfully', async () => {
            mockMedicineRepository.findOne.mockResolvedValue({ id: 1, name: 'Paracetamol' });
            mockBatchRepository.findOne.mockResolvedValue(null);
            const savedBatch = { ...createDto, id: 1, current_quantity: 1000 };
            mockBatchRepository.create.mockReturnValue(savedBatch);
            mockBatchRepository.save.mockResolvedValue(savedBatch);

            const result = await batchService.create(createDto, 1);

            expect(mockMedicineRepository.findOne).toHaveBeenCalledWith({
                where: { id: createDto.medicine_id, organization_id: 1 },
            });
            expect(mockBatchRepository.create).toHaveBeenCalled();
            expect(result.current_quantity).toBe(createDto.initial_quantity);
        });

        it('should throw error if medicine not found', async () => {
            mockMedicineRepository.findOne.mockResolvedValue(null);

            await expect(batchService.create(createDto, 1)).rejects.toThrow(AppError);
            await expect(batchService.create(createDto, 1)).rejects.toThrow('Medicine not found in your organization');
        });

        it('should throw error if batch number already exists for medicine', async () => {
            mockMedicineRepository.findOne.mockResolvedValue({ id: 1 });
            mockBatchRepository.findOne.mockResolvedValue({ id: 1, batch_number: 'BATCH-2024-001' });

            await expect(batchService.create(createDto, 1)).rejects.toThrow(AppError);
            await expect(batchService.create(createDto, 1)).rejects.toThrow(
                'Batch with this number already exists for this medicine',
            );
        });

        it('should throw error if expiry date is before manufacturing date', async () => {
            const invalidDto = {
                ...createDto,
                expiry_date: '2023-12-31',
                manufacturing_date: '2024-01-01',
            };
            mockMedicineRepository.findOne.mockResolvedValue({ id: 1 });
            mockBatchRepository.findOne.mockResolvedValue(null);

            await expect(batchService.create(invalidDto, 1)).rejects.toThrow(AppError);
            await expect(batchService.create(invalidDto, 1)).rejects.toThrow(
                'Expiry date must be after manufacturing date',
            );
        });
    });

    describe('decreaseQuantity', () => {
        it('should decrease batch quantity successfully', async () => {
            const batch = { id: 1, current_quantity: 100, batch_number: 'BATCH-001' };

            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(batch),
            };
            mockBatchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            mockBatchRepository.save.mockResolvedValue({ ...batch, current_quantity: 90 });

            const result = await batchService.decreaseQuantity(1, 10, 1);

            expect(result.current_quantity).toBe(90);
            expect(mockBatchRepository.save).toHaveBeenCalled();
        });

        it('should throw error if insufficient quantity', async () => {
            const batch = { id: 1, current_quantity: 5, batch_number: 'BATCH-001' };

            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(batch),
            };
            mockBatchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await expect(batchService.decreaseQuantity(1, 10, 1)).rejects.toThrow(AppError);
            await expect(batchService.decreaseQuantity(1, 10, 1)).rejects.toThrow('Insufficient quantity');
        });
    });

    describe('getExpiringBatches', () => {
        it('should return batches expiring within specified days', async () => {
            const expiringBatches = [{ id: 1, batch_number: 'BATCH-001', expiry_date: new Date('2024-12-31') }];
            mockBatchRepository.find.mockResolvedValue(expiringBatches);

            const result = await batchService.getExpiringBatches(1, 30);

            expect(result).toEqual(expiringBatches);
            expect(mockBatchRepository.find).toHaveBeenCalled();
        });
    });
});
