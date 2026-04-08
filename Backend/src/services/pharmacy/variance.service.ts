import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { StockVariance, VarianceStatus, VarianceType } from '../../entities/StockVariance.entity';
import { Stock } from '../../entities/Stock.entity';
import { StockService } from './stock.service';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { StockMovementType, AdjustmentReason } from '../../entities/StockMovement.entity';
import { InventoryNotificationService } from './inventory-notification.service';
import { AlertType } from '../../entities/Alert.entity';
import { AlertService } from './alert.service';

export interface CreateVarianceDto {
    facility_id: number;
    organization_id: number;
    medicine_id: number;
    batch_id?: number;
    physical_quantity: number;
    variance_type: VarianceType;
    reason?: string;
    notes?: string;
    counted_by_id: number;
    counted_at?: Date;
}

export interface VarianceReportFilters {
    facility_id: number;
    organization_id?: number;
    start_date?: Date;
    end_date?: Date;
    status?: VarianceStatus;
    variance_type?: VarianceType;
    medicine_id?: number;
    page?: number;
    limit?: number;
}

export class VarianceService {
    private varianceRepository: Repository<StockVariance>;
    private stockRepository: Repository<Stock>;
    private stockService: StockService;
    private auditService: AuditService;
    private inventoryNotificationService: InventoryNotificationService;
    private alertService: AlertService;

    constructor() {
        this.varianceRepository = AppDataSource.getRepository(StockVariance);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.stockService = new StockService();
        this.auditService = new AuditService();
        this.inventoryNotificationService = new InventoryNotificationService();
        this.alertService = new AlertService();
    }

    private getVarianceSeverity(varianceQuantity: number, varianceValue: number): 'info' | 'warning' | 'critical' {
        const absoluteQuantity = Math.abs(Number(varianceQuantity || 0));
        const absoluteValue = Math.abs(Number(varianceValue || 0));

        if (absoluteQuantity >= 50 || absoluteValue >= 50000) {
            return 'critical';
        }

        if (absoluteQuantity >= 10 || absoluteValue >= 10000) {
            return 'warning';
        }

        return 'info';
    }

    async recordVariance(data: CreateVarianceDto): Promise<StockVariance> {
        // Get current system quantity
        let systemQuantity = 0;
        let unitCost = 0;

        if (data.batch_id) {
            // Batch-specific variance
            const stock = await this.stockRepository.findOne({
                where: {
                    facility_id: data.facility_id,
                    organization_id: data.organization_id,
                    medicine_id: data.medicine_id,
                    batch_id: data.batch_id,
                },
                relations: ['batch'],
            });

            if (stock) {
                systemQuantity = stock.quantity;
                unitCost = Number(stock.batch?.unit_cost || 0);
            }
        } else {
            // Total medicine variance (all batches)
            const stocks = await this.stockRepository.find({
                where: {
                    facility_id: data.facility_id,
                    organization_id: data.organization_id,
                    medicine_id: data.medicine_id,
                },
                relations: ['batch'],
            });

            systemQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
            // Use weighted average cost
            const totalValue = stocks.reduce((sum, s) => sum + s.quantity * Number(s.batch?.unit_cost || 0), 0);
            unitCost = systemQuantity > 0 ? totalValue / systemQuantity : 0;
        }

        const varianceQuantity = data.physical_quantity - systemQuantity;
        const varianceValue = varianceQuantity * unitCost;

        const variance = this.varianceRepository.create({
            facility_id: data.facility_id,
            organization_id: data.organization_id,
            medicine_id: data.medicine_id,
            batch_id: data.batch_id,
            system_quantity: systemQuantity,
            physical_quantity: data.physical_quantity,
            variance_quantity: varianceQuantity,
            unit_cost: unitCost,
            variance_value: varianceValue,
            variance_type: data.variance_type,
            status: VarianceStatus.PENDING,
            reason: data.reason,
            notes: data.notes,
            counted_by_id: data.counted_by_id,
            counted_at: data.counted_at || new Date(),
        });

        const saved = await this.varianceRepository.save(variance);

        // Reload with relations for notifications
        const varianceWithRelations = await this.varianceRepository.findOne({
            where: { id: saved.id },
            relations: ['medicine', 'facility'],
        });

        if (varianceWithRelations) {
            const severity = this.getVarianceSeverity(
                varianceWithRelations.variance_quantity,
                Number(varianceWithRelations.variance_value || 0),
            );

            let alertId: number | undefined;
            try {
                const alert = await this.alertService.upsertOperationalAlert({
                    facilityId: varianceWithRelations.facility_id,
                    organizationId: varianceWithRelations.organization_id || data.organization_id,
                    type: AlertType.STOCK_VARIANCE,
                    referenceType: 'stock_variance',
                    referenceId: varianceWithRelations.id,
                    medicineId: varianceWithRelations.medicine_id,
                    batchId: varianceWithRelations.batch_id,
                    title: `Stock Variance #${varianceWithRelations.id}`,
                    message: `${varianceWithRelations.variance_quantity > 0 ? 'Surplus' : 'Shortage'} of ${Math.abs(varianceWithRelations.variance_quantity)} units detected for ${varianceWithRelations.medicine?.name || `Medicine #${varianceWithRelations.medicine_id}`}.`,
                    severity,
                    currentValue: Math.abs(varianceWithRelations.variance_quantity),
                    thresholdValue: 0,
                    contextData: {
                        status: varianceWithRelations.status,
                        variance_type: varianceWithRelations.variance_type,
                        variance_quantity: varianceWithRelations.variance_quantity,
                        variance_value: varianceWithRelations.variance_value,
                        counted_at: varianceWithRelations.counted_at,
                    },
                });
                alertId = alert.id;
            } catch (err) {
                console.error('Failed to create variance alert:', err);
            }

            this.inventoryNotificationService.notifyVariance(varianceWithRelations, alertId).then(async () => {
                if (alertId) {
                    await this.alertService.markAlertNotified(alertId, {
                        source: 'variance_notification',
                        varianceId: varianceWithRelations.id,
                    });
                }
            }).catch((err) => {
                console.error('Failed to send variance notification:', err);
            });
        }

        // Log audit trail
        await this.auditService.log({
            facility_id: data.facility_id,
            user_id: data.counted_by_id,
            organization_id: data.organization_id,
            action: AuditAction.CREATE,
            entity_type: AuditEntityType.STOCK,
            entity_id: saved.id,
            entity_name: `Variance #${saved.id}`,
            description: `Recorded stock variance: ${varianceQuantity > 0 ? '+' : ''}${varianceQuantity} units`,
            new_values: {
                system_quantity: systemQuantity,
                physical_quantity: data.physical_quantity,
                variance: varianceQuantity,
            },
        });

        return saved;
    }

    async approveVariance(
        varianceId: number,
        organizationId: number,
        approvedById: number,
        adjustStock: boolean = true,
    ): Promise<StockVariance> {
        const variance = await this.varianceRepository.findOne({
            where: { id: varianceId, organization_id: organizationId },
            relations: ['medicine', 'batch'],
        });

        if (!variance) {
            throw new Error('Variance not found');
        }

        if (variance.status !== VarianceStatus.PENDING) {
            throw new Error('Variance already processed');
        }

        variance.status = VarianceStatus.APPROVED;
        variance.approved_by_id = approvedById;
        variance.approved_at = new Date();

        const updated = await this.varianceRepository.save(variance);

        // Adjust stock if requested
        if (adjustStock && variance.variance_quantity !== 0) {
            const stock = await this.stockRepository.findOne({
                where: {
                    facility_id: variance.facility_id,
                    organization_id: variance.organization_id,
                    medicine_id: variance.medicine_id,
                    batch_id: variance.batch_id,
                },
            });

            if (stock) {
                await this.stockService.adjustStock(stock.id, variance.organization_id!, stock.quantity + variance.variance_quantity, {
                    type: StockMovementType.ADJUSTMENT,
                    reason: AdjustmentReason.PHYSICAL_COUNT,
                    user_id: approvedById,
                    notes: `Variance adjustment - ${variance.variance_type}`,
                });
            }
        }

        // Log audit trail
        await this.auditService.log({
            facility_id: variance.facility_id,
            user_id: approvedById,
            organization_id: variance.organization_id,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.STOCK,
            entity_id: variance.id,
            entity_name: `Variance #${variance.id}`,
            description: `Approved variance${adjustStock ? ' and adjusted stock' : ''}`,
            old_values: { status: VarianceStatus.PENDING },
            new_values: { status: VarianceStatus.APPROVED, adjusted_stock: adjustStock },
        });

        try {
            await this.alertService.resolveAlertByReference({
                facilityId: variance.facility_id,
                organizationId,
                type: AlertType.STOCK_VARIANCE,
                referenceType: 'stock_variance',
                referenceId: variance.id,
                resolvedById: approvedById,
                actionTaken: adjustStock ? 'Adjusted Count' : 'Approved Variance',
                actionReason: adjustStock
                    ? 'Variance approved and stock updated to match the approved physical count.'
                    : 'Variance approved without an automatic stock adjustment.',
                note: 'Variance workflow completed with approval',
            });
        } catch (error) {
            console.error('Failed to resolve variance alert after approval:', error);
        }

        return updated;
    }

    async rejectVariance(varianceId: number, organizationId: number, rejectedById: number, reason?: string): Promise<StockVariance> {
        const variance = await this.varianceRepository.findOne({
            where: { id: varianceId, organization_id: organizationId },
        });

        if (!variance) {
            throw new Error('Variance not found');
        }

        if (variance.status !== VarianceStatus.PENDING) {
            throw new Error('Variance already processed');
        }

        variance.status = VarianceStatus.REJECTED;
        variance.approved_by_id = rejectedById;
        variance.approved_at = new Date();
        if (reason) {
            variance.notes = variance.notes
                ? `${variance.notes}\nRejection reason: ${reason}`
                : `Rejection reason: ${reason}`;
        }

        const updated = await this.varianceRepository.save(variance);

        // Log audit trail
        await this.auditService.log({
            facility_id: variance.facility_id,
            user_id: rejectedById,
            organization_id: variance.organization_id,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.STOCK,
            entity_id: variance.id,
            entity_name: `Variance #${variance.id}`,
            description: `Rejected variance${reason ? `: ${reason}` : ''}`,
            old_values: { status: VarianceStatus.PENDING },
            new_values: { status: VarianceStatus.REJECTED },
        });

        try {
            await this.alertService.resolveAlertByReference({
                facilityId: variance.facility_id,
                organizationId,
                type: AlertType.STOCK_VARIANCE,
                referenceType: 'stock_variance',
                referenceId: variance.id,
                resolvedById: rejectedById,
                actionTaken: 'Rejected Variance',
                actionReason:
                    reason?.trim() || 'Variance was rejected after review and does not require inventory adjustment.',
                note: 'Variance workflow completed with rejection',
            });
        } catch (error) {
            console.error('Failed to resolve variance alert after rejection:', error);
        }

        return updated;
    }

    async getVarianceReport(filters: VarianceReportFilters): Promise<{
        data: StockVariance[];
        total: number;
        page: number;
        limit: number;
        summary: {
            total_variances: number;
            total_variance_value: number;
            positive_variances: number;
            negative_variances: number;
        };
    }> {
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;

        const queryBuilder = this.varianceRepository
            .createQueryBuilder('variance')
            .leftJoinAndSelect('variance.medicine', 'medicine')
            .leftJoinAndSelect('variance.batch', 'batch')
            .leftJoinAndSelect('variance.counted_by', 'counted_by')
            .leftJoinAndSelect('variance.approved_by', 'approved_by');

        if (filters.organization_id) {
            queryBuilder.where('variance.organization_id = :organizationId', { organizationId: filters.organization_id });
            if (filters.facility_id) {
                queryBuilder.andWhere('variance.facility_id = :facilityId', { facilityId: filters.facility_id });
            }
        } else if (filters.facility_id) {
            queryBuilder.where('variance.facility_id = :facilityId', { facilityId: filters.facility_id });
        }

        if (filters.status) {
            queryBuilder.andWhere('variance.status = :status', { status: filters.status });
        }

        if (filters.variance_type) {
            queryBuilder.andWhere('variance.variance_type = :varianceType', { varianceType: filters.variance_type });
        }

        if (filters.medicine_id) {
            queryBuilder.andWhere('variance.medicine_id = :medicineId', { medicineId: filters.medicine_id });
        }

        if (filters.start_date) {
            queryBuilder.andWhere('variance.counted_at >= :startDate', { startDate: filters.start_date });
        }

        if (filters.end_date) {
            queryBuilder.andWhere('variance.counted_at <= :endDate', { endDate: filters.end_date });
        }

        const [data, total] = await queryBuilder
            .orderBy('variance.counted_at', 'DESC')
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        // Calculate summary
        const allVariances = await queryBuilder.getMany();
        const summary = {
            total_variances: allVariances.length,
            total_variance_value: allVariances.reduce((sum, v) => sum + Number(v.variance_value || 0), 0),
            positive_variances: allVariances.filter((v) => v.variance_quantity > 0).length,
            negative_variances: allVariances.filter((v) => v.variance_quantity < 0).length,
        };

        return { data, total, page, limit, summary };
    }

    async getVarianceById(id: number, organizationId?: number, facilityId?: number): Promise<StockVariance> {
        const where: any = { id };
        if (organizationId) {
            where.organization_id = organizationId;
        }
        if (facilityId) {
            where.facility_id = facilityId;
        }
        const variance = await this.varianceRepository.findOne({
            where,
            relations: ['medicine', 'batch', 'counted_by', 'approved_by'],
        });

        if (!variance) {
            throw new Error('Variance not found');
        }

        return variance;
    }

    /**
     * Automatically approves variances within a small threshold (e.g. slight counting errors)
     * This helps reduce manager workload for trivial discrepancies.
     */
    async autoApproveSmallVariances(facilityId: number, organizationId: number, thresholdValue: number, systemUserId: number): Promise<number> {
        const pendingVariances = await this.varianceRepository.find({
            where: {
                facility_id: facilityId,
                organization_id: organizationId,
                status: VarianceStatus.PENDING,
            },
        });

        let approvedCount = 0;
        for (const variance of pendingVariances) {
            // Check if absolute variance value is within rounding threshold
            if (Math.abs(Number(variance.variance_value || 0)) <= thresholdValue) {
                try {
                    await this.approveVariance(variance.id, organizationId, systemUserId, true);
                    approvedCount++;
                } catch (error) {
                    console.error(`Auto-approval failed for variance ${variance.id}:`, error);
                }
            }
        }

        return approvedCount;
    }
}
