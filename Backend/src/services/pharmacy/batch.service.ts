import { Repository, MoreThan, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Batch } from '../../entities/Batch.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { CreateBatchDto, UpdateBatchDto } from '../../dto/pharmacy.dto';

export class BatchService {
    private batchRepository: Repository<Batch>;
    private medicineRepository: Repository<Medicine>;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.batchRepository = source.getRepository(Batch);
        this.medicineRepository = source.getRepository(Medicine);
    }

    async create(createDto: CreateBatchDto, organizationId: number): Promise<Batch> {
        const medicine = await this.medicineRepository.findOne({
            where: { id: createDto.medicine_id, organization_id: organizationId },
        });

        if (!medicine) {
            throw new AppError('Medicine not found in your organization', 404);
        }

        const existingWhere: any = {
            medicine_id: createDto.medicine_id,
            batch_number: createDto.batch_number,
            organization_id: organizationId,
        };

        if (typeof createDto.facility_id === 'number') {
            existingWhere.facility_id = createDto.facility_id;
        }

        const existing = await this.batchRepository.findOne({ where: existingWhere });

        if (existing) {
            throw new AppError('Batch with this number already exists for this medicine', 409);
        }

        const expiryDate = new Date(createDto.expiry_date);
        const manufacturingDate = new Date(createDto.manufacturing_date);

        if (expiryDate <= manufacturingDate) {
            throw new AppError('Expiry date must be after manufacturing date', 400);
        }

        const batch = this.batchRepository.create({
            ...createDto,
            organization_id: organizationId,
            initial_quantity: createDto.initial_quantity,
            current_quantity: createDto.initial_quantity,
            expiry_date: expiryDate,
            manufacturing_date: manufacturingDate,
        });

        return await this.batchRepository.save(batch);
    }

    async findAll(organizationId: number, medicineId?: number, includeExpired: boolean = false, facilityId?: number): Promise<Batch[]> {
        const queryBuilder = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.medicine', 'medicine')
            .where('batch.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            queryBuilder
                .innerJoin('stocks', 'stock', 'stock.batch_id = batch.id')
                .andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        if (medicineId) {
            queryBuilder.andWhere('batch.medicine_id = :medicineId', { medicineId });
        }

        if (!includeExpired) {
            queryBuilder.andWhere('batch.expiry_date > :today', { today: new Date() });
        }

        return await queryBuilder.orderBy('batch.expiry_date', 'ASC').getMany();
    }

    async findOne(id: number, organizationId: number, facilityId?: number): Promise<Batch> {
        const queryBuilder = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.medicine', 'medicine')
            .where('batch.id = :id', { id })
            .andWhere('batch.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            queryBuilder
                .innerJoin('stocks', 'stock', 'stock.batch_id = batch.id')
                .andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const batch = await queryBuilder.getOne();

        if (!batch) {
            throw new AppError('Batch not found', 404);
        }

        return batch;
    }

    async update(id: number, updateDto: UpdateBatchDto, organizationId: number): Promise<Batch> {
        const batch = await this.findOne(id, organizationId);
        Object.assign(batch, updateDto);
        return await this.batchRepository.save(batch);
    }

    async getExpiringBatches(organizationId: number, days: number = 30): Promise<Batch[]> {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        return await this.batchRepository.find({
            where: {
                organization_id: organizationId,
                expiry_date: MoreThan(new Date()),
            },
            relations: ['medicine'],
            order: {
                expiry_date: 'ASC',
            },
        });
    }

    async decreaseQuantity(batchId: number, quantity: number, organizationId: number): Promise<Batch> {
        const batch = await this.findOne(batchId, organizationId);

        if (batch.current_quantity < quantity) {
            throw new AppError(`Insufficient quantity. Available: ${batch.current_quantity}`, 400);
        }

        batch.current_quantity -= quantity;
        return await this.batchRepository.save(batch);
    }

    async increaseQuantity(batchId: number, quantity: number, organizationId: number): Promise<Batch> {
        const batch = await this.findOne(batchId, organizationId);
        batch.current_quantity += quantity;
        batch.initial_quantity += quantity;
        return await this.batchRepository.save(batch);
    }

    async increaseCurrentQuantity(batchId: number, quantity: number, organizationId: number): Promise<Batch> {
        const batch = await this.findOne(batchId, organizationId);
        batch.current_quantity += quantity;
        return await this.batchRepository.save(batch);
    }
}
