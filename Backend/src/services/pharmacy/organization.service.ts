import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Organization } from '../../entities/Organization.entity';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../dto/pharmacy.dto';

export class OrganizationService {
    private organizationRepository: Repository<Organization>;

    constructor() {
        this.organizationRepository = AppDataSource.getRepository(Organization);
    }

    async create(createDto: CreateOrganizationDto): Promise<Organization> {
        const existing = await this.organizationRepository.findOne({
            where: { name: createDto.name },
        });
        if (existing) {
            throw new AppError('Organization with this name already exists', 409);
        }
        if (createDto.code) {
            const existingCode = await this.organizationRepository.findOne({
                where: { code: createDto.code },
            });
            if (existingCode) {
                throw new AppError('Organization with this code already exists', 409);
            }
        }
        const org = this.organizationRepository.create(createDto);
        return await this.organizationRepository.save(org);
    }

    async findAll(
        page: number = 1,
        limit: number = 10,
        search?: string,
        organizationId?: number,
    ): Promise<{ data: Organization[]; total: number; page: number; limit: number }> {
        const qb = this.organizationRepository.createQueryBuilder('org');

        if (organizationId) {
            qb.andWhere('org.id = :organizationId', { organizationId });
        }
        if (search) {
            qb.andWhere('(org.name ILIKE :search OR org.code ILIKE :search OR org.email ILIKE :search)', {
                search: `%${search}%`,
            });
        }

        const skip = (page - 1) * limit;
        const [data, total] = await qb.skip(skip).take(limit).orderBy('org.created_at', 'DESC').getManyAndCount();

        return { data, total, page, limit };
    }

    async findOne(id: number): Promise<Organization> {
        const org = await this.organizationRepository.findOne({
            where: { id },
            relations: ['facilities'],
        });
        if (!org) {
            throw new AppError('Organization not found', 404);
        }
        return org;
    }

    async update(id: number, updateDto: UpdateOrganizationDto): Promise<Organization> {
        const org = await this.findOne(id);
        Object.assign(org, updateDto);
        return await this.organizationRepository.save(org);
    }

    async delete(id: number): Promise<void> {
        const org = await this.findOne(id);
        await this.organizationRepository.remove(org);
    }
}
