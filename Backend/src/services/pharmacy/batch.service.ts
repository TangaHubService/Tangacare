import { Repository, MoreThan, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Batch } from '../../entities/Batch.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { Stock, StockStatus } from '../../entities/Stock.entity';
import { StockMovement } from '../../entities/StockMovement.entity';
import { CreateBatchDto, UpdateBatchDto } from '../../dto/pharmacy.dto';
import type { OperationalBatchRowDto, OperationalBatchStatus } from '../../dto/operational-batch.dto';

const LOW_BATCH_SELLABLE_THRESHOLD = 5;
const EXPIRING_SOON_DAYS = 30;

export class BatchService {
    private batchRepository: Repository<Batch>;
    private medicineRepository: Repository<Medicine>;
    private stockRepository: Repository<Stock>;
    private movementRepository: Repository<StockMovement>;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.batchRepository = source.getRepository(Batch);
        this.medicineRepository = source.getRepository(Medicine);
        this.stockRepository = source.getRepository(Stock);
        this.movementRepository = source.getRepository(StockMovement);
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

    /**
     * Facility-scoped batch rows aggregated from `stocks` for dispensing / FEFO / expiry execution.
     * Expired batches are included. `sellableQty` is zero when batch is expired or only non-saleable stock exists.
     */
    async findOperationalBatches(
        organizationId: number,
        facilityId: number,
        filters?: {
            medicine?: string;
            batch?: string;
            status?: 'all' | 'expired' | 'expiring_soon' | 'zero_stock' | 'blocked';
            sort?:
                | 'expiry_asc'
                | 'expiry_desc'
                | 'available_desc'
                | 'available_asc'
                | 'sellable_desc'
                | 'movement_desc';
        },
    ): Promise<OperationalBatchRowDto[]> {
        const medicineQ = (filters?.medicine || '').trim().toLowerCase();
        const batchQ = (filters?.batch || '').trim().toLowerCase();
        const statusFilter = filters?.status || 'all';
        const sort = filters?.sort || 'expiry_asc';

        const qb = this.stockRepository
            .createQueryBuilder('s')
            .innerJoin('s.batch', 'b')
            .innerJoin('b.medicine', 'm')
            .leftJoin('s.location', 'loc')
            .where('s.facility_id = :facilityId', { facilityId })
            .andWhere('s.is_deleted = false')
            .andWhere('b.organization_id = :organizationId', { organizationId })
            .select('b.id', 'batchId')
            .addSelect('b.medicine_id', 'medicineId')
            .addSelect('m.name', 'medicineName')
            .addSelect('b.batch_number', 'batchNumber')
            .addSelect('b.expiry_date', 'expiryDate')
            .addSelect('MAX(b.unit_cost)', 'unitCost')
            .addSelect('MAX(b.unit_price)', 'unitPrice')
            .addSelect('MAX(CASE WHEN m.is_controlled_drug = true THEN 1 ELSE 0 END)', 'controlledInt')
            .addSelect('SUM(s.quantity)', 'availableQty')
            .addSelect('SUM(s.reserved_quantity)', 'reservedQty')
            .addSelect(
                `SUM(CASE
                    WHEN s.is_frozen = true THEN 0
                    WHEN s.stock_status != :saleable THEN 0
                    WHEN b.expiry_date < CURRENT_DATE THEN 0
                    ELSE GREATEST(0, s.quantity - COALESCE(s.reserved_quantity, 0))
                END)`,
                'sellableQty',
            )
            .addSelect(
                `BOOL_OR(s.is_frozen = true OR s.stock_status != :saleable)`,
                'hasNonSaleableOrFrozen',
            )
            .setParameter('saleable', StockStatus.SALEABLE)
            .addSelect(`STRING_AGG(loc.name, ', ')`, 'locationName')
            .groupBy('b.id')
            .addGroupBy('b.medicine_id')
            .addGroupBy('m.name')
            .addGroupBy('b.batch_number')
            .addGroupBy('b.expiry_date');

        if (medicineQ) {
            qb.andWhere('LOWER(m.name) LIKE :medicineLike', { medicineLike: `%${medicineQ}%` });
        }
        if (batchQ) {
            qb.andWhere('LOWER(b.batch_number) LIKE :batchLike', { batchLike: `%${batchQ}%` });
        }

        const rawRows = await qb.getRawMany();

        const movementRows = await this.movementRepository
            .createQueryBuilder('sm')
            .select('sm.batch_id', 'batchId')
            .addSelect('MAX(sm.created_at)', 'lastAt')
            .where('sm.facility_id = :facilityId', { facilityId })
            .groupBy('sm.batch_id')
            .getRawMany();

        const lastMoveMap = new Map<number, Date>();
        for (const r of movementRows) {
            const id = Number((r as any).batchId ?? (r as any).sm_batch_id);
            const at = (r as any).lastAt ?? (r as any).max;
            if (id && at) lastMoveMap.set(id, new Date(at));
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const rows: OperationalBatchRowDto[] = rawRows.map((row) => {
            const r = row as Record<string, unknown>;
            const batchId = Number(r.batchId ?? r.b_id);
            const expiry = r.expiryDate instanceof Date ? r.expiryDate : new Date(String(r.expiryDate));
            const expiryDay = new Date(expiry);
            expiryDay.setHours(0, 0, 0, 0);
            const daysToExpiry = Math.round((expiryDay.getTime() - startOfToday.getTime()) / 86400000);
            const isExpired = daysToExpiry < 0;
            const isExpiringSoon = !isExpired && daysToExpiry <= EXPIRING_SOON_DAYS;

            const availableQty = Number(r.availableQty ?? r.sum ?? 0);
            const reservedQty = Number(r.reservedQty ?? 0);
            const sellableRaw = Number(r.sellableQty ?? 0);
            const sellableQty = isExpired ? 0 : sellableRaw;

            let batchStatus: OperationalBatchStatus;
            if (isExpired) {
                batchStatus = 'EXPIRED';
            } else if (availableQty <= 0) {
                batchStatus = 'OUT_OF_STOCK';
            } else if (sellableQty <= 0) {
                batchStatus = 'BLOCKED';
            } else if (isExpiringSoon) {
                batchStatus = 'EXPIRING_SOON';
            } else if (sellableQty <= LOW_BATCH_SELLABLE_THRESHOLD) {
                batchStatus = 'LOW_BATCH_STOCK';
            } else {
                batchStatus = 'ACTIVE';
            }

            const isBlocked = batchStatus === 'BLOCKED';
            const isOutOfStock = batchStatus === 'OUT_OF_STOCK';

            const last = lastMoveMap.get(batchId);
            return {
                batchId,
                medicineId: Number(r.medicineId ?? r.b_medicine_id),
                medicineName: String(r.medicineName || ''),
                batchNumber: String(r.batchNumber || ''),
                expiryDate: expiryDay.toISOString().slice(0, 10),
                daysToExpiry: Number.isFinite(daysToExpiry) ? daysToExpiry : null,
                availableQty,
                reservedQty,
                sellableQty,
                batchStatus,
                isExpired,
                isExpiringSoon,
                isOutOfStock,
                isBlocked,
                isFefoCandidate: false,
                locationName: r.locationName ? String(r.locationName) : null,
                lastMovementAt: last ? last.toISOString() : null,
                unitCost: r.unitCost != null ? Number(r.unitCost) : null,
                unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
                controlledDrug: Number(r.controlledInt ?? r.controlledDrug ?? 0) === 1,
            };
        });

        const fefoByMedicine = new Map<number, number>();
        const eligible = rows.filter((row) => !row.isExpired && row.sellableQty > 0);
        const byMed = new Map<number, OperationalBatchRowDto[]>();
        for (const row of eligible) {
            const list = byMed.get(row.medicineId) || [];
            list.push(row);
            byMed.set(row.medicineId, list);
        }
        for (const [, list] of byMed) {
            list.sort(
                (a, b) =>
                    new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime() || a.batchId - b.batchId,
            );
            if (list[0]) fefoByMedicine.set(list[0].medicineId, list[0].batchId);
        }
        for (const row of rows) {
            row.isFefoCandidate = fefoByMedicine.get(row.medicineId) === row.batchId && row.sellableQty > 0 && !row.isExpired;
        }

        let out = rows;
        if (statusFilter === 'expired') out = out.filter((x) => x.isExpired);
        else if (statusFilter === 'expiring_soon') out = out.filter((x) => x.isExpiringSoon);
        else if (statusFilter === 'zero_stock') out = out.filter((x) => x.isOutOfStock);
        else if (statusFilter === 'blocked') out = out.filter((x) => x.isBlocked);

        const cmp = (a: OperationalBatchRowDto, b: OperationalBatchRowDto) => {
            switch (sort) {
                case 'expiry_desc':
                    return new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime();
                case 'available_desc':
                    return b.availableQty - a.availableQty;
                case 'available_asc':
                    return a.availableQty - b.availableQty;
                case 'sellable_desc':
                    return b.sellableQty - a.sellableQty;
                case 'movement_desc': {
                    const ta = a.lastMovementAt ? new Date(a.lastMovementAt).getTime() : 0;
                    const tb = b.lastMovementAt ? new Date(b.lastMovementAt).getTime() : 0;
                    return tb - ta;
                }
                case 'expiry_asc':
                default:
                    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }
        };
        out.sort(cmp);
        return out;
    }
}
