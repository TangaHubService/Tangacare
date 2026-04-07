import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { BatchRecall, RecallStatus, RecallReason } from '../../entities/BatchRecall.entity';
import { SaleStatus } from '../../entities/Sale.entity';
import { SaleItem } from '../../entities/Sale.entity';
import { Stock } from '../../entities/Stock.entity';
import { InventoryNotificationService } from './inventory-notification.service';

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

    constructor() {
        this.recallRepository = AppDataSource.getRepository(BatchRecall);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.inventoryNotificationService = new InventoryNotificationService();
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
            this.inventoryNotificationService.notifyRecall(recallWithRelations, affectedSalesCount).catch((err) => {
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

        return await this.recallRepository.save(recall);
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
