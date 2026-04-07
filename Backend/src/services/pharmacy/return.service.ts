import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import {
    CustomerReturn,
    CustomerReturnItem,
    ReturnStatus,
    RefundMethod,
    ReturnReason,
    ItemCondition,
} from '../../entities/CustomerReturn.entity';
import { Sale, SaleItem } from '../../entities/Sale.entity';
import { CreditNote } from '../../entities/CreditNote.entity';
import { StockService } from './stock.service';
import { CreateReturnDto, ReturnFiltersDto } from '../../dto/pharmacy.dto';
import { generateDocumentNumber } from '../../utils/document-number.util';

export class ReturnService {
    private returnRepository: Repository<CustomerReturn>;
    private returnItemRepository: Repository<CustomerReturnItem>;
    private saleRepository: Repository<Sale>;
    private saleItemRepository: Repository<SaleItem>;
    private creditNoteRepository: Repository<CreditNote>;
    private stockService: StockService;

    constructor() {
        this.returnRepository = AppDataSource.getRepository(CustomerReturn);
        this.returnItemRepository = AppDataSource.getRepository(CustomerReturnItem);
        this.saleRepository = AppDataSource.getRepository(Sale);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.creditNoteRepository = AppDataSource.getRepository(CreditNote);
        this.stockService = new StockService();
    }

    async generateReturnNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('RET');
    }

    async createReturn(createDto: CreateReturnDto, userId: number, facilityId: number): Promise<CustomerReturn> {
        // Validate sale exists
        const sale = await this.saleRepository.findOne({
            where: { id: createDto.sale_id, organization_id: createDto.organization_id },
            relations: ['items'],
        });

        if (!sale) {
            throw new AppError('Sale not found', 404);
        }

        if (sale.status === 'voided') {
            throw new AppError('Cannot create return for voided sale', 400);
        }

        // Validate all return items
        for (const item of createDto.items) {
            const saleItem = await this.saleItemRepository.findOne({
                where: { id: item.sale_item_id, sale_id: createDto.sale_id, organization_id: createDto.organization_id },
            });

            if (!saleItem) {
                throw new AppError(`Sale item ${item.sale_item_id} not found in this sale`, 404);
            }

            // Check if quantity is valid
            if (item.quantity_returned > saleItem.quantity) {
                throw new AppError(
                    `Return quantity (${item.quantity_returned}) exceeds sold quantity (${saleItem.quantity})`,
                    400,
                );
            }

            // Validate refund amount doesn't exceed item total
            const itemTotal = saleItem.unit_price * item.quantity_returned;
            if (item.refund_amount > itemTotal) {
                throw new AppError(`Refund amount exceeds item total price`, 400);
            }
        }

        const totalRefundAmount = createDto.items.reduce((sum, item) => sum + item.refund_amount, 0);
        const returnNumber = await this.generateReturnNumber(facilityId);

        // Create return record
        const customerReturn = this.returnRepository.create({
            return_number: returnNumber,
            sale_id: createDto.sale_id,
            facility_id: facilityId,
            organization_id: createDto.organization_id,
            processed_by_id: userId,
            total_refund_amount: totalRefundAmount,
            refund_method: createDto.refund_method as RefundMethod,
            status: ReturnStatus.PENDING,
            notes: createDto.notes,
        });

        const savedReturn = await this.returnRepository.save(customerReturn);

        // Create return items
        for (const item of createDto.items) {
            const returnItem = this.returnItemRepository.create({
                return_id: savedReturn.id,
                sale_item_id: item.sale_item_id,
                medicine_id: item.medicine_id,
                organization_id: createDto.organization_id,
                batch_id: item.batch_id,
                quantity_returned: item.quantity_returned,
                reason: item.reason as ReturnReason,
                condition: item.condition as ItemCondition,
                refund_amount: item.refund_amount,
                restore_to_stock: item.restore_to_stock ?? item.condition === 'resellable',
                notes: item.notes,
            });

            await this.returnItemRepository.save(returnItem);
        }

        return (await this.returnRepository.findOne({
            where: { id: savedReturn.id },
            relations: ['items', 'sale', 'processedBy', 'facility'],
        })) as CustomerReturn;
    }

    async approveReturn(returnId: number, userId: number): Promise<CustomerReturn> {
        const customerReturn = await this.returnRepository.findOne({
            where: { id: returnId },
            relations: ['items', 'sale'],
        });

        if (!customerReturn) {
            throw new AppError('Return not found', 404);
        }

        if (customerReturn.status !== ReturnStatus.PENDING) {
            throw new AppError(`Return is already ${customerReturn.status}`, 400);
        }

        // Restore stock for resellable items
        for (const item of customerReturn.items) {
            if (item.restore_to_stock) {
                await this.stockService.restoreStockFromReturn(
                    customerReturn.facility_id,
                    customerReturn.organization_id,
                    item.medicine_id,
                    item.batch_id,
                    item.quantity_returned,
                    customerReturn.id,
                    userId,
                );
            }
        }

        // Update return status
        customerReturn.status = ReturnStatus.APPROVED;
        customerReturn.approved_by_id = userId;
        customerReturn.approved_at = new Date();

        return await this.returnRepository.save(customerReturn);
    }

    async rejectReturn(returnId: number, userId: number, reason: string): Promise<CustomerReturn> {
        const customerReturn = await this.returnRepository.findOne({
            where: { id: returnId },
        });

        if (!customerReturn) {
            throw new AppError('Return not found', 404);
        }

        if (customerReturn.status !== ReturnStatus.PENDING) {
            throw new AppError(`Return is already ${customerReturn.status}`, 400);
        }

        customerReturn.status = ReturnStatus.REJECTED;
        customerReturn.approved_by_id = userId;
        customerReturn.approved_at = new Date();
        customerReturn.notes = `${customerReturn.notes || ''}\nRejection reason: ${reason}`;

        return await this.returnRepository.save(customerReturn);
    }

    async processRefund(returnId: number): Promise<CustomerReturn> {
        const customerReturn = await this.returnRepository.findOne({
            where: { id: returnId },
            relations: ['sale'],
        });

        if (!customerReturn) {
            throw new AppError('Return not found', 404);
        }

        if (customerReturn.status !== ReturnStatus.APPROVED) {
            throw new AppError('Return must be approved before processing refund', 400);
        }

        // Create credit note if refund method is credit_note
        if (customerReturn.refund_method === RefundMethod.CREDIT_NOTE) {
            const creditNoteNumber = await this.generateCreditNoteNumber(customerReturn.facility_id);
            const creditNote = this.creditNoteRepository.create({
                note_number: creditNoteNumber,
                sale_id: customerReturn.sale_id,
                amount: customerReturn.total_refund_amount,
                reason: `Customer return ${customerReturn.return_number}`,
                fiscal_status: 'pending',
            });

            const savedCreditNote = await this.creditNoteRepository.save(creditNote);
            customerReturn.credit_note_id = savedCreditNote.id;
        }

        // Mark return as completed
        customerReturn.status = ReturnStatus.COMPLETED;
        return await this.returnRepository.save(customerReturn);
    }

    async generateCreditNoteNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('CN');
    }

    async listReturns(filters: ReturnFiltersDto): Promise<{
        data: CustomerReturn[];
        total: number;
        page: number;
        limit: number;
    }> {
        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const skip = (page - 1) * limit;

        const queryBuilder = this.returnRepository
            .createQueryBuilder('return')
            .leftJoinAndSelect('return.sale', 'sale')
            .leftJoinAndSelect('return.items', 'items')
            .leftJoinAndSelect('return.processedBy', 'processedBy')
            .leftJoinAndSelect('return.approvedBy', 'approvedBy');

        if (filters.organization_id) {
            queryBuilder.where('return.organization_id = :organizationId', { organizationId: filters.organization_id });
            if (filters.facility_id) {
                queryBuilder.andWhere('return.facility_id = :facilityId', { facilityId: filters.facility_id });
            }
        } else if (filters.facility_id) {
            queryBuilder.where('return.facility_id = :facilityId', { facilityId: filters.facility_id });
        }

        if (filters.status) {
            queryBuilder.andWhere('return.status = :status', { status: filters.status });
        }

        if (filters.start_date) {
            queryBuilder.andWhere('return.created_at >= :startDate', { startDate: filters.start_date });
        }

        if (filters.end_date) {
            queryBuilder.andWhere('return.created_at <= :endDate', { endDate: filters.end_date });
        }

        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('return.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async getReturn(returnId: number): Promise<CustomerReturn> {
        const customerReturn = await this.returnRepository.findOne({
            where: { id: returnId },
            relations: ['items', 'sale', 'sale.items', 'processedBy', 'approvedBy', 'facility'],
        });

        if (!customerReturn) {
            throw new AppError('Return not found', 404);
        }

        return customerReturn;
    }
}
