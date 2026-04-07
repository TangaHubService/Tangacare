import { Repository, EntityManager, DeepPartial } from 'typeorm';
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

    async create(dto: CreateInsuranceProviderDto): Promise<InsuranceProvider> {
        const provider = this.providerRepository.create(dto as DeepPartial<InsuranceProvider>);
        return await this.providerRepository.save(provider);
    }

    async findAll(): Promise<InsuranceProvider[]> {
        return await this.providerRepository.find({
            where: { is_active: true },
            order: { name: 'ASC' },
        });
    }

    async update(id: number, dto: UpdateInsuranceProviderDto): Promise<InsuranceProvider> {
        const provider = await this.providerRepository.findOne({ where: { id } });
        if (!provider) {
            throw new AppError('Insurance provider not found', 404);
        }

        Object.assign(provider, dto);
        return await this.providerRepository.save(provider);
    }

    async findOne(id: number): Promise<InsuranceProvider> {
        const provider = await this.providerRepository.findOne({ where: { id } });
        if (!provider) {
            throw new AppError('Insurance provider not found', 404);
        }
        return provider;
    }
}
