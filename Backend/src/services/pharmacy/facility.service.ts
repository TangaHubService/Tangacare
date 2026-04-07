import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Facility } from '../../entities/Facility.entity';
import { CreateFacilityDto, UpdateFacilityDto } from '../../dto/pharmacy.dto';
import { User } from '../../entities/User.entity';
import { buildOrganizationWhere, requireOrganizationId, scopedFindOneOrFail } from '../../utils/tenant.util';

export class FacilityService {
    private facilityRepository: Repository<Facility>;

    constructor() {
        this.facilityRepository = AppDataSource.getRepository(Facility);
    }

    async create(
        createDto: CreateFacilityDto,
        userId?: number,
        userRole?: string,
        organizationId?: number,
    ): Promise<Facility> {
        const orgId = requireOrganizationId(organizationId);
        if (!orgId) {
            throw new AppError('Organization is required to create a facility', 400);
        }

        const existing = await this.facilityRepository.findOne({
            where: { name: createDto.name, organization_id: orgId },
        });
        if (existing) {
            throw new AppError('Facility with this name already exists in this organization', 409);
        }

        let facilityAdminId = createDto.facility_admin_id;
        if (!facilityAdminId && userId && (userRole === 'facility_admin' || userRole === 'owner')) {
            facilityAdminId = userId;
        }

        const facility = this.facilityRepository.create({
            ...createDto,
            organization_id: orgId,
            facility_admin_id: facilityAdminId,
            departments_enabled: createDto.departments_enabled ?? createDto.type === 'hospital',
        });

        const savedFacility = await this.facilityRepository.save(facility);

        if (facilityAdminId) {
            const userRepository = AppDataSource.getRepository(User);
            await userRepository.update(facilityAdminId, { facility_id: savedFacility.id });
        }

        return savedFacility;
    }

    async findAll(
        page: number = 1,
        limit: number = 10,
        search?: string,
        adminId?: number,
        facilityId?: number,
        organizationId?: number,
    ): Promise<{ data: Facility[]; total: number; page: number; limit: number }> {
        if (organizationId) {
            organizationId = requireOrganizationId(organizationId);
        }
        const queryBuilder = this.facilityRepository
            .createQueryBuilder('facility')
            .leftJoinAndSelect('facility.facility_admin', 'admin')
            .leftJoinAndSelect('facility.organization', 'organization');

        if (organizationId) {
            queryBuilder.andWhere('facility.organization_id = :organizationId', { organizationId });
        }
        if (facilityId) {
            queryBuilder.andWhere('facility.id = :facilityId', { facilityId });
        }
        if (adminId) {
            queryBuilder.andWhere('facility.facility_admin_id = :adminId', { adminId });
        }

        if (search) {
            queryBuilder.andWhere(
                '(facility.name ILIKE :search OR facility.address ILIKE :search OR facility.email ILIKE :search)',
                { search: `%${search}%` },
            );
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder.skip(skip).take(limit).orderBy('facility.id', 'ASC').getManyAndCount();

        return { data, total, page, limit };
    }

    async findOne(id: number, organizationId: number): Promise<Facility> {
        return scopedFindOneOrFail(this.facilityRepository, { id } as any, requireOrganizationId(organizationId), {
            relations: ['facility_admin', 'departments'],
            message: 'Facility not found',
        });
    }

    async findByAdminId(adminId: number, organizationId: number): Promise<Facility | null> {
        const facility = await this.facilityRepository.findOne({
            where: buildOrganizationWhere<Facility>(requireOrganizationId(organizationId), {
                facility_admin_id: adminId,
            } as any),
            relations: ['facility_admin', 'departments'],
        });

        return facility;
    }

    async findByOrganizationId(organizationId: number): Promise<Facility[]> {
        return this.facilityRepository.find({
            where: buildOrganizationWhere<Facility>(requireOrganizationId(organizationId)),
            relations: ['facility_admin', 'organization'],
            order: { name: 'ASC' },
        });
    }

    async update(id: number, updateDto: UpdateFacilityDto, organizationId: number): Promise<Facility> {
        const facility = await this.findOne(id, organizationId);

        Object.assign(facility, updateDto);
        return await this.facilityRepository.save(facility);
    }

    async delete(id: number, organizationId: number): Promise<void> {
        const facility = await this.findOne(id, organizationId);
        await this.facilityRepository.remove(facility);
    }
}
