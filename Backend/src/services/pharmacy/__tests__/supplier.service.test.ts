import { SupplierService } from '../supplier.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateSupplierDto, UpdateSupplierDto } from '../../../dto/pharmacy.dto';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

jest.mock('../audit.service', () => ({
    AuditService: jest.fn().mockImplementation(() => ({
        log: jest.fn().mockResolvedValue({}),
    })),
}));

describe('SupplierService', () => {
    let supplierService: SupplierService;
    let mockRepository: any;

    beforeEach(() => {
        mockRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            softRemove: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
        supplierService = new SupplierService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        const createDto: CreateSupplierDto = {
            name: 'ABC Pharmaceuticals Ltd',
            contact_person: 'John Smith',
            phone: '+250788123456',
            email: 'contact@abcpharma.com',
            address: '123 Business Park',
        };

        it('should create a new supplier successfully', async () => {
            const savedSupplier = { ...createDto, id: 1, is_active: true, created_at: new Date() };
            mockRepository.create.mockReturnValue(savedSupplier);
            mockRepository.save.mockResolvedValue(savedSupplier);

            const result = await supplierService.create(createDto, 1, 10);

            expect(mockRepository.create).toHaveBeenCalledWith({
                ...createDto,
                organization_id: 1,
            });
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(savedSupplier);
        });
    });

    describe('findOne', () => {
        it('should return supplier if found', async () => {
            const supplier = {
                id: 1,
                name: 'ABC Pharmaceuticals Ltd',
                is_active: true,
            };
            mockRepository.findOne.mockResolvedValue(supplier);

            const result = await supplierService.findOne(1, 1);

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 1, organization_id: 1 },
                relations: ['purchase_orders'],
            });
            expect(result).toEqual(supplier);
        });

        it('should throw error if supplier not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(supplierService.findOne(999, 1)).rejects.toThrow(AppError);
            await expect(supplierService.findOne(999, 1)).rejects.toThrow('Supplier not found');
        });
    });

    describe('findAll', () => {
        it('should return paginated list of suppliers', async () => {
            const suppliers = [
                { id: 1, name: 'ABC Pharma', is_active: true },
                { id: 2, name: 'XYZ Pharma', is_active: true },
            ];
            const total = 2;

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([suppliers, total]),
            };

            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await supplierService.findAll(1, 1, 1, 10);

            expect(result.data).toEqual(suppliers);
            expect(result.total).toBe(total);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });
    });

    describe('update', () => {
        it('should update supplier successfully', async () => {
            const existingSupplier = {
                id: 1,
                name: 'ABC Pharmaceuticals',
                is_active: true,
            };
            const updateDto: UpdateSupplierDto = {
                name: 'ABC Pharmaceuticals Ltd',
                is_active: false,
            };
            const updatedSupplier = { ...existingSupplier, ...updateDto };

            mockRepository.findOne.mockResolvedValue(existingSupplier);
            mockRepository.save.mockResolvedValue(updatedSupplier);

            const result = await supplierService.update(1, updateDto, 1, 1);

            expect(mockRepository.save).toHaveBeenCalled();
            expect(result.name).toBe('ABC Pharmaceuticals Ltd');
        });
    });

    describe('delete', () => {
        it('should delete supplier successfully', async () => {
            const supplier = { id: 1, name: 'ABC Pharmaceuticals' };
            mockRepository.findOne.mockResolvedValue(supplier);
            mockRepository.softRemove.mockResolvedValue(supplier);

            await supplierService.delete(1, 1, 1);

            expect(mockRepository.softRemove).toHaveBeenCalledWith(supplier);
        });
    });
});
