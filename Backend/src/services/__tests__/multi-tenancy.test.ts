import { AppointmentService } from '../appointment.service';
import { DoctorService } from '../doctor.service';
import { AppDataSource } from '../../config/database';
import {
    ORG_ALPHA_ID,
    TWO_ORGANIZATIONS_FIXTURE,
} from '../../test/fixtures/two-organizations.fixture';

const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
};

const mockRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
};

jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('Multi-tenancy Verification', () => {
    let appointmentService: AppointmentService;
    let doctorService: DoctorService;

    beforeEach(() => {
        jest.clearAllMocks();

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

        appointmentService = new AppointmentService();
        doctorService = new DoctorService();
    });

    describe('AppointmentService', () => {
        it('should filter appointments by facility_id when provided', async () => {
            const facilityId = TWO_ORGANIZATIONS_FIXTURE.facilities.alphaMain.id;
            await appointmentService.findAll({ facility_id: facilityId, organization_id: ORG_ALPHA_ID });

            expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('appointment');
            expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('doctor.user', 'doctorUser');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('appointment.organization_id = :organizationId', {
                organizationId: ORG_ALPHA_ID,
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doctorUser.facility_id = :facility_id', {
                facility_id: facilityId,
            });
        });

        it('should NOT filter by facility_id when NOT provided (Global Admin case)', async () => {
            await appointmentService.findAll({ organization_id: ORG_ALPHA_ID });

            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
                'doctorUser.facility_id = :facility_id',
                expect.anything(),
            );
        });
    });

    describe('DoctorService', () => {
        it('should filter doctors by facility_id when provided', async () => {
            const facilityId = TWO_ORGANIZATIONS_FIXTURE.facilities.alphaMain.id;
            await doctorService.findAll({ facility_id: facilityId, organization_id: ORG_ALPHA_ID });

            expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('doctor');
            expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('doctor.user', 'user');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.organization_id = :organizationId', {
                organizationId: ORG_ALPHA_ID,
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.facility_id = :facility_id', {
                facility_id: facilityId,
            });
        });

        it('should NOT filter by facility_id when NOT provided', async () => {
            await doctorService.findAll({ organization_id: ORG_ALPHA_ID });

            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
                'user.facility_id = :facility_id',
                expect.anything(),
            );
        });
    });
});
