import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { MedicineCategory } from '../../entities/MedicineCategory.entity';
import { CreateMedicineCategoryDto, UpdateMedicineCategoryDto } from '../../dto/pharmacy.dto';
import {
    buildOrganizationWhere,
    normalizeScopedText,
    requireOrganizationId,
    scopedFindOneOrFail,
} from '../../utils/tenant.util';

export class CategoryService {
    private categoryRepository: Repository<MedicineCategory>;

    constructor() {
        this.categoryRepository = AppDataSource.getRepository(MedicineCategory);
    }

    async create(dto: CreateMedicineCategoryDto, organizationId: number): Promise<MedicineCategory> {
        organizationId = requireOrganizationId(organizationId);
        const normalizedCode = normalizeScopedText(dto.code);
        const normalizedName = normalizeScopedText(dto.name);

        if (!normalizedCode || !normalizedName) {
            throw new AppError('Category name and code are required', 400);
        }

        const existing = await this.categoryRepository.findOne({
            where: [
                buildOrganizationWhere<MedicineCategory>(organizationId, { code: normalizedCode }),
                buildOrganizationWhere<MedicineCategory>(organizationId, { name: normalizedName }),
            ],
        });
        if (existing) {
            throw new AppError(`Category with this name or code already exists in your organization`, 409);
        }
        const category = new MedicineCategory();
        category.name = normalizedName;
        category.code = normalizedCode;
        category.default_markup_percent = dto.default_markup_percent ?? null;
        category.organization_id = organizationId;
        return await this.categoryRepository.save(category);
    }

    async findAll(organizationId: number): Promise<MedicineCategory[]> {
        organizationId = requireOrganizationId(organizationId);
        return await this.categoryRepository.find({
            where: buildOrganizationWhere<MedicineCategory>(organizationId),
            order: { name: 'ASC' },
        });
    }

    async findOne(id: number, organizationId: number): Promise<MedicineCategory> {
        organizationId = requireOrganizationId(organizationId);
        return scopedFindOneOrFail(this.categoryRepository, { id } as any, organizationId, {
            message: 'Category not found',
        });
    }

    async update(id: number, dto: UpdateMedicineCategoryDto, organizationId: number): Promise<MedicineCategory> {
        organizationId = requireOrganizationId(organizationId);
        const category = await this.findOne(id, organizationId);

        const nextCode = dto.code != null ? normalizeScopedText(dto.code) : category.code;
        const nextName = dto.name != null ? normalizeScopedText(dto.name) : category.name;

        if (!nextCode || !nextName) {
            throw new AppError('Category name and code are required', 400);
        }

        const duplicate = await this.categoryRepository.findOne({
            where: [
                buildOrganizationWhere<MedicineCategory>(organizationId, { code: nextCode }),
                buildOrganizationWhere<MedicineCategory>(organizationId, { name: nextName }),
            ],
        });

        if (duplicate && duplicate.id !== category.id) {
            throw new AppError('Another category with this name or code already exists', 409);
        }

        category.name = nextName;
        category.code = nextCode;
        if (dto.default_markup_percent !== undefined) category.default_markup_percent = dto.default_markup_percent;
        return await this.categoryRepository.save(category);
    }

    async delete(id: number, organizationId: number): Promise<void> {
        organizationId = requireOrganizationId(organizationId);
        const category = await this.findOne(id, organizationId);
        await this.categoryRepository.remove(category);
    }
}
