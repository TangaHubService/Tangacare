import { Repository, IsNull, EntityManager, In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Stock } from '../../entities/Stock.entity';
import { Facility } from '../../entities/Facility.entity';
import { Batch } from '../../entities/Batch.entity';
import { BatchService } from './batch.service';
import { StockQueryDto } from '../../dto/pharmacy.dto';
import { StockMovement, StockMovementType, AdjustmentReason } from '../../entities/StockMovement.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { StorageLocation } from '../../entities/StorageLocation.entity';
import { ColdChainExcursion, ColdChainExcursionStatus } from '../../entities/ColdChainExcursion.entity';
import { FacilityMedicineConfig } from '../../entities/FacilityMedicineConfig.entity';
import { AlertService } from './alert.service';
import * as ExcelJS from 'exceljs';

export interface StockMovementMetadata {
    type: StockMovementType;
    reason?: AdjustmentReason;
    reference_type?: string;
    reference_id?: number;
    location_id?: number;
    user_id?: number;
    notes?: string;
}

export class StockService {
    private stockRepository: Repository<Stock>;
    private facilityRepository: Repository<Facility>;
    private stockMovementRepository: Repository<StockMovement>;
    private medicineRepository: Repository<Medicine>;
    private storageLocationRepository: Repository<StorageLocation>;
    private coldChainExcursionRepository: Repository<ColdChainExcursion>;
    private facilityMedicineConfigRepository: Repository<FacilityMedicineConfig>;
    private batchService: BatchService;
    private alertService: AlertService;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.stockRepository = source.getRepository(Stock);
        this.facilityRepository = source.getRepository(Facility);
        this.stockMovementRepository = source.getRepository(StockMovement);
        this.medicineRepository = source.getRepository(Medicine);
        this.storageLocationRepository = source.getRepository(StorageLocation);
        this.coldChainExcursionRepository = source.getRepository(ColdChainExcursion);
        this.facilityMedicineConfigRepository = source.getRepository(FacilityMedicineConfig);
        this.batchService = new BatchService(entityManager);
        this.alertService = new AlertService();
    }

    async addStock(
        facilityId: number,
        organizationId: number,
        departmentId: number | null,
        locationId: number | null,
        medicineId: number,
        batchId: number,
        quantity: number,
        unitCost?: number,
        unitPrice?: number,
        metadata?: StockMovementMetadata,
    ): Promise<Stock> {
        const facility = await this.facilityRepository.findOne({ where: { id: facilityId, organization_id: organizationId } });
        if (!facility) {
            throw new AppError('Facility not found or access denied', 404);
        }

        if (locationId) {
            await this.validateStorageCondition(medicineId, locationId, organizationId);
        }

        await this.checkIfFrozen(facilityId, organizationId, medicineId, batchId, departmentId);

        const whereCondition: any = {
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            is_deleted: false,
        };
        if (departmentId === null) {
            whereCondition.department_id = IsNull();
        } else {
            whereCondition.department_id = departmentId;
        }

        if (locationId === null) {
            whereCondition.location_id = IsNull();
        } else {
            whereCondition.location_id = locationId;
        }

        let stock = await this.stockRepository.findOne({
            where: whereCondition,
            lock: { mode: 'pessimistic_write' },
        });

        const previousBalance = stock ? stock.quantity : 0;
        if (stock) {
            stock.quantity += quantity;
            if (unitCost !== undefined) stock.unit_cost = unitCost;
            if (unitPrice !== undefined) stock.unit_price = unitPrice;
        } else {
            stock = this.stockRepository.create({
                facility_id: facilityId,
                organization_id: organizationId,
                department_id: departmentId || undefined,
                location_id: locationId || undefined,
                medicine_id: medicineId,
                batch_id: batchId,
                quantity,
                unit_cost: unitCost,
                unit_price: unitPrice,
            });
        }

        const savedStock = await this.stockRepository.save(stock);

        await this.recordMovement({
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            location_id: locationId || undefined,
            type: metadata?.type || StockMovementType.IN,
            reason: metadata?.reason,
            quantity: quantity,
            previous_balance: previousBalance,
            new_balance: savedStock.quantity,
            reference_type: metadata?.reference_type,
            reference_id: metadata?.reference_id,
            user_id: metadata?.user_id,
            notes: metadata?.notes,
        });

        // Real-time alert check
        this.alertService
            .checkLowStock(facilityId, medicineId)
            .catch((err) => console.error('Failed to trigger real-time alert check:', err));

        // Update WAC if enabled and unitCost is provided
        if (facility.wac_enabled && unitCost !== undefined && quantity > 0) {
            await this.updateWAC(facilityId, organizationId, medicineId, quantity, unitCost);
        }

        return savedStock;
    }

    private async updateWAC(facilityId: number, organizationId: number, medicineId: number, newQty: number, newUnitCost: number): Promise<void> {
        // Only update WAC for facility-level stock (not department-level)
        // or decide if WAC is global per facility regardless of department?
        // Usually, WAC is per entity (Facility).

        let config = await this.facilityMedicineConfigRepository.findOne({
            where: { facility_id: facilityId, organization_id: organizationId, medicine_id: medicineId },
        });

        if (!config) {
            config = this.facilityMedicineConfigRepository.create({
                facility_id: facilityId,
                organization_id: organizationId,
                medicine_id: medicineId,
                average_cost: 0,
                last_purchase_price: 0,
            });
        }

        const currentQty = await this.getTotalAvailableStock(facilityId, organizationId, medicineId);
        // previousQty = currentQty - newQty (since this is called after addStock)
        const previousQty = Math.max(0, currentQty - newQty);
        const currentWAC = Number(config.average_cost) || 0;

        const totalValue = previousQty * currentWAC + newQty * newUnitCost;
        const totalQty = previousQty + newQty;

        const newWAC = totalQty > 0 ? totalValue / totalQty : newUnitCost;

        config.average_cost = newWAC;
        config.last_purchase_price = newUnitCost;
        await this.facilityMedicineConfigRepository.save(config);
    }

    private async recordMovement(data: Partial<StockMovement>): Promise<void> {
        const movement = this.stockMovementRepository.create(data);
        await this.stockMovementRepository.save(movement);
    }

    private async checkIfFrozen(facilityId: number, organizationId: number, medicineId: number, batchId: number, departmentId: number | null): Promise<void> {
        const whereCondition: any = {
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            is_deleted: false,
        };
        if (departmentId === null) {
            whereCondition.department_id = IsNull();
        } else {
            whereCondition.department_id = departmentId;
        }

        const stock = await this.stockRepository.findOne({ where: whereCondition });
        if (stock && stock.is_frozen) {
            throw new AppError('Stock is currently frozen for physical counting and cannot be moved', 409);
        }
    }

    async getStock(query: StockQueryDto): Promise<{ data: Stock[]; total: number; page: number; limit: number }> {
        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        const queryBuilder = this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.medicine', 'medicine')
            .leftJoinAndSelect('stock.batch', 'batch')
            .leftJoinAndSelect('stock.department', 'department')
            .leftJoinAndSelect('stock.location', 'location')
            .leftJoinAndSelect('stock.facility', 'facility')
            .where('stock.is_deleted = :isDeleted', { isDeleted: false });

        if (query.facility_id) {
            queryBuilder.andWhere('stock.facility_id = :facilityId', { facilityId: query.facility_id });
        } else if (query.organization_id) {
            queryBuilder.andWhere('stock.organization_id = :organizationId', {
                organizationId: query.organization_id,
            });
        }

        if (query.department_id !== undefined) {
            queryBuilder.andWhere('stock.department_id = :departmentId', {
                departmentId: query.department_id,
            });
        }

        if (query.medicine_id) {
            queryBuilder.andWhere('stock.medicine_id = :medicineId', { medicineId: query.medicine_id });
        }

        if (query.search) {
            queryBuilder.andWhere('(medicine.name ILIKE :search OR medicine.code ILIKE :search)', {
                search: `%${query.search}%`,
            });
        }

        if (query.low_stock_only) {
            queryBuilder.andWhere((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select('SUM(s2.quantity)')
                    .from('stocks', 's2')
                    .where('s2.medicine_id = stock.medicine_id')
                    .andWhere('s2.facility_id = stock.facility_id')
                    .getQuery();
                return `(${subQuery}) < medicine.min_stock_level`;
            });
        }

        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('stock.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async getStockByLocation(facilityId: number, organizationId: number, departmentId: number | null, medicineId: number): Promise<Stock[]> {
        const queryBuilder = this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.batch', 'batch')
            .leftJoinAndSelect('stock.location', 'location')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.medicine_id = :medicineId', { medicineId })
            .andWhere('stock.quantity > 0')
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .orderBy('batch.expiry_date', 'ASC');

        if (departmentId === null) {
            queryBuilder.andWhere('stock.department_id IS NULL');
        } else {
            queryBuilder.andWhere('stock.department_id = :departmentId', { departmentId });
        }

        return await queryBuilder.getMany();
    }

    async findStockByBatch(facilityId: number, organizationId: number, batchId: number, departmentId: number | null): Promise<Stock | null> {
        const queryBuilder = this.stockRepository
            .createQueryBuilder('stock')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.batch_id = :batchId', { batchId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false });

        if (departmentId === null) {
            queryBuilder.andWhere('stock.department_id IS NULL');
        } else {
            queryBuilder.andWhere('stock.department_id = :departmentId', { departmentId });
        }

        return await queryBuilder.getOne();
    }

    async findSourceStockForTransfer(
        facilityId: number,
        organizationId: number,
        medicineId: number,
        batchId: number,
        departmentId: number | null,
        locationId?: number,
    ): Promise<Stock | null> {
        const queryBuilder = this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.batch', 'batch')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.medicine_id = :medicineId', { medicineId })
            .andWhere('stock.batch_id = :batchId', { batchId })
            .andWhere('stock.quantity > 0')
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .orderBy('batch.expiry_date', 'ASC');

        if (departmentId === null) {
            queryBuilder.andWhere('stock.department_id IS NULL');
        } else {
            queryBuilder.andWhere('stock.department_id = :departmentId', { departmentId });
        }

        if (locationId !== undefined && locationId !== null) {
            queryBuilder.andWhere('stock.location_id = :locationId', { locationId });
        }

        return await queryBuilder.getOne();
    }

    async reserveStock(stockId: number, quantity: number): Promise<Stock> {
        const stock = await this.stockRepository.findOne({
            where: { id: stockId, is_deleted: false },
        });

        if (!stock) {
            throw new AppError('Stock not found', 404);
        }

        const availableQuantity = stock.quantity - stock.reserved_quantity;
        if (availableQuantity < quantity) {
            throw new AppError(`Insufficient available stock. Available: ${availableQuantity}`, 400);
        }

        const updated = await this.stockRepository
            .createQueryBuilder()
            .update(Stock)
            .set({
                reserved_quantity: () => `reserved_quantity + ${quantity}`,
            })
            .where('id = :id', { id: stockId })
            .andWhere('is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('(quantity - reserved_quantity) >= :qty', { qty: quantity })
            .execute();

        if (!updated.affected) {
            throw new AppError(`Insufficient available stock. Available: ${availableQuantity}`, 400);
        }

        const refreshed = await this.stockRepository.findOne({ where: { id: stockId, is_deleted: false } });
        if (!refreshed) {
            throw new AppError('Stock not found', 404);
        }
        return refreshed;
    }

    async releaseReservation(stockId: number, quantity: number): Promise<Stock> {
        const stock = await this.stockRepository.findOne({
            where: { id: stockId, is_deleted: false },
        });

        if (!stock) {
            throw new AppError('Stock not found', 404);
        }

        if (stock.reserved_quantity < quantity) {
            throw new AppError('Cannot release more than reserved quantity', 400);
        }

        const updated = await this.stockRepository
            .createQueryBuilder()
            .update(Stock)
            .set({
                reserved_quantity: () => `reserved_quantity - ${quantity}`,
            })
            .where('id = :id', { id: stockId })
            .andWhere('is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('reserved_quantity >= :qty', { qty: quantity })
            .execute();

        if (!updated.affected) {
            throw new AppError('Cannot release more than reserved quantity', 400);
        }

        const refreshed = await this.stockRepository.findOne({ where: { id: stockId, is_deleted: false } });
        if (!refreshed) {
            throw new AppError('Stock not found', 404);
        }
        return refreshed;
    }

    async deductStock(stockId: number, organizationId: number, quantity: number, metadata?: StockMovementMetadata): Promise<Stock> {
        // C-1 FIX: Use pessimistic write lock to prevent concurrent overselling.
        // The QueryBuilder with setLock('pessimistic_write') issues SELECT ... FOR UPDATE,
        // serialising concurrent deductions on the same stock row at the DB level.
        const stock = await this.stockRepository
            .createQueryBuilder('stock')
            .setLock('pessimistic_write')
            .where('stock.id = :id', { id: stockId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .getOne();

        if (!stock) {
            throw new AppError('Stock not found', 404);
        }

        if (stock.is_frozen) {
            throw new AppError('Stock is currently frozen for physical counting and cannot be moved', 409);
        }

        const availableQuantity = stock.quantity - (stock.reserved_quantity || 0);
        if (availableQuantity < quantity) {
            throw new AppError(`Insufficient stock. Available: ${availableQuantity}`, 400);
        }

        const previousBalance = stock.quantity;
        stock.quantity -= quantity;
        if ((stock.reserved_quantity || 0) >= quantity) {
            stock.reserved_quantity -= quantity;
        }

        await this.batchService.decreaseQuantity(stock.batch_id, quantity, organizationId);

        const savedStock = await this.stockRepository.save(stock);

        await this.recordMovement({
            facility_id: savedStock.facility_id,
            organization_id: organizationId,
            medicine_id: savedStock.medicine_id,
            batch_id: savedStock.batch_id,
            location_id: savedStock.location_id || undefined,
            type: metadata?.type || StockMovementType.OUT,
            quantity: -quantity,
            previous_balance: previousBalance,
            new_balance: savedStock.quantity,
            reference_type: metadata?.reference_type,
            reference_id: metadata?.reference_id,
            user_id: metadata?.user_id,
            notes: metadata?.notes,
        });

        // Real-time alert check (fire-and-forget, non-blocking)
        this.alertService
            .checkLowStock(savedStock.facility_id, savedStock.medicine_id)
            .catch((err) => console.error('Failed to trigger real-time alert check:', err));

        return savedStock;
    }

    async adjustStock(stockId: number, organizationId: number, newQuantity: number, metadata?: StockMovementMetadata): Promise<Stock> {
        if (!metadata?.reason) {
            throw new AppError('Adjustment reason is required', 400);
        }

        if (!metadata?.notes || metadata.notes.trim() === '') {
            throw new AppError('Notes are required for stock adjustment', 400);
        }

        const stock = await this.stockRepository.findOne({
            where: { id: stockId, organization_id: organizationId, is_deleted: false },
            lock: { mode: 'pessimistic_write' },
        });

        if (!stock) {
            throw new AppError('Stock not found', 404);
        }

        if (stock.is_frozen) {
            throw new AppError('Stock is currently frozen for physical counting and cannot be moved', 409);
        }

        const difference = newQuantity - stock.quantity;
        const previousBalance = stock.quantity;
        stock.quantity = newQuantity;

        if (difference > 0) {
            await this.batchService.increaseQuantity(stock.batch_id, difference, organizationId);
        } else if (difference < 0) {
            await this.batchService.decreaseQuantity(stock.batch_id, Math.abs(difference), organizationId);
        }

        const savedStock = await this.stockRepository.save(stock);

        await this.recordMovement({
            facility_id: savedStock.facility_id,
            organization_id: organizationId,
            medicine_id: savedStock.medicine_id,
            batch_id: savedStock.batch_id,
            location_id: savedStock.location_id || undefined,
            type: metadata?.type || StockMovementType.ADJUSTMENT,
            reason: metadata?.reason,
            quantity: difference,
            previous_balance: previousBalance,
            new_balance: savedStock.quantity,
            reference_type: metadata?.reference_type || 'STOCK_ADJUSTMENT',
            reference_id: metadata?.reference_id || stockId,
            user_id: metadata?.user_id,
            notes: metadata?.notes || 'Manual inventory adjustment',
        });

        // Real-time alert check
        this.alertService
            .checkLowStock(savedStock.facility_id, savedStock.medicine_id)
            .catch((err) => console.error('Failed to trigger real-time alert check:', err));

        return savedStock;
    }

    /**
     * Deduct stock for a sale - links stock movement to sale transaction
     * Used by sale.service.ts instead of dispensing service
     */
    async deductStockForSale(
        facilityId: number,
        organizationId: number,
        medicineId: number,
        batchId: number,
        quantity: number,
        saleId: number,
        userId: number,
        departmentId?: number,
    ): Promise<void> {
        const queryBuilder = this.stockRepository.createQueryBuilder('stock')
            .setLock('pessimistic_write')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.medicine_id = :medicineId', { medicineId })
            .andWhere('stock.batch_id = :batchId', { batchId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false });

        if (departmentId === null || departmentId === undefined) {
            queryBuilder.andWhere('stock.department_id IS NULL');
        } else {
            queryBuilder.andWhere('stock.department_id = :departmentId', { departmentId });
        }

        const stock = await queryBuilder.getOne();

        if (!stock) {
            throw new AppError('Stock record not found', 404);
        }

        if (stock.is_frozen) {
            throw new AppError('Stock is currently frozen for physical counting and cannot be moved', 409);
        }

        const availableQuantity = stock.quantity - stock.reserved_quantity;
        if (availableQuantity < quantity) {
            throw new AppError(`Insufficient stock. Available: ${availableQuantity}, Requested: ${quantity}`, 400);
        }

        const previousBalance = stock.quantity;
        stock.quantity -= quantity;
        if (stock.reserved_quantity >= quantity) {
            stock.reserved_quantity -= quantity;
        }

        await this.batchService.decreaseQuantity(batchId, quantity, organizationId);
        await this.stockRepository.save(stock);

        // Create stock movement linked to sale
        await this.recordMovement({
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            location_id: stock.location_id || undefined,
            type: StockMovementType.OUT,
            quantity: -quantity,
            previous_balance: previousBalance,
            new_balance: stock.quantity,
            reference_type: 'sale',
            reference_id: saleId,
            user_id: userId,
            notes: `Stock deducted for sale`,
        });

        // Real-time alert check
        this.alertService
            .checkLowStock(facilityId, medicineId)
            .catch((err) => console.error('Failed to trigger real-time alert check:', err));
    }

    /**
     * Restore stock from customer return - only if item is resellable
     * Links stock movement to return transaction
     */
    async restoreStockFromReturn(
        facilityId: number,
        organizationId: number,
        medicineId: number,
        batchId: number,
        quantity: number,
        returnId: number,
        userId: number,
        departmentId?: number,
    ): Promise<void> {
        const whereCondition: any = {
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            is_deleted: false,
        };
        if (departmentId === null || departmentId === undefined) {
            whereCondition.department_id = IsNull();
        } else {
            whereCondition.department_id = departmentId;
        }

        let stock = await this.stockRepository.findOne({ where: whereCondition });

        const previousBalance = stock?.quantity || 0;

        if (!stock) {
            // Create new stock record if doesn't exist
            const batch = await this.batchService.findOne(batchId, organizationId);
            stock = this.stockRepository.create({
                facility_id: facilityId,
                organization_id: organizationId,
                department_id: departmentId,
                medicine_id: medicineId,
                batch_id: batchId,
                quantity: quantity,
                reserved_quantity: 0,
                unit_cost: batch.unit_cost,
                unit_price: undefined,
            });
        } else {
            stock.quantity += quantity;
        }

        await this.batchService.increaseQuantity(batchId, quantity, organizationId);
        await this.stockRepository.save(stock);

        // Create stock movement linked to return
        await this.recordMovement({
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            location_id: stock.location_id || undefined,
            type: StockMovementType.RETURN,
            quantity: quantity,
            previous_balance: previousBalance,
            new_balance: stock.quantity,
            reference_type: 'customer_return',
            reference_id: returnId,
            user_id: userId,
            notes: `Stock restored from customer return`,
        });
    }

    /**
     * Get batch cost for COGS calculation at sale time
     */
    async getBatchCost(batchId: number, organizationId: number): Promise<number> {
        const batch = await this.batchService.findOne(batchId, organizationId);
        if (!batch.unit_cost) {
            throw new AppError('Batch unit cost not set', 400);
        }
        return Number(batch.unit_cost);
    }

    /**
     * Check if sufficient stock is available before creating sale
     */
    async checkStockAvailability(
        facilityId: number,
        organizationId: number,
        medicineId: number,
        batchId: number,
        quantity: number,
        departmentId?: number,
        lock: boolean = false,
    ): Promise<boolean> {
        const whereCondition: any = {
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: medicineId,
            batch_id: batchId,
            is_deleted: false,
        };
        if (departmentId === null || departmentId === undefined) {
            whereCondition.department_id = IsNull();
        } else {
            whereCondition.department_id = departmentId;
        }

        const stock = await this.stockRepository.findOne({
            where: whereCondition,
            ...(lock ? { lock: { mode: 'pessimistic_write' } } : {}),
        });

        if (!stock || stock.is_frozen) return false;

        const availableQuantity = stock.quantity - stock.reserved_quantity;
        return availableQuantity >= quantity;
    }

    /**
     * Get total available stock for a medicine across all batches
     */
    async getTotalAvailableStock(facilityId: number, organizationId: number, medicineId: number, departmentId?: number): Promise<number> {
        const queryBuilder = this.stockRepository
            .createQueryBuilder('stock')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.medicine_id = :medicineId', { medicineId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false });

        if (departmentId === null || departmentId === undefined) {
            queryBuilder.andWhere('stock.department_id IS NULL');
        } else {
            queryBuilder.andWhere('stock.department_id = :departmentId', { departmentId });
        }

        const stocks = await queryBuilder.getMany();
        return stocks.reduce((total, stock) => total + (stock.quantity - stock.reserved_quantity), 0);
    }

    /**
     * Transfer stock between physical locations
     */
    async transferStockBetweenLocations(
        facilityId: number,
        organizationId: number,
        sourceStockId: number,
        targetLocationId: number,
        quantity: number,
        userId: number,
        notes?: string,
    ): Promise<void> {
        const sourceStock = await this.stockRepository.findOne({
            where: { id: sourceStockId, facility_id: facilityId, organization_id: organizationId, is_deleted: false },
            lock: { mode: 'pessimistic_write' },
        });

        if (!sourceStock) {
            throw new AppError('Source stock record not found', 404);
        }

        if (sourceStock.location_id === targetLocationId) {
            throw new AppError('Source and target locations are the same', 400);
        }

        const availableQuantity = sourceStock.quantity - sourceStock.reserved_quantity;
        if (availableQuantity < quantity) {
            throw new AppError(`Insufficient stock at source. Available: ${availableQuantity}`, 400);
        }

        if (targetLocationId) {
            await this.validateStorageCondition(sourceStock.medicine_id, targetLocationId, organizationId);
        }

        // 1. Deduct from source
        const previousSourceBalance = sourceStock.quantity;
        sourceStock.quantity -= quantity;
        await this.stockRepository.save(sourceStock);

        // Record movement for source
        await this.recordMovement({
            facility_id: facilityId,
            organization_id: organizationId,
            medicine_id: sourceStock.medicine_id,
            batch_id: sourceStock.batch_id,
            location_id: sourceStock.location_id || undefined,
            type: StockMovementType.TRANSFER_OUT,
            reason: AdjustmentReason.TRANSFER,
            quantity: -quantity,
            previous_balance: previousSourceBalance,
            new_balance: sourceStock.quantity,
            reference_type: 'stock_transfer',
            reference_id: sourceStockId,
            user_id: userId,
            notes: notes || 'Stock transfer between shelves',
        });

        // 2. Add to target
        await this.addStock(
            facilityId,
            organizationId,
            sourceStock.department_id,
            targetLocationId,
            sourceStock.medicine_id,
            sourceStock.batch_id,
            quantity,
            sourceStock.unit_cost,
            sourceStock.unit_price,
            {
                type: StockMovementType.TRANSFER_IN,
                reason: AdjustmentReason.TRANSFER,
                reference_type: 'stock_transfer',
                reference_id: sourceStockId,
                user_id: userId,
                notes: notes || 'Stock transfer between shelves',
            },
        );
    }

    /**
     * Add multiple batches of stock (Manual Entry / Receiving)
     */
    async addBatches(
        facilityId: number,
        organizationId: number,
        medicineId: number,
        batches: Array<{
            batch_number: string;
            expiry_date: string;
            manufacturing_date?: string;
            quantity: number;
            unit_cost: number;
        }>,
        storageLocationId?: number | null,
        userId?: number,
    ): Promise<Stock[]> {
        const results: Stock[] = [];

        await AppDataSource.transaction(async (transactionalEntityManager) => {
            const batchService = new BatchService(transactionalEntityManager);
            const stockService = new StockService(transactionalEntityManager);
            const medicine = await transactionalEntityManager.findOne(Medicine, {
                where: { id: medicineId, organization_id: organizationId },
            });
            let requiredSellingFloor = Number(medicine?.selling_price || 0);

            for (const batchData of batches) {
                // Check if batch exists
                let batch = await transactionalEntityManager.findOne(Batch, {
                    where: {
                        medicine_id: medicineId,
                        batch_number: batchData.batch_number,
                        facility_id: facilityId,
                        organization_id: organizationId,
                    },
                });

                if (!batch) {
                    batch = await batchService.create({
                        medicine_id: medicineId,
                        facility_id: facilityId,
                        organization_id: organizationId,
                        batch_number: batchData.batch_number,
                        expiry_date: batchData.expiry_date,
                        manufacturing_date: batchData.manufacturing_date || new Date().toISOString(),
                        initial_quantity: batchData.quantity,
                        unit_cost: batchData.unit_cost,
                    }, organizationId);
                } else {
                    await batchService.increaseQuantity(batch.id, batchData.quantity, organizationId);
                }

                // Add Stock
                const stock = await stockService.addStock(
                    facilityId,
                    organizationId,
                    null,
                    storageLocationId || null,
                    medicineId,
                    batch.id,
                    batchData.quantity,
                    batchData.unit_cost,
                    undefined,
                    {
                        type: StockMovementType.IN,
                        reason: undefined, // Purchase is not an adjustment reason
                        user_id: userId,
                        notes: 'Manual stock entry',
                        reference_type: 'manual_entry',
                    },
                );
                results.push(stock);
                requiredSellingFloor = Math.max(requiredSellingFloor, Number(batchData.unit_cost || 0));
            }

            if (medicine && Number(medicine.selling_price || 0) < requiredSellingFloor) {
                medicine.selling_price = Number(requiredSellingFloor.toFixed(2));
                await transactionalEntityManager.save(medicine);
            }
        });

        return results;
    }

    private async validateStorageCondition(medicineId: number, locationId: number, organizationId?: number): Promise<void> {
        const medicine = await this.medicineRepository.findOne({
            where: organizationId ? { id: medicineId, organization_id: organizationId } : { id: medicineId },
        });
        const location = await this.storageLocationRepository.findOne({
            where: organizationId ? { id: locationId, organization_id: organizationId } : { id: locationId },
        });

        if (!medicine || !location) return;

        const conditions = medicine.storage_conditions?.toLowerCase() || '';
        const tempType = location.temperature_type;

        // Simple validation mapping
        if (conditions.includes('cold') || conditions.includes('2-8')) {
            if (tempType !== 'COLD') {
                throw new AppError(
                    `Medicine ${medicine.name} requires COLD storage, but ${location.name} is ${tempType}`,
                    400,
                );
            }
        } else if (conditions.includes('frozen') || conditions.includes('below 0')) {
            if (tempType !== 'FROZEN') {
                throw new AppError(
                    `Medicine ${medicine.name} requires FROZEN storage, but ${location.name} is ${tempType}`,
                    400,
                );
            }
        }

        const requiresColdChain =
            conditions.includes('cold') ||
            conditions.includes('2-8') ||
            conditions.includes('frozen') ||
            conditions.includes('below 0');

        if (requiresColdChain) {
            const activeExcursion = await this.coldChainExcursionRepository.findOne({
                where: {
                    facility_id: location.facility_id,
                    organization_id: organizationId || location.facility?.organization_id,
                    storage_location_id: location.id,
                    status: In([ColdChainExcursionStatus.OPEN, ColdChainExcursionStatus.ACKNOWLEDGED]),
                },
            });

            if (activeExcursion) {
                throw new AppError(
                    `Location ${location.name} has an active cold-chain excursion. Resolve it before storing ${medicine.name}.`,
                    409,
                );
            }
        }
    }
    async getEarliestExpiringBatch(facilityId: number, organizationId: number, medicineId: number): Promise<Batch | null> {
        const result = await this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.batch', 'batch')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.medicine_id = :medicineId', { medicineId })
            .andWhere('stock.quantity > 0')
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .orderBy('batch.expiry_date', 'ASC')
            .getOne();

        return result ? result.batch : null;
    }

    async downloadTemplate(): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Stock Import Template');

        worksheet.columns = [
            { header: 'medicine_code', key: 'medicine_code', width: 24 },
            { header: 'batch_number', key: 'batch_number', width: 20 },
            { header: 'expiry_date', key: 'expiry_date', width: 16 },
            { header: 'manufacturing_date', key: 'manufacturing_date', width: 20 },
            { header: 'quantity', key: 'quantity', width: 14 },
            { header: 'unit_cost', key: 'unit_cost', width: 14 },
            { header: 'storage_location_code', key: 'storage_location_code', width: 24 },
        ];

        worksheet.addRow({
            medicine_code: 'PARA-500MG-TAB',
            batch_number: 'BATCH-2026-001',
            expiry_date: '2027-12-31',
            manufacturing_date: '2026-01-01',
            quantity: 100,
            unit_cost: 25.5,
            storage_location_code: 'SLF-A',
        });

        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    async importBatchesFromExcel(
        fileBuffer: Buffer,
        facilityId: number,
        organizationId: number,
        userId?: number,
    ): Promise<{ imported: number; errors: string[] }> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer as any);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            throw new AppError('Invalid template: worksheet not found', 400);
        }

        const headerRow = worksheet.getRow(1);
        const headerIndex: Record<string, number> = {};
        headerRow.eachCell((cell, colNumber) => {
            const normalized = String(cell.value || '')
                .trim()
                .toLowerCase();
            if (normalized) {
                headerIndex[normalized] = colNumber;
            }
        });

        const requiredHeaders = ['medicine_code', 'batch_number', 'expiry_date', 'quantity'];
        const missingHeaders = requiredHeaders.filter((header) => !headerIndex[header]);
        if (missingHeaders.length > 0) {
            throw new AppError(`Missing required columns: ${missingHeaders.join(', ')}`, 400);
        }

        const errors: string[] = [];
        let imported = 0;

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            const medicineCode = String(row.getCell(headerIndex['medicine_code']).value || '').trim();
            const batchNumber = String(row.getCell(headerIndex['batch_number']).value || '').trim();
            const expiryRaw = row.getCell(headerIndex['expiry_date']).value;
            const quantityRaw = row.getCell(headerIndex['quantity']).value;

            const rowIsEmpty = !medicineCode && !batchNumber && !expiryRaw && !quantityRaw;
            if (rowIsEmpty) {
                continue;
            }

            try {
                if (!medicineCode) {
                    throw new Error('medicine_code is required');
                }
                if (!batchNumber) {
                    throw new Error('batch_number is required');
                }

                const medicine = await this.medicineRepository.findOne({
                    where: { code: medicineCode, organization_id: organizationId },
                });
                if (!medicine) {
                    throw new Error(`medicine_code "${medicineCode}" not found`);
                }

                const expiryDate = new Date(String(expiryRaw || ''));
                if (Number.isNaN(expiryDate.getTime())) {
                    throw new Error(`invalid expiry_date "${expiryRaw}"`);
                }

                const manufacturingIdx = headerIndex['manufacturing_date'];
                const manufacturingRaw = manufacturingIdx ? row.getCell(manufacturingIdx).value : undefined;
                const manufacturingDate = manufacturingRaw ? new Date(String(manufacturingRaw)) : new Date();
                if (Number.isNaN(manufacturingDate.getTime())) {
                    throw new Error(`invalid manufacturing_date "${manufacturingRaw}"`);
                }

                const quantity = Number(quantityRaw);
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error(`invalid quantity "${quantityRaw}"`);
                }

                const unitCostIdx = headerIndex['unit_cost'];
                const unitCostRaw = unitCostIdx ? row.getCell(unitCostIdx).value : 0;
                const unitCost = Number(unitCostRaw || 0);
                if (!Number.isFinite(unitCost) || unitCost < 0) {
                    throw new Error(`invalid unit_cost "${unitCostRaw}"`);
                }

                let locationId: number | null = null;
                const locationCodeIdx = headerIndex['storage_location_code'];
                const locationCode = locationCodeIdx ? String(row.getCell(locationCodeIdx).value || '').trim() : '';

                if (locationCode) {
                    const location = await this.storageLocationRepository.findOne({
                        where: {
                            facility_id: facilityId,
                            organization_id: organizationId,
                            code: locationCode,
                            is_active: true,
                        },
                    });
                    if (!location) {
                        throw new Error(`storage_location_code "${locationCode}" not found`);
                    }
                    locationId = location.id;
                }

                await this.addBatches(
                    facilityId,
                    organizationId,
                    medicine.id,
                    [
                        {
                            batch_number: batchNumber,
                            expiry_date: expiryDate.toISOString(),
                            manufacturing_date: manufacturingDate.toISOString(),
                            quantity,
                            unit_cost: unitCost,
                        },
                    ],
                    locationId,
                    userId,
                );
                imported += 1;
            } catch (error: any) {
                errors.push(`Row ${rowNumber}: ${error.message}`);
            }
        }

        return { imported, errors };
    }
}
