import { MedicineService } from '../medicine.service';
import { AppDataSource } from '../../../config/database';
import { AppError } from '../../../middleware/error.middleware';
import { CreateMedicineDto } from '../../../dto/pharmacy.dto';
import { MedicineCategory } from '../../../entities/MedicineCategory.entity';
import {
    ORG_ALPHA_ID,
    ORG_BETA_ID,
    TWO_ORGANIZATIONS_FIXTURE,
} from '../../../test/fixtures/two-organizations.fixture';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        transaction: jest.fn(),
    },
}));

function createMatchingQueryBuilder(results: any[]) {
    return {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(results),
    };
}

function createFindAllQueryBuilder(rawData: any[] = [], total: number = rawData.length) {
    return {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
        getCount: jest.fn().mockResolvedValue(total),
    };
}

describe('MedicineService', () => {
    let medicineService: MedicineService;
    let mockMedicineRepository: any;
    let mockCategoryRepository: any;
    let mockManager: any;

    const createDto: CreateMedicineDto = {
        code: 'AMOX-500',
        name: 'Amoxicillin 500mg',
        dosage_form: 'capsule' as any,
        unit: 'capsules',
        selling_price: 120,
        barcode: '1234567890',
    };

    beforeEach(() => {
        mockMedicineRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockCategoryRepository = {
            findOne: jest.fn(),
        };

        mockManager = {
            getRepository: jest.fn((entity: any) => {
                if (entity === MedicineCategory) {
                    return mockCategoryRepository;
                }

                return mockMedicineRepository;
            }),
            query: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
            if (entity === MedicineCategory) {
                return mockCategoryRepository;
            }

            return mockMedicineRepository;
        });

        (AppDataSource.transaction as jest.Mock).mockImplementation(async (callback: any) => callback(mockManager));

        medicineService = new MedicineService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('rejects duplicate medicines inside the same organization', async () => {
        const duplicate = TWO_ORGANIZATIONS_FIXTURE.medicines.alphaAmoxicillin;
        mockMedicineRepository.createQueryBuilder.mockReturnValueOnce(createMatchingQueryBuilder([duplicate]));

        await expect(medicineService.create(createDto, ORG_ALPHA_ID)).rejects.toThrow(
            'Medicine with this code, barcode, or name already exists in your organization',
        );

        expect(mockMedicineRepository.save).not.toHaveBeenCalled();
        expect(mockMedicineRepository.create).not.toHaveBeenCalled();
    });

    it('claims a matching legacy unassigned medicine instead of creating a duplicate', async () => {
        const legacyMedicine = { ...TWO_ORGANIZATIONS_FIXTURE.medicines.legacyAmoxicillin };

        mockMedicineRepository.createQueryBuilder
            .mockReturnValueOnce(createMatchingQueryBuilder([]))
            .mockReturnValueOnce(createMatchingQueryBuilder([legacyMedicine]));
        mockManager.query.mockResolvedValue([]);
        mockMedicineRepository.save.mockImplementation(async (entity: any) => entity);

        const result = await medicineService.create(createDto, ORG_ALPHA_ID);

        expect(mockMedicineRepository.create).not.toHaveBeenCalled();
        expect(mockMedicineRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                id: TWO_ORGANIZATIONS_FIXTURE.medicines.legacyAmoxicillin.id,
                organization_id: ORG_ALPHA_ID,
                code: 'AMOX-500',
                name: 'Amoxicillin 500mg',
                normalized_name: 'amoxicillin 500mg',
            }),
        );
        expect(result).toEqual(
            expect.objectContaining({
                id: TWO_ORGANIZATIONS_FIXTURE.medicines.legacyAmoxicillin.id,
                organization_id: ORG_ALPHA_ID,
            }),
        );
    });

    it('does not return a medicine from another organization', async () => {
        mockMedicineRepository.findOne.mockResolvedValue(null);

        await expect(
            medicineService.findOne(TWO_ORGANIZATIONS_FIXTURE.medicines.betaAmoxicillin.id, ORG_ALPHA_ID),
        ).rejects.toThrow(AppError);
        expect(mockMedicineRepository.findOne).toHaveBeenCalledWith({
            where: { id: TWO_ORGANIZATIONS_FIXTURE.medicines.betaAmoxicillin.id, organization_id: ORG_ALPHA_ID },
            relations: ['batches', 'category'],
        });
    });

    it('applies organization scope to medicine listings', async () => {
        const rawRows = [
            {
                medicine_id: TWO_ORGANIZATIONS_FIXTURE.medicines.alphaAmoxicillin.id,
                medicine_code: 'AMOX-500',
                medicine_barcode: '1234567890',
                medicine_name: 'Amoxicillin 500mg',
                medicine_brand_name: 'Amoxil',
                medicine_strength: '500mg',
                medicine_dosage_form: 'capsule',
                medicine_unit: 'capsules',
                medicine_selling_price: '120',
                medicine_min_stock_level: '10',
                medicine_reorder_point: '15',
                medicine_is_active: true,
                medicine_created_at: new Date(),
                medicine_category_id: null,
                medicine_organization_id: String(ORG_ALPHA_ID),
                category_id: null,
                category_name: null,
                expiry_date: null,
                stock_quantity: '25',
                cost_price: '80',
            },
        ];

        const mainQuery = createFindAllQueryBuilder(rawRows, 1);
        const countQuery = createFindAllQueryBuilder([], 1);

        mockMedicineRepository.createQueryBuilder.mockReturnValueOnce(mainQuery).mockReturnValueOnce(countQuery);

        const result = await medicineService.findAll(
            1,
            10,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'ASC',
            undefined,
            undefined,
            ORG_ALPHA_ID,
        );

        expect(mainQuery.andWhere).toHaveBeenCalledWith('medicine.organization_id = :organizationId', {
            organizationId: ORG_ALPHA_ID,
        });
        expect(countQuery.andWhere).toHaveBeenCalledWith('medicine.organization_id = :organizationId', {
            organizationId: ORG_ALPHA_ID,
        });
        expect(result.total).toBe(1);
        expect(result.data[0]).toEqual(
            expect.objectContaining({
                id: TWO_ORGANIZATIONS_FIXTURE.medicines.alphaAmoxicillin.id,
                name: 'Amoxicillin 500mg',
                organization_id: ORG_ALPHA_ID,
            }),
        );
    });

    it('allows a different organization to own the same medicine identifiers independently', async () => {
        mockMedicineRepository.createQueryBuilder
            .mockReturnValueOnce(createMatchingQueryBuilder([]))
            .mockReturnValueOnce(createMatchingQueryBuilder([]));
        mockManager.query.mockResolvedValue([]);
        mockMedicineRepository.create.mockImplementation((entity: any) => entity);
        mockMedicineRepository.save.mockImplementation(async (entity: any) => ({
            id: TWO_ORGANIZATIONS_FIXTURE.medicines.betaAmoxicillin.id,
            ...entity,
        }));

        const result = await medicineService.create(createDto, ORG_BETA_ID);

        expect(result).toEqual(
            expect.objectContaining({
                id: TWO_ORGANIZATIONS_FIXTURE.medicines.betaAmoxicillin.id,
                organization_id: ORG_BETA_ID,
            }),
        );
    });
});
