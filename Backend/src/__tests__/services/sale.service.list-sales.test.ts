import { SaleService } from '../../services/pharmacy/sale.service';
import { AppDataSource } from '../../config/database';

jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('SaleService.listSales', () => {
    let service: SaleService;
    let queryBuilder: any;
    let repository: any;

    beforeEach(() => {
        queryBuilder = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        };

        repository = {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(repository);
        service = new SaleService();
        jest.clearAllMocks();
    });

    it('applies facility and patient filters when patient_id is provided', async () => {
        await service.listSales(3, 2, 25, undefined, undefined, 99);

        expect(queryBuilder.where).toHaveBeenCalledWith('sale.facility_id = :facilityId', { facilityId: 3 });
        expect(queryBuilder.andWhere).toHaveBeenCalledWith('sale.patient_id = :patientId', { patientId: 99 });
        expect(queryBuilder.skip).toHaveBeenCalledWith(25);
        expect(queryBuilder.take).toHaveBeenCalledWith(25);
    });

    it('does not apply patient filter when patient_id is not provided', async () => {
        await service.listSales(3, 1, 10);

        expect(queryBuilder.where).toHaveBeenCalledWith('sale.facility_id = :facilityId', { facilityId: 3 });
        expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('sale.patient_id = :patientId', expect.any(Object));
    });
});
