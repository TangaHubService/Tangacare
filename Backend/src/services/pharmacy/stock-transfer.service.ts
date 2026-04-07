import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { StockTransfer, StockTransferItem, StockTransferStatus } from '../../entities/StockTransfer.entity';
import { StockService } from './stock.service';
import { CreateStockTransferDto, UpdateStockTransferDto } from '../../dto/pharmacy.dto';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { StockMovementType } from '../../entities/StockMovement.entity';
import { EntityManager } from 'typeorm';
import { generateDocumentNumber } from '../../utils/document-number.util';

export class StockTransferService {
    private transferRepository: Repository<StockTransfer>;
    private transferItemRepository: Repository<StockTransferItem>;
    private stockService: StockService;
    private auditService: AuditService;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.transferRepository = source.getRepository(StockTransfer);
        this.transferItemRepository = source.getRepository(StockTransferItem);
        this.stockService = new StockService(entityManager);
        this.auditService = new AuditService(entityManager);
    }

    async generateTransferNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('TRF');
    }

    async create(createDto: CreateStockTransferDto, initiatedById: number): Promise<StockTransfer> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            if (createDto.from_department_id === createDto.to_department_id) {
                throw new AppError('Source and destination departments cannot be the same', 400);
            }

            const transferNumber = await this.generateTransferNumber(createDto.facility_id!);

            const transfer = this.transferRepository.create({
                ...createDto,
                transfer_number: transferNumber,
                initiated_by_id: initiatedById,
                status: StockTransferStatus.PENDING,
                transfer_date: createDto.transfer_date ? new Date(createDto.transfer_date) : new Date(),
                from_location_id: createDto.from_location_id,
                to_location_id: createDto.to_location_id,
            });

            const savedTransfer = await queryRunner.manager.save(transfer);

            for (const itemDto of createDto.items) {
                const sourceStocks = await this.stockService.getStockByLocation(
                    createDto.facility_id!,
                    createDto.organization_id!,
                    createDto.from_department_id || null,
                    itemDto.medicine_id,
                );

                const sourceStock = sourceStocks.find((s) => s.batch_id === itemDto.batch_id);

                if (!sourceStock) {
                    throw new AppError(
                        `Stock not found for medicine ${itemDto.medicine_id}, batch ${itemDto.batch_id} at source location`,
                        404,
                    );
                }

                const availableQuantity = sourceStock.quantity - sourceStock.reserved_quantity;
                if (availableQuantity < itemDto.quantity) {
                    throw new AppError(
                        `Insufficient stock at source. Available: ${availableQuantity}, Requested: ${itemDto.quantity}`,
                        400,
                    );
                }

                // Verify expiration
                if (new Date(sourceStock.batch.expiry_date) < new Date()) {
                    await this.auditService.log({
                        facility_id: createDto.facility_id,
                        user_id: initiatedById,
                        organization_id: createDto.organization_id,
                        action: AuditAction.ACCESS_DENIED,
                        entity_type: AuditEntityType.BATCH,
                        entity_id: sourceStock.batch_id,
                        entity_name: sourceStock.batch.batch_number,
                        description: `BLOCKED: Attempted to transfer expired medicine batch ${sourceStock.batch.batch_number} for medicine ${itemDto.medicine_id}`,
                    });
                    throw new AppError(`Cannot transfer expired medicine: ${sourceStock.batch.batch_number}`, 400);
                }

                const transferItem = this.transferItemRepository.create({
                    transfer_id: savedTransfer.id,
                    medicine_id: itemDto.medicine_id,
                    batch_id: itemDto.batch_id,
                    quantity: itemDto.quantity,
                });

                await queryRunner.manager.save(transferItem);
            }

            await queryRunner.commitTransaction();
            await queryRunner.release();

            await this.auditService.log({
                facility_id: createDto.facility_id,
                user_id: initiatedById,
                organization_id: createDto.organization_id,
                action: AuditAction.TRANSFER,
                entity_type: AuditEntityType.STOCK_TRANSFER,
                entity_id: savedTransfer.id,
                entity_name: savedTransfer.transfer_number,
                description: `Stock transfer ${savedTransfer.transfer_number} created`,
            });

            return await this.findOne(savedTransfer.id, createDto.facility_id);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw error;
        }
    }

    async completeTransfer(transferId: number, receivedById: number, organizationId: number, facilityId?: number): Promise<StockTransfer> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const where: any = { id: transferId, organization_id: organizationId };
            if (facilityId) {
                where.facility_id = facilityId;
            }
            const transfer = await this.transferRepository.findOne({
                where,
                relations: ['items', 'facility', 'from_location', 'to_location'],
            });

            if (!transfer) {
                throw new AppError('Stock transfer not found', 404);
            }

            if (transfer.status === StockTransferStatus.COMPLETED) {
                throw new AppError('Transfer already completed', 400);
            }

            if (transfer.status === StockTransferStatus.CANCELLED) {
                throw new AppError('Cannot complete a cancelled transfer', 400);
            }

            const transactionalStockService = new StockService(queryRunner.manager);

            for (const item of transfer.items) {
                const sourceStocks = await transactionalStockService.getStockByLocation(
                    transfer.facility_id,
                    transfer.organization_id,
                    transfer.from_department_id || null,
                    item.medicine_id,
                );

                const sourceStock = sourceStocks.find((s) => s.batch_id === item.batch_id);
                if (!sourceStock) {
                    throw new AppError(`Source stock not found for item ${item.id}`, 404);
                }

                // Verify expiration at completion time
                if (new Date(sourceStock.batch.expiry_date) < new Date()) {
                    await this.auditService.log({
                        facility_id: transfer.facility_id,
                        user_id: receivedById,
                        organization_id: transfer.organization_id,
                        action: AuditAction.ACCESS_DENIED,
                        entity_type: AuditEntityType.BATCH,
                        entity_id: sourceStock.batch_id,
                        entity_name: sourceStock.batch.batch_number,
                        description: `BLOCKED: Attempted to complete transfer of expired medicine batch ${sourceStock.batch.batch_number}`,
                    });
                    throw new AppError(
                        `Cannot complete transfer for expired medicine batch: ${sourceStock.batch.batch_number}`,
                        400,
                    );
                }

                await transactionalStockService.deductStock(sourceStock.id, transfer.organization_id, item.quantity, {
                    type: StockMovementType.TRANSFER_OUT,
                    reference_type: 'STOCK_TRANSFER',
                    reference_id: transfer.id,
                    user_id: receivedById,
                    notes: `Transfer from ${transfer.from_department?.name || 'Main store'} to ${transfer.to_department?.name || 'Main store'}`,
                });

                await transactionalStockService.addStock(
                    transfer.facility_id,
                    transfer.organization_id,
                    transfer.to_department_id || null, // Ensure we use the target department
                    transfer.to_location_id || null, // and target location
                    item.medicine_id,
                    item.batch_id,
                    item.quantity,
                    sourceStock.unit_cost,
                    sourceStock.unit_price,
                    {
                        type: StockMovementType.TRANSFER_IN,
                        reference_type: 'STOCK_TRANSFER',
                        reference_id: transfer.id,
                        user_id: receivedById,
                        notes: `Transfer received from ${transfer.from_department?.name || 'Main store'}`,
                    },
                );
            }

            transfer.status = StockTransferStatus.COMPLETED;
            transfer.received_by_id = receivedById;
            transfer.transfer_date = new Date();

            const updatedTransfer = await queryRunner.manager.save(transfer);

            await queryRunner.commitTransaction();
            await queryRunner.release();

            await this.auditService.log({
                facility_id: transfer.facility_id,
                user_id: receivedById,
                organization_id: transfer.organization_id,
                action: AuditAction.TRANSFER,
                entity_type: AuditEntityType.STOCK_TRANSFER,
                entity_id: updatedTransfer.id,
                entity_name: updatedTransfer.transfer_number,
                description: `Stock transfer ${updatedTransfer.transfer_number} completed`,
            });

            return await this.findOne(transferId, transfer.facility_id);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw error;
        }
    }

    async cancelTransfer(transferId: number, userId: number, facilityId?: number): Promise<StockTransfer> {
        const transfer = await this.findOne(transferId, facilityId);

        if (transfer.status === StockTransferStatus.COMPLETED) {
            throw new AppError('Cannot cancel a completed transfer', 400);
        }

        if (transfer.status === StockTransferStatus.CANCELLED) {
            throw new AppError('Transfer already cancelled', 400);
        }

        transfer.status = StockTransferStatus.CANCELLED;
        const updatedTransfer = await this.transferRepository.save(transfer);

        await this.auditService.log({
            facility_id: transfer.facility_id,
            user_id: userId,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.STOCK_TRANSFER,
            entity_id: updatedTransfer.id,
            entity_name: updatedTransfer.transfer_number,
            description: `Stock transfer ${updatedTransfer.transfer_number} cancelled`,
        });

        return updatedTransfer;
    }

    async findAll(
        organizationId: number | undefined,
        facilityId?: number,
        status?: StockTransferStatus,
        fromDepartmentId?: number | null,
        toDepartmentId?: number | null,
        page: number = 1,
        limit: number = 10,
    ): Promise<{ data: StockTransfer[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.transferRepository
            .createQueryBuilder('transfer')
            .leftJoinAndSelect('transfer.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .leftJoinAndSelect('items.batch', 'batch')
            .leftJoinAndSelect('transfer.from_department', 'from_department')
            .leftJoinAndSelect('transfer.to_department', 'to_department')
            .leftJoinAndSelect('transfer.from_location', 'from_location')
            .leftJoinAndSelect('transfer.to_location', 'to_location')
            .leftJoinAndSelect('transfer.initiated_by', 'initiated_by')
            .leftJoinAndSelect('transfer.received_by', 'received_by');

        if (organizationId) {
            queryBuilder.where('transfer.organization_id = :organizationId', { organizationId });
        }

        if (facilityId) {
            queryBuilder.andWhere('transfer.facility_id = :facilityId', { facilityId });
        }

        if (status) {
            queryBuilder.andWhere('transfer.status = :status', { status });
        }

        if (fromDepartmentId !== undefined) {
            if (fromDepartmentId === null) {
                queryBuilder.andWhere('transfer.from_department_id IS NULL');
            } else {
                queryBuilder.andWhere('transfer.from_department_id = :fromDepartmentId', {
                    fromDepartmentId,
                });
            }
        }

        if (toDepartmentId !== undefined) {
            if (toDepartmentId === null) {
                queryBuilder.andWhere('transfer.to_department_id IS NULL');
            } else {
                queryBuilder.andWhere('transfer.to_department_id = :toDepartmentId', { toDepartmentId });
            }
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('transfer.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async findOne(id: number, organizationId?: number, facilityId?: number): Promise<StockTransfer> {
        const where: any = { id };
        if (organizationId) {
            where.organization_id = organizationId;
        }
        if (facilityId) {
            where.facility_id = facilityId;
        }
        const transfer = await this.transferRepository.findOne({
            where,
            relations: [
                'items',
                'items.medicine',
                'items.batch',
                'from_department',
                'to_department',
                'from_location',
                'to_location',
                'facility',
                'initiated_by',
                'received_by',
            ],
        });

        if (!transfer) {
            throw new AppError('Stock transfer not found', 404);
        }

        return transfer;
    }

    async update(id: number, updateDto: UpdateStockTransferDto, facilityId?: number): Promise<StockTransfer> {
        const transfer = await this.findOne(id, facilityId);

        if (transfer.status === StockTransferStatus.COMPLETED) {
            throw new AppError('Cannot update a completed transfer', 400);
        }

        Object.assign(transfer, {
            ...updateDto,
            transfer_date: updateDto.transfer_date ? new Date(updateDto.transfer_date) : transfer.transfer_date,
            status: updateDto.status || transfer.status,
        });

        return await this.transferRepository.save(transfer);
    }
}
