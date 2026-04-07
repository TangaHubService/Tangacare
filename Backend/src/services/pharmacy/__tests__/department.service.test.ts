import { DepartmentService } from '../department.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateDepartmentDto } from '../../../dto/pharmacy.dto';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('DepartmentService', () => {
    let departmentService: DepartmentService;
    let mockDepartmentRepository: any;
    let mockFacilityRepository: any;

    beforeEach(() => {
        mockDepartmentRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockFacilityRepository = {
            findOne: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity.name === 'Department') {
                return mockDepartmentRepository;
            }
            return mockFacilityRepository;
        });

        departmentService = new DepartmentService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        const createDto: CreateDepartmentDto = {
            facility_id: 1,
            name: 'ICU',
            description: 'Intensive Care Unit',
            location: 'Building A, Floor 2',
        };

        it('should create a new department successfully', async () => {
            const facility = {
                id: 1,
                name: 'City Hospital',
                departments_enabled: true,
            };
            mockFacilityRepository.findOne.mockResolvedValue(facility);
            mockDepartmentRepository.findOne.mockResolvedValue(null);
            const savedDepartment = { ...createDto, id: 1, is_active: true };
            mockDepartmentRepository.create.mockReturnValue(savedDepartment);
            mockDepartmentRepository.save.mockResolvedValue(savedDepartment);

            const result = await departmentService.create(createDto);

            expect(mockFacilityRepository.findOne).toHaveBeenCalledWith({
                where: { id: createDto.facility_id },
            });
            expect(mockDepartmentRepository.create).toHaveBeenCalledWith(createDto);
            expect(result).toEqual(savedDepartment);
        });

        it('should throw error if facility does not support departments', async () => {
            const facility = {
                id: 1,
                name: 'City Clinic',
                departments_enabled: false,
            };
            mockFacilityRepository.findOne.mockResolvedValue(facility);

            await expect(departmentService.create(createDto)).rejects.toThrow(AppError);
            await expect(departmentService.create(createDto)).rejects.toThrow(
                'This facility does not support departments',
            );
        });

        it('should throw error if department name already exists in facility', async () => {
            const facility = { id: 1, departments_enabled: true };
            const existingDepartment = { id: 1, name: 'ICU', facility_id: 1 };
            mockFacilityRepository.findOne.mockResolvedValue(facility);
            mockDepartmentRepository.findOne.mockResolvedValue(existingDepartment);

            await expect(departmentService.create(createDto)).rejects.toThrow(AppError);
            await expect(departmentService.create(createDto)).rejects.toThrow(
                'Department with this name already exists in this facility',
            );
        });
    });

    describe('findOne', () => {
        it('should return department if found', async () => {
            const department = {
                id: 1,
                name: 'ICU',
                facility_id: 1,
            };
            mockDepartmentRepository.findOne.mockResolvedValue(department);

            const result = await departmentService.findOne(1);

            expect(mockDepartmentRepository.findOne).toHaveBeenCalledWith({
                where: { id: 1 },
                relations: ['facility', 'stocks'],
            });
            expect(result).toEqual(department);
        });

        it('should throw error if department not found', async () => {
            mockDepartmentRepository.findOne.mockResolvedValue(null);

            await expect(departmentService.findOne(999)).rejects.toThrow(AppError);
            await expect(departmentService.findOne(999)).rejects.toThrow('Department not found');
        });
    });
});
