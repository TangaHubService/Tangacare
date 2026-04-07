import { Repository, EntityManager, IsNull } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { PhysicalCount, PhysicalCountStatus, PhysicalCountItem } from '../../entities/PhysicalCount.entity';
import { Stock } from '../../entities/Stock.entity';
import { StockMovement, StockMovementType } from '../../entities/StockMovement.entity';
import { Batch } from '../../entities/Batch.entity';

export class PhysicalCountService {
    private physicalCountRepository: Repository<PhysicalCount>;
    private physicalCountItemRepository: Repository<PhysicalCountItem>;

    constructor() {
        this.physicalCountRepository = AppDataSource.getRepository(PhysicalCount);
        this.physicalCountItemRepository = AppDataSource.getRepository(PhysicalCountItem);
    }

    async createPhysicalCount(facilityId: number, organizationId: number, userId: number, medicineIds?: number[]): Promise<PhysicalCount> {
        return await AppDataSource.transaction(async (manager: EntityManager) => {
            const count = manager.create(PhysicalCount, {
                facility_id: facilityId,
                organization_id: organizationId,
                counted_by_id: userId,
                count_date: new Date(),
                status: PhysicalCountStatus.IN_PROGRESS,
            });

            const savedCount = await manager.save(count);

            // Fetch current stock levels for selected medicines or all medicines in facility
            const stockQuery = manager
                .createQueryBuilder(Stock, 'stock')
                .leftJoinAndSelect('stock.batch', 'batch')
                .where('stock.facility_id = :facilityId', { facilityId })
                .andWhere('stock.organization_id = :organizationId', { organizationId })
                .andWhere('stock.quantity > 0');

            if (medicineIds && medicineIds.length > 0) {
                stockQuery.andWhere('stock.medicine_id IN (:...medicineIds)', { medicineIds });
            }

            const stocks = await stockQuery.getMany();

            const items = stocks.map((stock) => {
                return manager.create(PhysicalCountItem, {
                    physical_count_id: savedCount.id,
                    medicine_id: stock.medicine_id,
                    batch_id: stock.batch_id,
                    organization_id: organizationId,
                    location_id: stock.location_id,
                    system_quantity: stock.quantity,
                    counted_quantity: stock.quantity, // Default to system quantity
                    variance: 0,
                });
            });

            await manager.save(items);
            savedCount.items = items;
            return savedCount;
        });
    }

    async updateCountItem(itemId: number, countedQuantity: number, notes?: string): Promise<PhysicalCountItem> {
        const item = await this.physicalCountItemRepository.findOne({
            where: { id: itemId },
        });

        if (!item) {
            throw new Error('Count item not found');
        }

        item.counted_quantity = countedQuantity;
        item.variance = countedQuantity - item.system_quantity;
        if (notes) item.notes = notes;

        return await this.physicalCountItemRepository.save(item);
    }

    async freezePhysicalCount(countId: number, organizationId: number): Promise<PhysicalCount> {
        return await AppDataSource.transaction(async (manager: EntityManager) => {
            const count = await manager.findOne(PhysicalCount, {
                where: { id: countId, organization_id: organizationId },
                relations: ['items'],
            });

            if (!count) throw new Error('Physical count not found');
            if (count.status !== PhysicalCountStatus.IN_PROGRESS) {
                throw new Error('Only counts in progress can be frozen');
            }

            for (const item of count.items) {
                await manager.update(Stock, {
                    facility_id: count.facility_id,
                    organization_id: count.organization_id,
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    location_id: item.location_id || IsNull(),
                }, { is_frozen: true });
            }

            count.status = PhysicalCountStatus.FROZEN;
            return await manager.save(count);
        });
    }

    async approvePhysicalCount(countId: number, organizationId: number, userId: number): Promise<PhysicalCount> {
        return await AppDataSource.transaction(async (manager: EntityManager) => {
            const count = await manager.findOne(PhysicalCount, {
                where: { id: countId, organization_id: organizationId },
                relations: ['items', 'items.medicine'],
            });

            if (!count) throw new Error('Physical count not found');
            if (count.status !== PhysicalCountStatus.IN_PROGRESS && count.status !== PhysicalCountStatus.FROZEN) {
                throw new Error('Only counts in progress or frozen can be approved');
            }

            for (const item of count.items) {
                if (item.variance !== 0) {
                    // Update Stock
                    const stock = await manager.findOne(Stock, {
                        where: {
                            facility_id: count.facility_id,
                            organization_id: count.organization_id,
                            medicine_id: item.medicine_id,
                            batch_id: item.batch_id,
                            location_id: item.location_id || IsNull(),
                        },
                    });

                    if (stock) {
                        const previousBalance = stock.quantity;
                        stock.quantity = item.counted_quantity;
                        await manager.save(stock);

                        // Record Stock Movement
                        const movement = manager.create(StockMovement, {
                            facility_id: count.facility_id,
                            organization_id: count.organization_id,
                            medicine_id: item.medicine_id,
                            batch_id: item.batch_id,
                            type: StockMovementType.ADJUSTMENT,
                            quantity: item.variance,
                            previous_balance: previousBalance,
                            new_balance: item.counted_quantity,
                            user_id: userId,
                            reference_type: 'physical_count',
                            reference_id: count.id,
                            location_id: item.location_id || undefined,
                            notes: `Physical reconciliation: ${item.notes || 'No notes'}`,
                        });
                        await manager.save(movement);

                        // Also update current_quantity in Batch entity
                        const batch = await manager.findOne(Batch, {
                            where: { id: item.batch_id, organization_id: count.organization_id },
                        });
                        if (batch) {
                            batch.current_quantity = item.counted_quantity;
                            await manager.save(batch);
                        }
                    }
                }
            }

            for (const item of count.items) {
                await manager.update(Stock, {
                    facility_id: count.facility_id,
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    location_id: item.location_id || IsNull(),
                }, { is_frozen: false });
            }

            count.status = PhysicalCountStatus.APPROVED;
            count.approved_by_id = userId;
            count.approved_at = new Date();

            return await manager.save(count);
        });
    }

    async cancelPhysicalCount(countId: number, organizationId: number): Promise<PhysicalCount> {
        return await AppDataSource.transaction(async (manager: EntityManager) => {
            const count = await manager.findOne(PhysicalCount, {
                where: { id: countId, organization_id: organizationId },
                relations: ['items'],
            });

            if (!count) throw new Error('Physical count not found');

            // Unfreeze stocks if frozen
            for (const item of count.items) {
                await manager.update(Stock, {
                    facility_id: count.facility_id,
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    location_id: item.location_id || IsNull(),
                }, { is_frozen: false });
            }

            count.status = PhysicalCountStatus.CANCELLED;
            return await manager.save(count);
        });
    }

    async getPhysicalCount(countId: number, organizationId?: number): Promise<PhysicalCount> {
        const count = await this.physicalCountRepository.findOne({
            where: { id: countId, organization_id: organizationId },
            relations: ['items', 'items.medicine', 'items.batch', 'counted_by', 'approved_by'],
        });

        if (!count) throw new Error('Physical count not found');
        return count;
    }

    async listPhysicalCounts(facilityId: number, organizationId?: number): Promise<PhysicalCount[]> {
        const where: any = { facility_id: facilityId };
        if (organizationId) where.organization_id = organizationId;
        return await this.physicalCountRepository.find({
            where,
            order: { created_at: 'DESC' },
            relations: ['counted_by', 'approved_by'],
        });
    }
}
