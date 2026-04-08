import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { BatchRecall, RecallStatus, RecallReason } from '../../entities/BatchRecall.entity';
import { SaleStatus } from '../../entities/Sale.entity';
import { SaleItem } from '../../entities/Sale.entity';
import { Stock } from '../../entities/Stock.entity';
import { InventoryNotificationService } from './inventory-notification.service';
import { AlertType } from '../../entities/Alert.entity';
import { AlertService } from './alert.service';

export interface InitiateRecallDto {
    facility_id: number;
    organization_id: number;
    batch_id: number;
    medicine_id: number;
    reason: RecallReason;
    description: string;
    initiated_by_id: number;
}

export interface RecallSummary {
    recall: BatchRecall;
    affected_sales: Array<{
        sale_id: number;
        sale_number: string;
        date: string;
        patient_name: string | null;
        quantity: number;
        amount: number;
    }>;
    current_stock: number;
}

export class RecallService {
    private recallRepository: Repository<BatchRecall>;
    private saleItemRepository: Repository<SaleItem>;
    private stockRepository: Repository<Stock>;
    private inventoryNotificationService: InventoryNotificationService;
    private alertService: AlertService;

    constructor() {
        this.recallRepository = AppDataSource.getRepository(BatchRecall);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.inventoryNotificationService = new InventoryNotificationService();
        this.alertService = new AlertService();
    }

    async initiateRecall(data: InitiateRecallDto): Promise<RecallSummary> {
        // Generate recall number
        const recallNumber = `RCL-${Date.now()}-${data.batch_id}`;

        // Find all sales containing this batch
        const affectedSales = await this.saleItemRepository
            .createQueryBuilder('item')
            .leftJoinAndSelect('item.sale', 'sale')
            .leftJoinAndSelect('sale.patient', 'patient')
            .where('item.batch_id = :batchId', { batchId: data.batch_id })
            .andWhere('sale.facility_id = :facilityId', { facilityId: data.facility_id })
            .andWhere('sale.organization_id = :organizationId', { organizationId: data.organization_id })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .getMany();

        const affectedSalesCount = new Set(affectedSales.map((item) => item.sale_id)).size;
        const affectedQuantity = affectedSales.reduce((sum, item) => sum + item.quantity, 0);

        // Get remaining stock and freeze batch to enforce quarantine
        const stockRows = await this.stockRepository.find({
            where: {
                facility_id: data.facility_id,
                organization_id: data.organization_id,
                batch_id: data.batch_id,
                is_deleted: false,
            },
        });

        const remainingStock = stockRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        if (stockRows.length > 0) {
            await this.stockRepository
                .createQueryBuilder()
                .update(Stock)
                .set({ is_frozen: true })
                .where('facility_id = :facilityId', { facilityId: data.facility_id })
                .andWhere('organization_id = :organizationId', { organizationId: data.organization_id })
                .andWhere('batch_id = :batchId', { batchId: data.batch_id })
                .andWhere('is_deleted = :isDeleted', { isDeleted: false })
                .execute();
        }

        // Create recall record
        const recall = this.recallRepository.create({
            facility_id: data.facility_id,
            organization_id: data.organization_id,
            batch_id: data.batch_id,
            medicine_id: data.medicine_id,
            recall_number: recallNumber,
            reason: data.reason,
            description: data.description,
            status: RecallStatus.INITIATED,
            affected_sales_count: affectedSalesCount,
            affected_quantity: affectedQuantity,
            recovered_quantity: 0,
            remaining_stock: remainingStock,
            initiated_by_id: data.initiated_by_id,
            initiated_at: new Date(),
        });

        const saved = await this.recallRepository.save(recall);

        // Reload with relations for notifications
        const recallWithRelations = await this.recallRepository.findOne({
            where: { id: saved.id, organization_id: data.organization_id },
            relations: ['medicine', 'batch', 'facility'],
        });

        if (recallWithRelations) {
            let alertId: number | undefined;
            try {
                const alert = await this.alertService.upsertOperationalAlert({
                    facilityId: recallWithRelations.facility_id,
                    organizationId: recallWithRelations.organization_id || data.organization_id,
                    type: AlertType.BATCH_RECALL,
                    referenceType: 'batch_recall',
                    referenceId: recallWithRelations.id,
                    medicineId: recallWithRelations.medicine_id,
                    batchId: recallWithRelations.batch_id,
                    title: `Batch Recall: ${recallWithRelations.recall_number}`,
                    message: `Recall initiated for ${recallWithRelations.medicine?.name || `Medicine #${recallWithRelations.medicine_id}`}, batch ${recallWithRelations.batch?.batch_number || recallWithRelations.batch_id}. ${affectedSalesCount} sales impacted.`,
                    severity: 'critical',
                    currentValue: recallWithRelations.remaining_stock,
                    thresholdValue: affectedSalesCount,
                    contextData: {
                        status: recallWithRelations.status,
                        reason: recallWithRelations.reason,
                        recall_number: recallWithRelations.recall_number,
                        affected_sales_count: recallWithRelations.affected_sales_count,
                        affected_quantity: recallWithRelations.affected_quantity,
                        recovered_quantity: recallWithRelations.recovered_quantity,
                        remaining_stock: recallWithRelations.remaining_stock,
                    },
                });
                alertId = alert.id;
            } catch (err) {
                console.error('Failed to create recall alert:', err);
            }

            this.inventoryNotificationService.notifyRecall(recallWithRelations, affectedSalesCount, alertId).then(async () => {
                if (alertId) {
                    await this.alertService.markAlertNotified(alertId, {
                        source: 'recall_notification',
                        recallId: recallWithRelations.id,
                    });
                }
            }).catch((err) => {
                console.error('Failed to send recall notification:', err);
            });
        }

        // Prepare affected sales summary
        const salesSummary = affectedSales.map((item) => ({
            sale_id: item.sale.id,
            sale_number: item.sale.sale_number,
            date: item.sale.created_at.toISOString(),
            patient_name: item.sale.patient ? `${item.sale.patient.first_name} ${item.sale.patient.last_name}` : null,
            quantity: item.quantity,
            amount: Number(item.total_price),
        }));

        return {
            recall: saved,
            affected_sales: salesSummary,
            current_stock: remainingStock,
        };
    }

    async updateRecallStatus(
        recallId: number,
        organizationId: number,
        status: RecallStatus,
        userId: number,
        actionTaken?: string,
        recoveredQuantity?: number,
    ): Promise<BatchRecall> {
        const recall = await this.recallRepository.findOne({
            where: { id: recallId, organization_id: organizationId },
            relations: ['medicine', 'batch'],
        });

        if (!recall) {
            throw new Error('Recall not found');
        }

        recall.status = status;
        if (actionTaken) recall.action_taken = actionTaken;
        if (recoveredQuantity !== undefined) recall.recovered_quantity = recoveredQuantity;

        if (status === RecallStatus.COMPLETED) {
            recall.completed_by_id = userId;
            recall.completed_at = new Date();
        }

        // Keep recalled stock frozen until recall is cancelled/completed.
        if (status === RecallStatus.COMPLETED || status === RecallStatus.CANCELLED) {
            await this.stockRepository
                .createQueryBuilder()
                .update(Stock)
                .set({ is_frozen: false })
                .where('facility_id = :facilityId', { facilityId: recall.facility_id })
                .andWhere('organization_id = :organizationId', { organizationId })
                .andWhere('batch_id = :batchId', { batchId: recall.batch_id })
                .andWhere('is_deleted = :isDeleted', { isDeleted: false })
                .execute();
        } else if (status === RecallStatus.INITIATED || status === RecallStatus.IN_PROGRESS) {
            await this.stockRepository
                .createQueryBuilder()
                .update(Stock)
                .set({ is_frozen: true })
                .where('facility_id = :facilityId', { facilityId: recall.facility_id })
                .andWhere('organization_id = :organizationId', { organizationId })
                .andWhere('batch_id = :batchId', { batchId: recall.batch_id })
                .andWhere('is_deleted = :isDeleted', { isDeleted: false })
                .execute();
        }

        const saved = await this.recallRepository.save(recall);

        try {
            if (status === RecallStatus.COMPLETED || status === RecallStatus.CANCELLED) {
                await this.alertService.resolveAlertByReference({
                    facilityId: saved.facility_id,
                    organizationId,
                    type: AlertType.BATCH_RECALL,
                    referenceType: 'batch_recall',
                    referenceId: saved.id,
                    resolvedById: userId,
                    actionTaken:
                        actionTaken ||
                        (status === RecallStatus.COMPLETED ? 'Recovered' : 'False Alarm'),
                    actionReason:
                        actionTaken ||
                        (status === RecallStatus.COMPLETED
                            ? 'Recall process completed and the affected batch workflow has been closed.'
                            : 'Recall was cancelled after review and no further containment action is required.'),
                    note: `Recall ${saved.recall_number} marked as ${status}`,
                });
            } else {
                await this.alertService.upsertOperationalAlert({
                    facilityId: saved.facility_id,
                    organizationId,
                    type: AlertType.BATCH_RECALL,
                    referenceType: 'batch_recall',
                    referenceId: saved.id,
                    medicineId: saved.medicine_id,
                    batchId: saved.batch_id,
                    title: `Batch Recall: ${saved.recall_number}`,
                    message: `Recall ${saved.recall_number} for ${saved.medicine?.name || `Medicine #${saved.medicine_id}`} remains active with status ${saved.status}.`,
                    severity: 'critical',
                    currentValue: saved.remaining_stock,
                    thresholdValue: saved.affected_sales_count,
                    contextData: {
                        status: saved.status,
                        reason: saved.reason,
                        recall_number: saved.recall_number,
                        action_taken: saved.action_taken,
                        recovered_quantity: saved.recovered_quantity,
                        remaining_stock: saved.remaining_stock,
                    },
                });
            }
        } catch (error) {
            console.error('Failed to update recall alert:', error);
        }

        return saved;
    }

    async getRecallById(recallId: number, organizationId: number, facilityId: number): Promise<RecallSummary> {
        const recall = await this.recallRepository.findOne({
            where: { id: recallId, facility_id: facilityId, organization_id: organizationId },
            relations: ['batch', 'medicine', 'initiated_by', 'completed_by'],
        });

        if (!recall) {
            throw new Error('Recall not found');
        }

        // Get affected sales
        const affectedSales = await this.saleItemRepository
            .createQueryBuilder('item')
            .leftJoinAndSelect('item.sale', 'sale')
            .leftJoinAndSelect('sale.patient', 'patient')
            .where('item.batch_id = :batchId', { batchId: recall.batch_id })
            .andWhere('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .getMany();

        const salesSummary = affectedSales.map((item) => ({
            sale_id: item.sale.id,
            sale_number: item.sale.sale_number,
            date: item.sale.created_at.toISOString(),
            patient_name: item.sale.patient ? `${item.sale.patient.first_name} ${item.sale.patient.last_name}` : null,
            quantity: item.quantity,
            amount: Number(item.total_price),
        }));

        // Get current stock
        const stockRows = await this.stockRepository.find({
            where: {
                facility_id: facilityId,
                organization_id: organizationId,
                batch_id: recall.batch_id,
                is_deleted: false,
            },
        });
        const currentStock = stockRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        return {
            recall,
            affected_sales: salesSummary,
            current_stock: currentStock,
        };
    }

    async getRecallList(
        facilityId: number,
        organizationId: number,
        status?: RecallStatus,
        page: number = 1,
        limit: number = 50,
    ): Promise<{
        data: BatchRecall[];
        total: number;
        page: number;
        limit: number;
    }> {
        const skip = (page - 1) * limit;

        const queryBuilder = this.recallRepository
            .createQueryBuilder('recall')
            .leftJoinAndSelect('recall.batch', 'batch')
            .leftJoinAndSelect('recall.medicine', 'medicine')
            .leftJoinAndSelect('recall.initiated_by', 'initiated_by')
            .leftJoinAndSelect('recall.completed_by', 'completed_by')
            .where('recall.facility_id = :facilityId', { facilityId })
            .andWhere('recall.organization_id = :organizationId', { organizationId });

        if (status) {
            queryBuilder.andWhere('recall.status = :status', { status });
        }

        const [data, total] = await queryBuilder
            .orderBy('recall.initiated_at', 'DESC')
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return { data, total, page, limit };
    }
}
