import { Repository, EntityManager, DeepPartial, IsNull } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { InsuranceProvider } from '../../entities/InsuranceProvider.entity';
import { CreateInsuranceProviderDto, UpdateInsuranceProviderDto } from '../../dto/pharmacy.dto';
import { AppError } from '../../middleware/error.middleware';

export class InsuranceProviderService {
    private providerRepository: Repository<InsuranceProvider>;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.providerRepository = source.getRepository(InsuranceProvider);
    }

    async create(dto: CreateInsuranceProviderDto, organizationId: number): Promise<InsuranceProvider> {
        const provider = this.providerRepository.create({
            ...(dto as DeepPartial<InsuranceProvider>),
            organization_id: organizationId,
        });
        return await this.providerRepository.save(provider);
    }

    async findAll(organizationId?: number): Promise<InsuranceProvider[]> {
        if (organizationId == null) {
            return await this.providerRepository.find({
                where: { is_active: true },
                order: { name: 'ASC' },
            });
        }
        return await this.providerRepository.find({
            where: [
                { organization_id: organizationId, is_active: true },
                { organization_id: IsNull(), is_active: true },
            ],
            order: { name: 'ASC' },
        });
    }

    async update(
        id: number,
        dto: UpdateInsuranceProviderDto,
        organizationId?: number,
    ): Promise<InsuranceProvider> {
        const provider = await this.providerRepository.findOne({ where: { id } });
        if (!provider) {
            throw new AppError('Insurance provider not found', 404);
        }
        if (
            organizationId != null &&
            provider.organization_id != null &&
            provider.organization_id !== organizationId
        ) {
            throw new AppError('Insurance provider not found', 404);
        }

        Object.assign(provider, dto);
        return await this.providerRepository.save(provider);
    }

    async findOne(id: number, organizationId?: number): Promise<InsuranceProvider> {
        const provider = await this.providerRepository.findOne({ where: { id } });
        if (!provider) {
            throw new AppError('Insurance provider not found', 404);
        }
        if (
            organizationId != null &&
            provider.organization_id != null &&
            provider.organization_id !== organizationId
        ) {
            throw new AppError('Insurance provider not found', 404);
        }
        return provider;
    }
}
