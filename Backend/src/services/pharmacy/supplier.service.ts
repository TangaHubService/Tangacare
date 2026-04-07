import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Supplier } from '../../entities/Supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from '../../dto/pharmacy.dto';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';

export class SupplierService {
    private supplierRepository: Repository<Supplier>;
    private auditService: AuditService;

    constructor() {
        this.supplierRepository = AppDataSource.getRepository(Supplier);
        this.auditService = new AuditService();
    }

    async create(createDto: CreateSupplierDto, organizationId: number, userId: number): Promise<Supplier> {
        const supplier = this.supplierRepository.create({
            ...createDto,
            organization_id: organizationId,
        });
        const saved = await this.supplierRepository.save(supplier);

        await this.auditService.log({
            facility_id: saved.facility_id,
            user_id: userId,
            action: AuditAction.CREATE,
            entity_type: AuditEntityType.SUPPLIER,
            entity_id: saved.id,
            entity_name: saved.name,
            description: `Supplier ${saved.name} created`,
            organization_id: organizationId,
        });

        return saved;
    }

    async findAll(
        organizationId: number,
        facilityId?: number,
        page: number = 1,
        limit: number = 10,
        search?: string,
        isActive?: boolean,
    ): Promise<{ data: Supplier[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.supplierRepository.createQueryBuilder('supplier');

        queryBuilder.where('supplier.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            queryBuilder.andWhere('supplier.facility_id = :facilityId', { facilityId });
        }

        if (search) {
            const searchFilter =
                '(supplier.name ILIKE :search OR supplier.email ILIKE :search OR supplier.phone ILIKE :search)';
            queryBuilder.andWhere(searchFilter, { search: `%${search}%` });
        }

        if (isActive !== undefined) {
            queryBuilder.andWhere('supplier.is_active = :isActive', { isActive });
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('supplier.name', 'ASC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async findOne(id: number, organizationId: number): Promise<Supplier> {
        const supplier = await this.supplierRepository.findOne({
            where: { id, organization_id: organizationId },
            relations: ['purchase_orders'],
        });

        if (!supplier) {
            throw new AppError('Supplier not found or access denied', 404);
        }

        return supplier;
    }

    async update(id: number, updateDto: UpdateSupplierDto, organizationId: number, userId: number): Promise<Supplier> {
        const supplier = await this.findOne(id, organizationId);
        Object.assign(supplier, updateDto);
        const saved = await this.supplierRepository.save(supplier);

        await this.auditService.log({
            facility_id: saved.facility_id,
            user_id: userId,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.SUPPLIER,
            entity_id: saved.id,
            entity_name: saved.name,
            description: `Supplier ${saved.name} updated`,
        });

        return saved;
    }

    async delete(id: number, organizationId: number, userId: number): Promise<void> {
        const supplier = await this.findOne(id, organizationId);
        await this.supplierRepository.softRemove(supplier);

        await this.auditService.log({
            facility_id: supplier.facility_id,
            user_id: userId,
            action: AuditAction.DELETE,
            entity_type: AuditEntityType.SUPPLIER,
            entity_id: supplier.id,
            entity_name: supplier.name,
            description: `Supplier ${supplier.name} deleted (soft)`,
        });
    }
}
