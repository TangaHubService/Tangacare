import { Repository, EntityManager, Brackets } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditLog, AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { StockMovement, StockMovementType } from '../../entities/StockMovement.entity';
import { SETTINGS_KEYS } from './settings.constants';
import * as crypto from 'crypto';

export interface ComplianceContext {
    immutableLogsEnabled: boolean;
    auditRetentionDays: number;
    separationOfDutyEnforced: boolean;
}

export interface AuditLogData {
    facility_id?: number;
    user_id?: number;
    action: AuditAction;
    entity_type: AuditEntityType;
    entity_id?: number;
    entity_name?: string;
    description?: string;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    organization_id?: number;
}

export class AuditService {
    private auditLogRepository: Repository<AuditLog>;
    private stockMovementRepository: Repository<StockMovement>;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.auditLogRepository = source.getRepository(AuditLog);
        this.stockMovementRepository = source.getRepository(StockMovement);
    }

    async log(data: AuditLogData): Promise<AuditLog> {
        // Get the latest log for hash chaining
        const lastLogScope =
            data.facility_id != null
                ? { facility_id: data.facility_id }
                : data.organization_id != null
                    ? { organization_id: data.organization_id }
                    : data.user_id != null
                        ? { user_id: data.user_id }
                        : {};
        const lastLog = await this.auditLogRepository.findOne({
            where: lastLogScope as any,
            order: { created_at: 'DESC' },
        });

        const previousHash = lastLog?.hash || '0'.repeat(64);

        const auditLog = this.auditLogRepository.create({
            facility_id: data.facility_id,
            user_id: data.user_id,
            action: data.action,
            entity_type: data.entity_type,
            entity_id: data.entity_id,
            entity_name: data.entity_name,
            description: data.description,
            old_values: data.old_values,
            new_values: data.new_values,
            ip_address: data.ip_address,
            user_agent: data.user_agent,
            organization_id: data.organization_id,
            previous_hash: previousHash,
        });

        // Compute hash
        const hashableData = JSON.stringify({
            facility_id: data.facility_id,
            user_id: data.user_id,
            action: data.action,
            entity_id: data.entity_id,
            description: data.description,
            old_values: data.old_values,
            new_values: data.new_values,
            organization_id: data.organization_id,
            previous_hash: previousHash,
        });

        auditLog.hash = crypto.createHash('sha256').update(hashableData).digest('hex');

        return await this.auditLogRepository.save(auditLog);
    }

    async findAll(
        facilityId?: number,
        userId?: number,
        entityType?: AuditEntityType,
        action?: AuditAction,
        page: number = 1,
        limit: number = 50,
        organizationId?: number,
    ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.auditLogRepository
            .createQueryBuilder('audit')
            .leftJoinAndSelect('audit.user', 'user')
            .leftJoinAndSelect('audit.facility', 'facility');

        if (facilityId) {
            queryBuilder.andWhere('audit.facility_id = :facilityId', { facilityId });
        }

        if (organizationId) {
            queryBuilder.andWhere('audit.organization_id = :organizationId', { organizationId });
        }

        if (userId) {
            queryBuilder.andWhere('audit.user_id = :userId', { userId });
        }

        if (entityType) {
            queryBuilder.andWhere('audit.entity_type = :entityType', { entityType });
        }

        if (action) {
            queryBuilder.andWhere('audit.action = :action', { action });
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('audit.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    /**
     * Get compliance settings for the tenant. Used to enforce retention and immutable behaviour.
     */
    async getComplianceContext(organizationId: number): Promise<ComplianceContext> {
        const { SettingsService } = await import('./settings.service');
        const settingsService = new SettingsService();
        const context = { tenantId: organizationId };
        const [immutable, retention, sod] = await Promise.all([
            settingsService.getEffectiveValue<boolean>(SETTINGS_KEYS.COMPLIANCE_IMMUTABLE_LOGS_ENABLED, context).catch(() => true),
            settingsService.getEffectiveValue<number>(SETTINGS_KEYS.COMPLIANCE_AUDIT_RETENTION_DAYS, context).catch(() => 1825),
            settingsService.getEffectiveValue<boolean>(SETTINGS_KEYS.COMPLIANCE_SOD_ENFORCED, context).catch(() => false),
        ]);
        return {
            immutableLogsEnabled: Boolean(immutable),
            auditRetentionDays: Number(retention) || 1825,
            separationOfDutyEnforced: Boolean(sod),
        };
    }

    /**
     * Purge audit logs older than retention days. Only runs when immutable_logs_enabled is false.
     * Call from a scheduled job or admin action; not automatic in this service.
     */
    async purgeOldLogsIfAllowed(organizationId: number): Promise<{ purged: number }> {
        const compliance = await this.getComplianceContext(organizationId);
        if (compliance.immutableLogsEnabled) {
            return { purged: 0 };
        }
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - compliance.auditRetentionDays);
        const result = await this.auditLogRepository
            .createQueryBuilder('audit')
            .delete()
            .where('organization_id = :organizationId', { organizationId })
            .andWhere('created_at < :cutoff', { cutoff })
            .execute();
        return { purged: result.affected ?? 0 };
    }

    async findOne(id: number, facilityId?: number, organizationId?: number): Promise<AuditLog> {
        const queryBuilder = this.auditLogRepository
            .createQueryBuilder('audit')
            .leftJoinAndSelect('audit.user', 'user')
            .leftJoinAndSelect('audit.facility', 'facility')
            .where('audit.id = :id', { id });

        if (facilityId) {
            queryBuilder.andWhere('audit.facility_id = :facilityId', { facilityId });
        }

        if (organizationId) {
            queryBuilder.andWhere('audit.organization_id = :organizationId', { organizationId });
        }

        const auditLog = await queryBuilder.getOne();

        if (!auditLog) {
            throw new Error('Audit log not found');
        }

        return auditLog;
    }

    async getStockMovements(
        facilityId?: number,
        startDate?: Date,
        endDate?: Date,
        page: number = 1,
        limit: number = 50,
        organizationId?: number,
        search?: string,
    ): Promise<{ data: StockMovementRow[]; total: number; page: number; limit: number }> {
        const qb = this.stockMovementRepository
            .createQueryBuilder('sm')
            .leftJoinAndSelect('sm.user', 'user')
            .leftJoinAndSelect('sm.medicine', 'medicine')
            .leftJoinAndSelect('sm.batch', 'batch')
            .leftJoin('sm.facility', 'facility');

        if (facilityId) {
            qb.where('sm.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            qb.where('facility.organization_id = :organizationId', { organizationId });
        }

        if (startDate) {
            qb.andWhere('sm.created_at >= :startDate', { startDate });
        }
        if (endDate) {
            const inclusiveEndDate = new Date(endDate);
            inclusiveEndDate.setHours(23, 59, 59, 999);
            qb.andWhere('sm.created_at <= :endDate', { endDate: inclusiveEndDate });
        }

        const term = (search || '').trim();
        if (term.length >= 2) {
            qb.andWhere(
                new Brackets((sub) => {
                    sub
                        .where('batch.batch_number ILIKE :searchTerm', { searchTerm: `%${term}%` })
                        .orWhere('medicine.name ILIKE :searchTerm', { searchTerm: `%${term}%` })
                        .orWhere('sm.notes ILIKE :searchTerm', { searchTerm: `%${term}%` })
                        .orWhere('sm.reference_type ILIKE :searchTerm', { searchTerm: `%${term}%` });
                }),
            );
        }

        qb.orderBy('sm.created_at', 'DESC');

        const skip = (page - 1) * limit;
        const [movements, total] = await qb.skip(skip).take(limit).getManyAndCount();

        const mapMovementType = (type: StockMovementType): AuditAction | 'return' => {
            if (type === StockMovementType.IN || type === StockMovementType.RETURN) return AuditAction.RECEIVE;
            if (type === StockMovementType.OUT) return AuditAction.DISPENSE;
            if (type === StockMovementType.ADJUSTMENT) return AuditAction.ADJUSTMENT;
            return AuditAction.TRANSFER;
        };

        const data: StockMovementRow[] = movements.map((movement) => {
            const user = movement.user as any;
            const medicine = movement.medicine as any;
            const batch = movement.batch as any;
            const typeLabel = String(movement.type || '').replace(/_/g, ' ');
            const fallbackReference = movement.reference_id
                ? `${movement.reference_type || typeLabel} #${movement.reference_id}`
                : (movement.reference_type || typeLabel);

            return {
                id: movement.id,
                created_at: movement.created_at,
                movement_type: mapMovementType(movement.type),
                entity_type: AuditEntityType.STOCK,
                entity_id: movement.reference_id ?? movement.id,
                entity_name: medicine?.name ?? undefined,
                reference: fallbackReference,
                user_id: movement.user_id ?? undefined,
                user_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : undefined,
                description:
                    movement.notes ||
                    `${typeLabel} ${Math.abs(Number(movement.quantity || 0))} of ${medicine?.name || 'medicine'}${batch?.batch_number ? ` (batch ${batch.batch_number})` : ''}`,
                quantity_delta: Number(movement.quantity || 0),
                old_values: { quantity: Number(movement.previous_balance || 0) },
                new_values: {
                    quantity: Number(movement.new_balance || 0),
                    reference_type: movement.reference_type || undefined,
                    reference_id: movement.reference_id || undefined,
                    location_id: movement.location_id || undefined,
                },
            };
        });

        return { data, total, page, limit };
    }

    async generateBatchTraceabilityReport(batchId: number): Promise<AuditLog[]> {
        return await this.auditLogRepository.find({
            where: [
                { entity_type: AuditEntityType.BATCH, entity_id: batchId },
                { entity_type: AuditEntityType.DISPENSE_TRANSACTION, new_values: { batch_id: batchId } },
                { entity_type: AuditEntityType.STOCK_TRANSFER, new_values: { batch_id: batchId } },
                { entity_type: AuditEntityType.STOCK, entity_id: batchId }, // Some stock logs use batch_id as entity_id
            ],
            relations: ['user', 'facility'],
            order: { created_at: 'ASC' },
        });
    }
}

export interface StockMovementRow {
    id: number;
    created_at: Date;
    movement_type: AuditAction | string;
    entity_type: AuditEntityType;
    entity_id?: number;
    entity_name?: string;
    reference: string;
    user_id?: number;
    user_name?: string;
    description?: string;
    quantity_delta?: number;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
}
