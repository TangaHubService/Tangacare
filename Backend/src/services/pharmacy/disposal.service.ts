import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { DisposalRequest, DisposalStatus, DisposalItem, DisposalType } from '../../entities/DisposalRequest.entity';
import { StockService } from './stock.service';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { StockMovementType, AdjustmentReason } from '../../entities/StockMovement.entity';
import { CreateDisposalRequestDto, DisposalFiltersDto } from '../../dto/pharmacy.dto';
import { generateDocumentNumber } from '../../utils/document-number.util';
import { Stock } from '../../entities/Stock.entity';

export class DisposalService {
    private disposalRepository: Repository<DisposalRequest>;
    private disposalItemRepository: Repository<DisposalItem>;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.disposalRepository = source.getRepository(DisposalRequest);
        this.disposalItemRepository = source.getRepository(DisposalItem);
    }

    async generateRequestNumber(): Promise<string> {
        return generateDocumentNumber('DISP');
    }

    async createDisposalRequest(createDto: CreateDisposalRequestDto, createdById: number): Promise<DisposalRequest> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const requestNumber = await this.generateRequestNumber();
            const disposalRequest = this.disposalRepository.create({
                ...createDto,
                request_number: requestNumber,
                organization_id: createDto.organization_id,
                created_by_id: createdById,
                status: DisposalStatus.SUBMITTED, // Defaulting to SUBMITTED as per P1 requirements for formal approval
            });

            // Calculate total value and validate stock
            let totalValue = 0;
            const items: DisposalItem[] = [];

            for (const itemDto of createDto.items) {
                const stock = await queryRunner.manager.findOne(Stock, {
                    where: {
                        facility_id: createDto.facility_id,
                        organization_id: createDto.organization_id,
                        medicine_id: itemDto.medicine_id,
                        batch_id: itemDto.batch_id,
                    },
                });

                if (!stock || stock.quantity < itemDto.quantity) {
                    throw new AppError(`Insufficient stock for medicine ID ${itemDto.medicine_id}, batch ID ${itemDto.batch_id}`, 400);
                }

                const unitCost = itemDto.unit_cost || Number(stock.unit_cost || 0);
                const lineValue = unitCost * itemDto.quantity;
                totalValue += lineValue;

                const disposalItem = this.disposalItemRepository.create({
                    ...itemDto,
                    organization_id: createDto.organization_id,
                    unit_cost: unitCost,
                    line_value: lineValue,
                });
                items.push(disposalItem);
            }

            disposalRequest.total_value = totalValue;
            disposalRequest.items = items;

            const savedRequest = await queryRunner.manager.save(disposalRequest);

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: createDto.facility_id,
                user_id: createdById,
                organization_id: createDto.organization_id,
                action: AuditAction.CREATE,
                entity_type: AuditEntityType.DISPOSAL_REQUEST,
                entity_id: savedRequest.id,
                entity_name: savedRequest.request_number,
                description: `Created disposal request ${savedRequest.request_number}`,
            });

            await queryRunner.commitTransaction();
            return savedRequest;
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async approveDisposalRequest(requestId: number, organizationId: number, approvedById: number): Promise<DisposalRequest> {
        const request = await this.disposalRepository.findOne({
            where: { id: requestId, organization_id: organizationId },
        });

        if (!request) throw new AppError('Disposal request not found', 404);
        if (request.status !== DisposalStatus.SUBMITTED) {
            throw new AppError('Only submitted requests can be approved', 400);
        }

        request.status = DisposalStatus.APPROVED;
        request.approved_by_id = approvedById;
        request.approved_at = new Date();

        const saved = await this.disposalRepository.save(request);

        const auditService = new AuditService();
        await auditService.log({
            facility_id: request.facility_id,
            user_id: approvedById,
            organization_id: request.organization_id,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.DISPOSAL_REQUEST,
            entity_id: request.id,
            entity_name: request.request_number,
            description: `Approved disposal request ${request.request_number}`,
        });

        return saved;
    }

    async witnessDisposalRequest(requestId: number, organizationId: number, witnessId: number): Promise<DisposalRequest> {
        const request = await this.disposalRepository.findOne({
            where: { id: requestId, organization_id: organizationId },
        });

        if (!request) throw new AppError('Disposal request not found', 404);
        if (request.type !== DisposalType.CONTROLLED) {
            throw new AppError('Witness step only required for controlled drugs', 400);
        }

        request.witness_by_id = witnessId;
        return await this.disposalRepository.save(request);
    }

    async postDisposalRequest(requestId: number, organizationId: number, postedById: number): Promise<DisposalRequest> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const request = await queryRunner.manager.findOne(DisposalRequest, {
                where: { id: requestId, organization_id: organizationId },
                relations: ['items'],
            });

            if (!request) throw new AppError('Disposal request not found', 404);
            if (request.status !== DisposalStatus.APPROVED) {
                throw new AppError('Request must be approved before posting', 400);
            }
            if (request.type === DisposalType.CONTROLLED && !request.witness_by_id) {
                throw new AppError('Controlled drugs disposal require a witness signature', 400);
            }

            const stockService = new StockService(queryRunner.manager);

            for (const item of request.items) {
                const stock = await queryRunner.manager.findOne(Stock, {
                    where: {
                        facility_id: request.facility_id,
                        organization_id: request.organization_id,
                        medicine_id: item.medicine_id,
                        batch_id: item.batch_id,
                    },
                });

                if (!stock || stock.quantity < item.quantity) {
                    throw new AppError(`Insufficient stock during posting: Medicine ${item.medicine_id}`, 400);
                }

                await stockService.deductStock(stock.id, request.organization_id, item.quantity, {
                    type: StockMovementType.OUT,
                    reason: this.mapReasonToAdjustment(request.reason),
                    reference_type: 'DISPOSAL_REQUEST',
                    reference_id: request.id,
                    user_id: postedById,
                    notes: `Disposal ${request.request_number}: ${item.notes || ''}`,
                });
            }

            request.status = DisposalStatus.POSTED;
            request.posted_at = new Date();
            const saved = await queryRunner.manager.save(request);

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: request.facility_id,
                user_id: postedById,
                organization_id: request.organization_id,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.DISPOSAL_REQUEST,
                entity_id: saved.id,
                entity_name: saved.request_number,
                description: `Posted disposal request ${saved.request_number} - stock adjusted`,
            });

            await queryRunner.commitTransaction();
            return saved;
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async voidDisposalRequest(requestId: number, organizationId: number, userId: number): Promise<DisposalRequest> {
        const request = await this.disposalRepository.findOne({ where: { id: requestId, organization_id: organizationId } });
        if (!request) throw new AppError('Disposal request not found', 404);
        if (request.status === DisposalStatus.POSTED) {
            throw new AppError('Cannot void a posted disposal', 400);
        }

        request.status = DisposalStatus.VOIDED;
        const saved = await this.disposalRepository.save(request);

        const auditService = new AuditService();
        await auditService.log({
            facility_id: request.facility_id,
            user_id: userId,
            organization_id: request.organization_id,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.DISPOSAL_REQUEST,
            entity_id: request.id,
            entity_name: request.request_number,
            description: `Voided disposal request ${request.request_number}`,
        });

        return saved;
    }

    async listDisposals(filters: DisposalFiltersDto): Promise<{ data: DisposalRequest[]; total: number }> {
        const query = this.disposalRepository.createQueryBuilder('dr')
            .leftJoinAndSelect('dr.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .leftJoinAndSelect('items.batch', 'batch')
            .leftJoinAndSelect('dr.created_by', 'created_by')
            .leftJoinAndSelect('dr.approved_by', 'approved_by')
            .leftJoinAndSelect('dr.witness_by', 'witness_by');

        if (filters.organization_id) {
            query.andWhere('dr.organization_id = :organizationId', { organizationId: filters.organization_id });
            if (filters.facility_id) {
                query.andWhere('dr.facility_id = :facilityId', { facilityId: filters.facility_id });
            }
        } else if (filters.facility_id) {
            query.andWhere('dr.facility_id = :facilityId', { facilityId: filters.facility_id });
        }
        if (filters.status) {
            query.andWhere('dr.status = :status', { status: filters.status });
        }
        if (filters.type) {
            query.andWhere('dr.type = :type', { type: filters.type });
        }
        if (filters.reason) {
            query.andWhere('dr.reason = :reason', { reason: filters.reason });
        }
        if (filters.start_date) {
            query.andWhere('dr.created_at >= :startDate', { startDate: filters.start_date });
        }
        if (filters.end_date) {
            query.andWhere('dr.created_at <= :endDate', { endDate: filters.end_date });
        }

        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const [data, total] = await query
            .orderBy('dr.created_at', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return { data, total };
    }

    async getDisposalRequest(id: number, organizationId?: number): Promise<DisposalRequest> {
        const request = await this.disposalRepository.findOne({
            where: { id, organization_id: organizationId },
            relations: ['items', 'items.medicine', 'items.batch', 'created_by', 'approved_by', 'witness_by'],
        });
        if (!request) throw new AppError('Disposal request not found', 404);
        return request;
    }

    private mapReasonToAdjustment(reason: string): AdjustmentReason {
        switch (reason) {
            case 'expired': return AdjustmentReason.EXPIRY;
            case 'damaged': return AdjustmentReason.DAMAGE;
            case 'recalled': return AdjustmentReason.OTHER;
            case 'quality_issue': return AdjustmentReason.OTHER;
            default: return AdjustmentReason.OTHER;
        }
    }
}
