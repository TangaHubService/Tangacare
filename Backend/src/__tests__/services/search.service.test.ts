import { SearchService } from '../../services/search.service';
import { AppDataSource } from '../../config/database';

jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('SearchService', () => {
    let searchService: SearchService;
    let mockDoctorRepository: any;

    beforeEach(() => {
        const mockQueryBuilder = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orWhere: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
        };

        mockDoctorRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockDoctorRepository);
        searchService = new SearchService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('searchDoctors', () => {
        it('should return doctors matching search query', async () => {
            const doctors = [
                {
                    id: 1,
                    specialization: 'Cardiology',
                    user: { first_name: 'John', last_name: 'Doe' },
                },
                {
                    id: 2,
                    specialization: 'Cardiology',
                    user: { first_name: 'Jane', last_name: 'Smith' },
                },
            ];

            const mockQueryBuilder = mockDoctorRepository.createQueryBuilder();
            mockQueryBuilder.getMany.mockResolvedValue(doctors);

            const result = await searchService.searchDoctors('cardiology');

            expect(mockDoctorRepository.createQueryBuilder).toHaveBeenCalledWith('doctor');
            expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('doctor.user', 'user');
            expect(mockQueryBuilder.where).toHaveBeenCalled();
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('doctor.rating', 'DESC');
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
            expect(result).toEqual(doctors);
        });

        it('should return empty array for empty query', async () => {
            const result = await searchService.searchDoctors('');

            expect(mockDoctorRepository.createQueryBuilder).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it('should return empty array for whitespace query', async () => {
            const result = await searchService.searchDoctors('   ');

            expect(mockDoctorRepository.createQueryBuilder).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });
    });

    describe('searchAll', () => {
        it('should return search results for all entities', async () => {
            const doctors = [
                {
                    id: 1,
                    specialization: 'Cardiology',
                    user: { first_name: 'John', last_name: 'Doe' },
                },
            ];

            const mockQueryBuilder = mockDoctorRepository.createQueryBuilder();
            mockQueryBuilder.getMany.mockResolvedValue(doctors);

            const result = await searchService.searchAll('cardiology');

            expect(result.doctors).toEqual(doctors);
        });
    });
});
