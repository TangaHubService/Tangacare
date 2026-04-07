import { FacilityService } from '../facility.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateFacilityDto, UpdateFacilityDto } from '../../../dto/pharmacy.dto';
import { FacilityType } from '../../../entities/Facility.entity';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('FacilityService', () => {
    let facilityService: FacilityService;
    let mockRepository: any;

    beforeEach(() => {
        mockRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
        facilityService = new FacilityService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        const createDto: CreateFacilityDto = {
            name: 'City Hospital',
            type: FacilityType.HOSPITAL,
            address: '123 Main St',
            phone: '+250788123456',
            email: 'info@cityhospital.com',
            departments_enabled: true,
            controlled_drug_rules_enabled: true,
        };

        it('should create a new facility successfully', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            const savedFacility = { ...createDto, id: 1, created_at: new Date(), organization_id: 1 };
            mockRepository.create.mockReturnValue(savedFacility);
            mockRepository.save.mockResolvedValue(savedFacility);

            const result = await facilityService.create(createDto, undefined, undefined, 1);

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { name: createDto.name, organization_id: 1 },
            });
            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(savedFacility);
        });

        it('should enable departments for hospital type', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            const hospitalDto = { ...createDto, type: FacilityType.HOSPITAL, organization_id: 1 };
            const savedFacility = { ...hospitalDto, id: 1, departments_enabled: true };
            mockRepository.create.mockReturnValue(savedFacility);
            mockRepository.save.mockResolvedValue(savedFacility);

            await facilityService.create(hospitalDto as any, undefined, undefined, 1);

            expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({ departments_enabled: true }));
        });

        it('should throw error if facility name already exists', async () => {
            const existingFacility = { id: 1, name: 'City Hospital' };
            mockRepository.findOne.mockResolvedValue(existingFacility);

            await expect(facilityService.create(createDto, undefined, undefined, 1)).rejects.toThrow(AppError);
            await expect(facilityService.create(createDto, undefined, undefined, 1)).rejects.toThrow(
                'Facility with this name already exists in this organization',
            );
        });
    });

    describe('findOne', () => {
        it('should return facility if found', async () => {
            const facility = {
                id: 1,
                name: 'City Hospital',
                type: FacilityType.HOSPITAL,
            };
            mockRepository.findOne.mockResolvedValue(facility);

            const result = await facilityService.findOne(1, 1);

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 1, organization_id: 1 },
                relations: ['facility_admin', 'departments'],
            });
            expect(result).toEqual(facility);
        });

        it('should throw error if facility not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(facilityService.findOne(999, 1)).rejects.toThrow(AppError);
            await expect(facilityService.findOne(999, 1)).rejects.toThrow('Facility not found');
        });
    });

    describe('findAll', () => {
        it('should return paginated list of facilities', async () => {
            const facilities = [
                { id: 1, name: 'City Hospital', type: FacilityType.HOSPITAL },
                { id: 2, name: 'Rural Clinic', type: FacilityType.CLINIC },
            ];
            const total = 2;

            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([facilities, total]),
            };

            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await facilityService.findAll(1, 10, undefined, undefined, undefined, 1);

            expect(result.data).toEqual(facilities);
            expect(result.total).toBe(total);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });

        it('should filter by search term', async () => {
            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            };

            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await facilityService.findAll(1, 10, 'Hospital', undefined, undefined, 1);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update facility successfully', async () => {
            const existingFacility = {
                id: 1,
                name: 'City Hospital',
                min_stock_threshold_percentage: 10,
            };
            const updateDto: UpdateFacilityDto = {
                min_stock_threshold_percentage: 15,
            };
            const updatedFacility = { ...existingFacility, ...updateDto };

            mockRepository.findOne.mockResolvedValue(existingFacility);
            mockRepository.save.mockResolvedValue(updatedFacility);

            const result = await facilityService.update(1, updateDto, 1);

            expect(mockRepository.save).toHaveBeenCalled();
            expect(result.min_stock_threshold_percentage).toBe(15);
        });
    });

    describe('delete', () => {
        it('should delete facility successfully', async () => {
            const facility = { id: 1, name: 'City Hospital' };
            mockRepository.findOne.mockResolvedValue(facility);
            mockRepository.remove.mockResolvedValue(facility);

            await facilityService.delete(1, 1);

            expect(mockRepository.remove).toHaveBeenCalledWith(facility);
        });
    });
});
