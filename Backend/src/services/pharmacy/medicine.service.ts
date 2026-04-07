import { Brackets, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Medicine } from '../../entities/Medicine.entity';
import { MedicineCategory } from '../../entities/MedicineCategory.entity';
import { CreateMedicineDto, UpdateMedicineDto } from '../../dto/pharmacy.dto';
import {
    LEGACY_MANUAL_REVIEW_MESSAGE,
    buildOrganizationWhere,
    normalizeMedicineName,
    normalizeScopedText,
    requireOrganizationId,
    scopedFindOneOrFail,
    toNullOrganizationWhere,
} from '../../utils/tenant.util';

type MedicineMutationPayload = Partial<Medicine> & {
    code: string;
    name: string;
    normalized_name: string;
};

export class MedicineService {
    private medicineRepository: Repository<Medicine>;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
    }

    async create(createDto: CreateMedicineDto, organizationId: number): Promise<Medicine> {
        organizationId = requireOrganizationId(organizationId);

        return AppDataSource.transaction(async (manager) => {
            const payload = this.prepareMutationPayload(createDto);
            await this.assertCategoryBelongsToOrganization(manager, payload.category_id ?? null, organizationId);

            const existing = await this.findMatchingMedicine(
                manager.getRepository(Medicine),
                organizationId,
                payload,
            );
            if (existing) {
                throw new AppError('Medicine with this code, barcode, or name already exists in your organization', 409);
            }

            const legacyMatch = await this.findClaimableLegacyMedicine(manager, organizationId, payload);
            if (legacyMatch) {
                Object.assign(legacyMatch, payload, { organization_id: organizationId });
                return manager.getRepository(Medicine).save(legacyMatch);
            }

            const medicine = manager.getRepository(Medicine).create({
                ...payload,
                organization_id: organizationId,
            });
            return manager.getRepository(Medicine).save(medicine);
        });
    }

    async findAll(
        page: number = 1,
        limit: number = 10,
        search?: string,
        isActive?: boolean,
        startDate?: string,
        endDate?: string,
        facilityId?: number,
        sortBy?: string,
        order: 'ASC' | 'DESC' = 'ASC',
        minStock?: number,
        category?: string,
        organizationId?: number,
    ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
        organizationId = requireOrganizationId(organizationId);

        const queryBuilder = this.medicineRepository.createQueryBuilder('medicine');

        queryBuilder
            .leftJoin(
                'stocks',
                'stock',
                'stock.medicine_id = medicine.id' + (facilityId ? ' AND stock.facility_id = :facilityId' : ''),
            )
            .leftJoin('medicine.category', 'category')
            .leftJoin('batches', 'batch', 'batch.id = stock.batch_id')
            .andWhere('medicine.organization_id = :organizationId', { organizationId })
            .select([
                'medicine.id',
                'medicine.code',
                'medicine.barcode',
                'medicine.name',
                'medicine.brand_name',
                'medicine.strength',
                'medicine.dosage_form',
                'medicine.unit',
                'medicine.selling_price',
                'medicine.min_stock_level',
                'medicine.reorder_point',
                'medicine.is_active',
                'medicine.created_at',
                'medicine.category_id',
                'medicine.organization_id',
                'category.id',
                'category.name',
            ])
            .addSelect('MIN(batch.expiry_date)', 'expiry_date')
            .addSelect('SUM(COALESCE(stock.quantity, 0))', 'stock_quantity')
            .addSelect('COALESCE(MAX(stock.unit_cost), 0)', 'cost_price')
            .groupBy('medicine.id')
            .addGroupBy('category.id')
            .addGroupBy('category.name');

        if (facilityId) {
            queryBuilder.setParameter('facilityId', facilityId);
        }

        if (search) {
            queryBuilder.andWhere(
                '(medicine.name ILIKE :search OR medicine.code ILIKE :search OR medicine.brand_name ILIKE :search OR medicine.barcode ILIKE :search)',
                { search: `%${search}%` },
            );
        }

        if (category) {
            if (category === '__UNCATEGORIZED__') {
                queryBuilder.andWhere('medicine.category_id IS NULL');
            } else {
                queryBuilder.andWhere('LOWER(category.name) = LOWER(:category)', { category });
            }
        }

        if (isActive !== undefined) {
            queryBuilder.andWhere('medicine.is_active = :isActive', { isActive });
        }

        if (startDate) {
            queryBuilder.andWhere('medicine.created_at >= :startDate', { startDate: new Date(startDate) });
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('medicine.created_at <= :endDate', { endDate: end });
        }

        if (minStock !== undefined) {
            queryBuilder.having('SUM(COALESCE(stock.quantity, 0)) >= :minStock', { minStock });
        }

        const skip = (page - 1) * limit;
        const mainQuery = queryBuilder
            .select([
                'medicine.id as medicine_id',
                'medicine.code as medicine_code',
                'medicine.barcode as medicine_barcode',
                'medicine.name as medicine_name',
                'medicine.brand_name as medicine_brand_name',
                'medicine.strength as medicine_strength',
                'medicine.dosage_form as medicine_dosage_form',
                'medicine.unit as medicine_unit',
                'medicine.selling_price as medicine_selling_price',
                'medicine.min_stock_level as medicine_min_stock_level',
                'medicine.reorder_point as medicine_reorder_point',
                'medicine.is_active as medicine_is_active',
                'medicine.created_at as medicine_created_at',
                'medicine.category_id as medicine_category_id',
                'medicine.organization_id as medicine_organization_id',
            ])
            .addSelect('category.id', 'category_id')
            .addSelect('category.name', 'category_name')
            .addSelect('MIN(batch.expiry_date)', 'expiry_date')
            .addSelect('SUM(COALESCE(stock.quantity, 0))', 'stock_quantity')
            .addSelect('COALESCE(MAX(stock.unit_cost), 0)', 'cost_price')
            .groupBy('medicine.id')
            .addGroupBy('category.id')
            .addGroupBy('category.name')
            .offset(skip)
            .limit(limit);

        if (sortBy === 'expiry_date') {
            mainQuery.orderBy('MIN(batch.expiry_date)', order);
        } else {
            mainQuery.orderBy('medicine.name', 'ASC');
        }

        const rawData = await mainQuery.getRawMany();
        const mappedData = rawData.map((item) => ({
            id: item.medicine_id || item.id,
            code: item.medicine_code || item.code,
            barcode: item.medicine_barcode || item.barcode,
            name: item.medicine_name || item.name,
            brand_name: item.medicine_brand_name || item.brand_name,
            strength: item.medicine_strength || item.strength,
            dosage_form: item.medicine_dosage_form || item.dosage_form,
            unit: item.medicine_unit || item.unit,
            selling_price: parseFloat(item.medicine_selling_price || item.selling_price) || 0,
            min_stock_level: parseInt(item.medicine_min_stock_level || item.min_stock_level, 10) || 0,
            reorder_point: parseInt(item.medicine_reorder_point || item.reorder_point, 10) || 0,
            cost_price: parseFloat(item.cost_price) || 0,
            is_active: item.medicine_is_active ?? item.is_active,
            created_at: item.medicine_created_at || item.created_at,
            expiry_date: item.expiry_date,
            stock_quantity: parseInt(item.stock_quantity, 10) || 0,
            organization_id:
                item.medicine_organization_id != null
                    ? parseInt(item.medicine_organization_id, 10)
                    : null,
            category_id:
                item.medicine_category_id != null
                    ? parseInt(item.medicine_category_id, 10)
                    : item.category_id != null
                        ? parseInt(item.category_id, 10)
                        : null,
            category_name: item.category_name || null,
        }));

        const countQuery = this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin(
                'stocks',
                'stock',
                'stock.medicine_id = medicine.id' + (facilityId ? ' AND stock.facility_id = :facilityId' : ''),
            )
            .leftJoin('medicine.category', 'category')
            .andWhere('medicine.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            countQuery.setParameter('facilityId', facilityId);
        }

        if (search) {
            countQuery.andWhere(
                '(medicine.name ILIKE :search OR medicine.code ILIKE :search OR medicine.brand_name ILIKE :search OR medicine.barcode ILIKE :search)',
                { search: `%${search}%` },
            );
        }
        if (category) {
            if (category === '__UNCATEGORIZED__') {
                countQuery.andWhere('medicine.category_id IS NULL');
            } else {
                countQuery.andWhere('LOWER(category.name) = LOWER(:category)', { category });
            }
        }
        if (isActive !== undefined) {
            countQuery.andWhere('medicine.is_active = :isActive', { isActive });
        }
        if (startDate) {
            countQuery.andWhere('medicine.created_at >= :startDate', { startDate: new Date(startDate) });
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            countQuery.andWhere('medicine.created_at <= :endDate', { endDate: end });
        }

        const finalTotal = await countQuery.getCount();
        return { data: mappedData, total: finalTotal, page, limit };
    }

    async exportToExcel(organizationId: number): Promise<Buffer> {
        organizationId = requireOrganizationId(organizationId);

        const medicines = await this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.batches', 'batch')
            .where('medicine.organization_id = :organizationId', { organizationId })
            .select([
                'medicine.id',
                'medicine.code',
                'medicine.name',
                'medicine.brand_name',
                'medicine.strength',
                'medicine.dosage_form',
                'medicine.unit',
                'medicine.selling_price',
                'medicine.created_at',
            ])
            .addSelect('MIN(batch.expiry_date)', 'expiry_date')
            .addSelect('SUM(COALESCE(batch.current_quantity, 0))', 'stock_quantity')
            .groupBy('medicine.id')
            .orderBy('medicine.name', 'ASC')
            .getRawMany();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inventory');

        worksheet.columns = [
            { header: 'ID', key: 'medicine_id', width: 10 },
            { header: 'Code', key: 'medicine_code', width: 20 },
            { header: 'Name', key: 'medicine_name', width: 30 },
            { header: 'Brand', key: 'medicine_brand_name', width: 20 },
            { header: 'Strength', key: 'medicine_strength', width: 15 },
            { header: 'Form', key: 'medicine_dosage_form', width: 15 },
            { header: 'Unit', key: 'medicine_unit', width: 15 },
            { header: 'Selling Price', key: 'medicine_selling_price', width: 15 },
            { header: 'Stock Qty', key: 'stock_quantity', width: 15 },
            { header: 'Earliest Expiry', key: 'expiry_date', width: 20 },
            { header: 'Added Date', key: 'medicine_created_at', width: 20 },
        ];

        medicines.forEach((med) => {
            worksheet.addRow({
                ...med,
                medicine_selling_price: parseFloat(med.medicine_selling_price) || 0,
                stock_quantity: parseInt(med.stock_quantity, 10) || 0,
                medicine_created_at: med.medicine_created_at
                    ? new Date(med.medicine_created_at).toLocaleDateString()
                    : '',
                expiry_date: med.expiry_date ? new Date(med.expiry_date).toLocaleDateString() : 'N/A',
            });
        });

        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    async findOne(id: number, organizationId: number): Promise<Medicine> {
        return scopedFindOneOrFail(this.medicineRepository, { id } as any, requireOrganizationId(organizationId), {
            relations: ['batches', 'category'],
            message: 'Medicine not found',
        });
    }

    async findByCode(code: string, organizationId: number): Promise<Medicine> {
        const normalizedCode = normalizeScopedText(code);
        if (!normalizedCode) {
            throw new AppError('Medicine code is required', 400);
        }

        return scopedFindOneOrFail(
            this.medicineRepository,
            { code: normalizedCode } as any,
            requireOrganizationId(organizationId),
            { message: 'Medicine not found' },
        );
    }

    async findByBarcode(barcode: string, organizationId: number): Promise<Medicine> {
        const normalizedBarcode = normalizeScopedText(barcode);
        if (!normalizedBarcode) {
            throw new AppError('Barcode is required', 400);
        }

        return scopedFindOneOrFail(
            this.medicineRepository,
            { barcode: normalizedBarcode } as any,
            requireOrganizationId(organizationId),
            { message: 'Medicine not found' },
        );
    }

    async update(id: number, updateDto: UpdateMedicineDto, organizationId: number): Promise<Medicine> {
        organizationId = requireOrganizationId(organizationId);

        return AppDataSource.transaction(async (manager) => {
            const repository = manager.getRepository(Medicine);
            const medicine = await scopedFindOneOrFail(repository, { id } as any, organizationId, {
                message: 'Medicine not found',
            });

            const payload = this.prepareMutationPayload({
                ...medicine,
                ...updateDto,
                code: normalizeScopedText(updateDto.code ?? medicine.code),
                name: normalizeScopedText(updateDto.name ?? medicine.name),
            } as CreateMedicineDto);

            await this.assertCategoryBelongsToOrganization(manager, payload.category_id ?? null, organizationId);

            const duplicate = await this.findMatchingMedicine(repository, organizationId, payload, medicine.id);
            if (duplicate) {
                throw new AppError('Another medicine with this code, barcode, or name already exists', 409);
            }

            Object.assign(medicine, payload, { organization_id: organizationId });
            return repository.save(medicine);
        });
    }

    async delete(id: number, organizationId: number): Promise<void> {
        const medicine = await this.findOne(id, organizationId);
        await this.medicineRepository.remove(medicine);
    }

    async downloadTemplate(): Promise<ExcelJS.Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Medicine Template');

        worksheet.columns = [
            { header: 'Code', key: 'code', width: 20 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Brand Name', key: 'brand_name', width: 25 },
            { header: 'Strength', key: 'strength', width: 15 },
            { header: 'Dosage Form', key: 'dosage_form', width: 15 },
            { header: 'Unit', key: 'unit', width: 10 },
            { header: 'Selling Price', key: 'selling_price', width: 15 },
            { header: 'Barcode', key: 'barcode', width: 20 },
        ];

        worksheet.addRow({
            code: 'PARA-500MG-TAB',
            name: 'Paracetamol',
            brand_name: 'Panadol',
            strength: '500mg',
            dosage_form: 'tablet',
            unit: 'tablet',
            selling_price: 15,
            barcode: '1234567890',
        });

        worksheet.addRow([]);
        worksheet.addRow([
            'Note: Dosage form must be one of: tablet, capsule, syrup, injection, ointment, drops, inhaler, patch, other',
        ]);

        return workbook.xlsx.writeBuffer();
    }

    async validateImportExcel(
        buffer: Buffer,
        organizationId: number,
    ): Promise<{ items: any[]; errors: string[]; total: number }> {
        organizationId = requireOrganizationId(organizationId);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.worksheets[0];

        const items: any[] = [];
        const errors: string[] = [];

        const headerRow = worksheet.getRow(1);
        const colMap: Record<string, number> = {
            code: 1,
            name: 2,
            brand_name: 3,
            strength: 4,
            dosage_form: 5,
            unit: 6,
            selling_price: 8,
            barcode: 9,
        };

        const headerValues = headerRow.values as any[];
        if (headerValues && headerValues.length > 0) {
            headerValues.forEach((val, idx) => {
                if (!val) return;
                const normalized = val.toString().toLowerCase();
                if (normalized.includes('code')) colMap.code = idx;
                else if (normalized.includes('generic') || (normalized.includes('name') && !normalized.includes('brand'))) colMap.name = idx;
                else if (normalized.includes('brand')) colMap.brand_name = idx;
                else if (normalized.includes('strength')) colMap.strength = idx;
                else if (normalized.includes('form')) colMap.dosage_form = idx;
                else if (normalized.includes('unit')) colMap.unit = idx;
                else if (normalized.includes('selling') || normalized.includes('price')) colMap.selling_price = idx;
                else if (normalized.includes('bar') || normalized.includes('gs1')) colMap.barcode = idx;
            });
        }

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1 || rowNumber > 1000) return;

            const code = normalizeScopedText(row.getCell(colMap.code).text);
            const name = normalizeScopedText(row.getCell(colMap.name).text);
            if (!code && !name) return;

            if (!code) {
                errors.push(`Row ${rowNumber}: Missing medicine code`);
                return;
            }
            if (!name) {
                errors.push(`Row ${rowNumber}: Missing medicine name`);
                return;
            }

            const formRaw = row.getCell(colMap.dosage_form).text?.toLowerCase().trim() || 'other';
            const dosage_form = Object.values(require('../../entities/Medicine.entity').DosageForm).includes(formRaw)
                ? formRaw
                : require('../../entities/Medicine.entity').DosageForm.OTHER;

            items.push({
                code,
                name,
                brand_name: normalizeScopedText(row.getCell(colMap.brand_name).text) || undefined,
                strength: normalizeScopedText(row.getCell(colMap.strength).text) || undefined,
                dosage_form,
                unit: normalizeScopedText(row.getCell(colMap.unit).text) || undefined,
                selling_price: parseFloat(row.getCell(colMap.selling_price).text) || 0,
                barcode: normalizeScopedText(row.getCell(colMap.barcode).text) || undefined,
                is_active: true,
            });
        });

        const validatedItems = [];
        for (const item of items) {
            const existing = await this.findMatchingMedicine(
                this.medicineRepository,
                organizationId,
                this.prepareMutationPayload(item as CreateMedicineDto),
            );
            validatedItems.push({
                ...item,
                is_update: !!existing,
                existing_id: existing?.id ?? null,
            });
        }

        return { items: validatedItems, errors, total: validatedItems.length };
    }

    async importExcel(
        buffer: Buffer,
        organizationId: number,
    ): Promise<{ imported: number; updated: number; errors: string[] }> {
        organizationId = requireOrganizationId(organizationId);
        const validation = await this.validateImportExcel(buffer, organizationId);

        let importedCount = 0;
        let updatedCount = 0;
        const errors: string[] = [...validation.errors];

        for (const medData of validation.items) {
            try {
                const { existing_id, is_update, ...data } = medData;
                if (is_update && existing_id) {
                    await this.update(existing_id, data as UpdateMedicineDto, organizationId);
                    updatedCount++;
                } else {
                    await this.create(data as CreateMedicineDto, organizationId);
                    importedCount++;
                }
            } catch (err: any) {
                errors.push(`Medicine ${medData.name}: ${err.message}`);
            }
        }

        return { imported: importedCount, updated: updatedCount, errors };
    }

    async getStatistics(organizationId?: number): Promise<{
        totalItems: number;
        totalCategories: number;
        lowStock: number;
        expired: number;
    }> {
        organizationId = requireOrganizationId(organizationId);

        const totalItems = await this.medicineRepository.count({
            where: buildOrganizationWhere<Medicine>(organizationId),
        });

        const categoryQb = this.medicineRepository
            .createQueryBuilder('medicine')
            .select('COUNT(DISTINCT medicine.category_id)', 'count')
            .where('medicine.organization_id = :organizationId', { organizationId });
        const categoryResult = await categoryQb.getRawOne();
        const totalCategories = parseInt(categoryResult.count, 10) || 0;

        const lowStockQb = this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.batches', 'batch')
            .select('medicine.id')
            .where('medicine.organization_id = :organizationId', { organizationId })
            .groupBy('medicine.id')
            .having('SUM(COALESCE(batch.current_quantity, 0)) < :threshold', { threshold: 10 });
        const lowStock = (await lowStockQb.getRawMany()).length;

        const expiredQb = this.medicineRepository
            .createQueryBuilder('medicine')
            .innerJoin('medicine.batches', 'batch')
            .where('medicine.organization_id = :organizationId', { organizationId })
            .andWhere('batch.expiry_date <= :now', { now: new Date() })
            .andWhere('batch.current_quantity > 0')
            .select('DISTINCT medicine.id');
        const expired = (await expiredQb.getRawMany()).length;

        return { totalItems, totalCategories, lowStock, expired };
    }

    private prepareMutationPayload(dto: CreateMedicineDto | (Partial<Medicine> & { code: string; name: string })): MedicineMutationPayload {
        const code = normalizeScopedText(dto.code);
        const name = normalizeScopedText(dto.name);

        if (!code) {
            throw new AppError('Medicine code is required', 400);
        }
        if (!name) {
            throw new AppError('Medicine name is required', 400);
        }

        return {
            ...(dto as object),
            code,
            name,
            normalized_name: normalizeMedicineName(name),
            barcode: normalizeScopedText(dto.barcode) || null,
            brand_name: normalizeScopedText(dto.brand_name) || null,
            strength: normalizeScopedText(dto.strength) || null,
            unit: normalizeScopedText(dto.unit) || null,
            storage_conditions: normalizeScopedText(dto.storage_conditions) || null,
            description: normalizeScopedText(dto.description) || null,
        } as MedicineMutationPayload;
    }

    private async assertCategoryBelongsToOrganization(
        manager: EntityManager,
        categoryId: number | null,
        organizationId: number,
    ): Promise<void> {
        if (!categoryId) {
            return;
        }

        const category = await manager.getRepository(MedicineCategory).findOne({
            where: buildOrganizationWhere<MedicineCategory>(organizationId, { id: categoryId } as any),
        });

        if (!category) {
            throw new AppError('Category not found in your organization', 404);
        }
    }

    private async findMatchingMedicine(
        repository: Repository<Medicine>,
        organizationId: number,
        payload: MedicineMutationPayload,
        excludeId?: number,
    ): Promise<Medicine | null> {
        const matches = await this.buildMatchingQuery(repository, buildOrganizationWhere<Medicine>(organizationId), payload, excludeId)
            .orderBy('medicine.id', 'ASC')
            .limit(1)
            .getMany();

        return matches[0] || null;
    }

    private async findClaimableLegacyMedicine(
        manager: EntityManager,
        organizationId: number,
        payload: MedicineMutationPayload,
    ): Promise<Medicine | null> {
        const repository = manager.getRepository(Medicine);
        const legacyMatches = await this.buildMatchingQuery(
            repository,
            toNullOrganizationWhere<Medicine>(),
            payload,
        )
            .orderBy('medicine.id', 'ASC')
            .getMany();

        if (legacyMatches.length === 0) {
            return null;
        }

        const claimable: Medicine[] = [];
        const ambiguous: Array<{ medicine: Medicine; evidence: number[] }> = [];

        for (const legacyMatch of legacyMatches) {
            const evidence = await this.getLegacyOwnershipEvidence(manager, legacyMatch.id);
            if (evidence.length === 0 || (evidence.length === 1 && evidence[0] === organizationId)) {
                claimable.push(legacyMatch);
            } else {
                ambiguous.push({ medicine: legacyMatch, evidence });
            }
        }

        if (claimable.length > 1) {
            throw new AppError(LEGACY_MANUAL_REVIEW_MESSAGE, 409);
        }

        if (claimable.length === 1) {
            return claimable[0];
        }

        if (ambiguous.length > 1) {
            throw new AppError(LEGACY_MANUAL_REVIEW_MESSAGE, 409);
        }

        return null;
    }

    private buildMatchingQuery(
        repository: Repository<Medicine>,
        where: FindOptionsWhere<Medicine>,
        payload: MedicineMutationPayload,
        excludeId?: number,
    ) {
        const query = repository
            .createQueryBuilder('medicine')
            .where(where);

        if (excludeId) {
            query.andWhere('medicine.id != :excludeId', { excludeId });
        }

        query.andWhere(
            new Brackets((qb) => {
                qb.where('medicine.code = :code', { code: payload.code })
                    .orWhere('medicine.normalized_name = :normalizedName', {
                        normalizedName: payload.normalized_name,
                    });

                if (payload.barcode) {
                    qb.orWhere('medicine.barcode = :barcode', { barcode: payload.barcode });
                }
            }),
        );

        return query;
    }

    private async getLegacyOwnershipEvidence(manager: EntityManager, medicineId: number): Promise<number[]> {
        const rows = await manager.query(
            `
                SELECT DISTINCT x.organization_id
                FROM (
                    SELECT s.organization_id
                    FROM stocks s
                    WHERE s.medicine_id = $1 AND s.organization_id IS NOT NULL
                    UNION
                    SELECT b.organization_id
                    FROM batches b
                    WHERE b.medicine_id = $1 AND b.organization_id IS NOT NULL
                    UNION
                    SELECT po.organization_id
                    FROM purchase_order_items poi
                    INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
                    WHERE poi.medicine_id = $1 AND po.organization_id IS NOT NULL
                    UNION
                    SELECT s.organization_id
                    FROM sale_items si
                    INNER JOIN sales s ON s.id = si.sale_id
                    WHERE si.medicine_id = $1 AND s.organization_id IS NOT NULL
                    UNION
                    SELECT dt.organization_id
                    FROM dispense_transactions dt
                    WHERE dt.medicine_id = $1 AND dt.organization_id IS NOT NULL
                ) x
            `,
            [medicineId],
        );

        return rows
            .map((row: any) => Number(row.organization_id))
            .filter((value: number) => Number.isInteger(value) && value > 0);
    }
}
