import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
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
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { CreateReturnDto, ReturnFiltersDto } from '../../dto/pharmacy.dto';
import { generateDocumentNumber } from '../../utils/document-number.util';
import { EBMClient, EBMSubmitPayload } from './ebm.client';
import { FiscalInvoiceType } from '../../entities/Sale.entity';
import { logger } from '../../middleware/logger.middleware';

const ACTIVE_RETURN_STATUSES = [ReturnStatus.PENDING, ReturnStatus.APPROVED, ReturnStatus.COMPLETED];

export class ReturnService {
    private returnRepository: Repository<CustomerReturn>;
    private ebmClient: EBMClient;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.returnRepository = source.getRepository(CustomerReturn);
        this.ebmClient = new EBMClient();
    }

    async generateReturnNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('RET');
    }

    async createReturn(
        createDto: CreateReturnDto,
        userId: number,
        facilityId: number,
        organizationId: number,
    ): Promise<CustomerReturn> {
        if (!Array.isArray(createDto.items) || createDto.items.length === 0) {
            throw new AppError('At least one return item is required', 400);
        }

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const saleRepository = queryRunner.manager.getRepository(Sale);
            const saleItemRepository = queryRunner.manager.getRepository(SaleItem);
            const returnRepository = queryRunner.manager.getRepository(CustomerReturn);
            const returnItemRepository = queryRunner.manager.getRepository(CustomerReturnItem);

            const sale = await saleRepository.findOne({
                where: {
                    id: createDto.sale_id,
                    facility_id: facilityId,
                    organization_id: organizationId,
                },
                relations: ['items'],
            });

            if (!sale) {
                throw new AppError('Sale not found', 404);
            }

            if (sale.status === 'voided') {
                throw new AppError('Cannot create return for voided sale', 400);
            }

            for (const item of createDto.items) {
                const saleItem = await saleItemRepository.findOne({
                    where: {
                        id: item.sale_item_id,
                        sale_id: createDto.sale_id,
                        organization_id: organizationId,
                    },
                    relations: ['medicine', 'batch'],
                });

                if (!saleItem) {
                    throw new AppError(`Sale item ${item.sale_item_id} not found in this sale`, 404);
                }

                if (saleItem.medicine_id !== item.medicine_id) {
                    throw new AppError(`Sale item ${item.sale_item_id} does not match the selected medicine`, 400);
                }

                if (saleItem.batch_id !== item.batch_id) {
                    throw new AppError(`Sale item ${item.sale_item_id} does not match the selected batch`, 400);
                }

                const previouslyReturned = await this.getPreviouslyReturnedQuantity(
                    createDto.sale_id,
                    item.sale_item_id,
                    organizationId,
                    facilityId,
                    queryRunner.manager,
                );

                const remainingQuantity = saleItem.quantity - previouslyReturned;
                if (remainingQuantity <= 0) {
                    throw new AppError(
                        `Sale item ${item.sale_item_id} has already been fully returned`,
                        400,
                    );
                }

                if (item.quantity_returned > remainingQuantity) {
                    throw new AppError(
                        `Return quantity (${item.quantity_returned}) exceeds remaining returnable quantity (${remainingQuantity})`,
                        400,
                    );
                }

                if (item.condition !== ItemCondition.RESELLABLE && item.restore_to_stock === true) {
                    throw new AppError('Only resellable items can be restored to stock', 400);
                }

                const itemTotal = Number(saleItem.unit_price) * item.quantity_returned;
                if (Number(item.refund_amount) > itemTotal) {
                    throw new AppError('Refund amount exceeds item total price', 400);
                }
            }

            const totalRefundAmount = createDto.items.reduce((sum, item) => sum + Number(item.refund_amount), 0);
            const returnNumber = await this.generateReturnNumber(facilityId);

            const customerReturn = returnRepository.create({
                return_number: returnNumber,
                sale_id: createDto.sale_id,
                facility_id: facilityId,
                organization_id: organizationId,
                processed_by_id: userId,
                total_refund_amount: totalRefundAmount,
                refund_method: createDto.refund_method as RefundMethod,
                status: ReturnStatus.PENDING,
                notes: createDto.notes,
            });

            const savedReturn = await returnRepository.save(customerReturn);

            for (const item of createDto.items) {
                const returnItem = returnItemRepository.create({
                    return_id: savedReturn.id,
                    sale_item_id: item.sale_item_id,
                    medicine_id: item.medicine_id,
                    organization_id: organizationId,
                    batch_id: item.batch_id,
                    quantity_returned: item.quantity_returned,
                    reason: item.reason as ReturnReason,
                    condition: item.condition as ItemCondition,
                    refund_amount: Number(item.refund_amount),
                    restore_to_stock: item.restore_to_stock ?? item.condition === ItemCondition.RESELLABLE,
                    notes: item.notes,
                });

                await returnItemRepository.save(returnItem);
            }

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.CREATE,
                entity_type: AuditEntityType.CUSTOMER_RETURN,
                entity_id: savedReturn.id,
                entity_name: savedReturn.return_number,
                description: `Customer return ${savedReturn.return_number} created and submitted for review`,
                new_values: {
                    sale_id: savedReturn.sale_id,
                    total_refund_amount: totalRefundAmount,
                    refund_method: savedReturn.refund_method,
                    item_count: createDto.items.length,
                },
            });

            await queryRunner.commitTransaction();

            return await this.getReturn(savedReturn.id, organizationId, facilityId);
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async approveReturn(
        returnId: number,
        userId: number,
        organizationId: number,
        facilityId: number,
    ): Promise<CustomerReturn> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const customerReturn = await this.findReturnOrFail(returnId, organizationId, facilityId, queryRunner.manager);

            if (customerReturn.status !== ReturnStatus.PENDING) {
                throw new AppError(`Return is already ${customerReturn.status}`, 400);
            }

            const transactionalStockService = new StockService(queryRunner.manager);

            for (const item of customerReturn.items) {
                if (!item.restore_to_stock) {
                    continue;
                }

                if (item.condition !== ItemCondition.RESELLABLE) {
                    throw new AppError('Only resellable items can be restored to stock', 400);
                }

                await transactionalStockService.restoreStockFromReturn(
                    customerReturn.facility_id,
                    customerReturn.organization_id,
                    item.medicine_id,
                    item.batch_id,
                    item.quantity_returned,
                    customerReturn.id,
                    userId,
                );
            }

            customerReturn.status = ReturnStatus.APPROVED;
            customerReturn.approved_by_id = userId;
            customerReturn.approved_at = new Date();
            customerReturn.rejected_by_id = null;
            customerReturn.rejected_at = null;
            customerReturn.rejection_reason = null;

            const saved = await queryRunner.manager.save(customerReturn);

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.CUSTOMER_RETURN,
                entity_id: saved.id,
                entity_name: saved.return_number,
                description: `Customer return ${saved.return_number} approved`,
                new_values: {
                    status: saved.status,
                    approved_at: saved.approved_at,
                    approved_by_id: saved.approved_by_id,
                },
            });

            await queryRunner.commitTransaction();
            return await this.getReturn(saved.id, organizationId, facilityId);
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async rejectReturn(
        returnId: number,
        userId: number,
        organizationId: number,
        facilityId: number,
        reason: string,
    ): Promise<CustomerReturn> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const customerReturn = await this.findReturnOrFail(returnId, organizationId, facilityId, queryRunner.manager);

            if (customerReturn.status !== ReturnStatus.PENDING) {
                throw new AppError(`Return is already ${customerReturn.status}`, 400);
            }

            customerReturn.status = ReturnStatus.REJECTED;
            customerReturn.rejected_by_id = userId;
            customerReturn.rejected_at = new Date();
            customerReturn.rejection_reason = reason;

            const saved = await queryRunner.manager.save(customerReturn);

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.CUSTOMER_RETURN,
                entity_id: saved.id,
                entity_name: saved.return_number,
                description: `Customer return ${saved.return_number} rejected`,
                new_values: {
                    status: saved.status,
                    rejected_at: saved.rejected_at,
                    rejected_by_id: saved.rejected_by_id,
                    rejection_reason: reason,
                },
            });

            await queryRunner.commitTransaction();
            return await this.getReturn(saved.id, organizationId, facilityId);
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async processRefund(
        returnId: number,
        userId: number,
        organizationId: number,
        facilityId: number,
    ): Promise<CustomerReturn> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let createdCreditNoteId: number | null = null;

        try {
            const customerReturn = await this.findReturnOrFail(returnId, organizationId, facilityId, queryRunner.manager);

            if (customerReturn.status !== ReturnStatus.APPROVED) {
                throw new AppError('Return must be approved before processing refund', 400);
            }

            if (customerReturn.refund_method === RefundMethod.CREDIT_NOTE) {
                const creditNoteNumber = await this.generateCreditNoteNumber(customerReturn.facility_id);
                const creditNote = queryRunner.manager.create(CreditNote, {
                    note_number: creditNoteNumber,
                    sale_id: customerReturn.sale_id,
                    organization_id: organizationId,
                    amount: customerReturn.total_refund_amount,
                    reason: `Customer return ${customerReturn.return_number}`,
                    fiscal_status: 'pending',
                });

                const savedCreditNote = await queryRunner.manager.save(creditNote);
                customerReturn.credit_note_id = savedCreditNote.id;
                createdCreditNoteId = savedCreditNote.id;
            }

            customerReturn.status = ReturnStatus.COMPLETED;
            customerReturn.refund_processed_by_id = userId;
            customerReturn.refund_processed_at = new Date();

            const saved = await queryRunner.manager.save(customerReturn);

            const transactionalAuditService = new AuditService(queryRunner.manager);
            await transactionalAuditService.log({
                facility_id: facilityId,
                user_id: userId,
                organization_id: organizationId,
                action: AuditAction.UPDATE,
                entity_type: AuditEntityType.CUSTOMER_RETURN,
                entity_id: saved.id,
                entity_name: saved.return_number,
                description: `Customer return ${saved.return_number} refund processed`,
                new_values: {
                    status: saved.status,
                    refund_method: saved.refund_method,
                    refund_processed_at: saved.refund_processed_at,
                    refund_processed_by_id: saved.refund_processed_by_id,
                    credit_note_id: saved.credit_note_id,
                },
            });

            await queryRunner.commitTransaction();
            const finalized = await this.getReturn(saved.id, organizationId, facilityId);

            if (createdCreditNoteId) {
                await this.submitCreditNoteFiscalNonBlocking(createdCreditNoteId, organizationId, facilityId);
            }

            return finalized;
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async generateCreditNoteNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('CN');
    }

    private extractNumber(reference: string | null | undefined, fallback: number): number {
        const digits = String(reference || '').replace(/\D+/g, '');
        const parsed = Number(digits);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    private async submitCreditNoteFiscalNonBlocking(
        creditNoteId: number,
        organizationId: number,
        facilityId: number,
    ): Promise<void> {
        const creditNoteRepo = AppDataSource.getRepository(CreditNote);
        const creditNote = await creditNoteRepo.findOne({
            where: { id: creditNoteId, organization_id: organizationId },
            relations: ['sale', 'sale.items', 'sale.items.medicine', 'sale.facility', 'sale.payments'],
        });

        if (!creditNote) return;
        const facility = (creditNote.sale as any)?.facility;
        const tin = String(facility?.tin_number || facility?.tax_registration_number || '').trim();
        if (!tin) {
            logger.warn('[VSDC] credit note skipped due to missing facility TIN', { creditNoteId, facilityId });
            return;
        }

        const payload: EBMSubmitPayload = {
            sale_number: creditNote.note_number,
            sale_id: creditNote.sale_id,
            facility_id: facilityId,
            organization_id: organizationId,
            branch_id: '00',
            invoice_number: this.extractNumber(creditNote.note_number, creditNote.id),
            facility_tin: tin,
            device_serial: String(facility?.ebm_device_serial || '').trim(),
            sdc_id: String(facility?.ebm_sdcid || '').trim() || undefined,
            mrc_no: String(facility?.ebm_device_serial || '').trim() || undefined,
            total_amount: Number(creditNote.amount),
            vat_amount: 0,
            taxable_amount_b: Number(creditNote.amount),
            customer_tin: (creditNote.sale as any)?.customer_tin || undefined,
            invoice_type: FiscalInvoiceType.CREDIT,
            sale_datetime: creditNote.created_at,
            initiated_by: String((creditNote.sale as any)?.cashier_id || '0'),
            items: [
                {
                    description: `Credit note ${creditNote.note_number}`,
                    item_code: `CREDIT-${creditNote.id}`,
                    item_class_code: undefined,
                    tax_category: 'B',
                    quantity: 1,
                    unit_price: Number(creditNote.amount),
                    taxable_amount: Number(creditNote.amount),
                    vat_amount: 0,
                    total: Number(creditNote.amount),
                },
            ],
        };

        const result = await this.ebmClient.submitCreditNote(payload);
        if (result.success) {
            await creditNoteRepo.update(
                { id: creditNote.id, organization_id: organizationId },
                {
                    fiscal_status: 'sent',
                    ebm_reference: result.reference || null,
                    ebm_receipt_number: result.reference || null,
                    vsdc_internal_data: result.internalData || null,
                    vsdc_receipt_signature: result.receiptSignature || null,
                    vsdc_receipt_published_at: result.publishedAt || null,
                    vsdc_sdc_id: result.sdcId || null,
                },
            );
            return;
        }

        await this.ebmClient.enqueueRetry('credit_note', creditNote.id, creditNote.sale_id, payload);
        await creditNoteRepo.update({ id: creditNote.id, organization_id: organizationId }, { fiscal_status: 'pending' });
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
            .createQueryBuilder('customerReturn')
            .leftJoinAndSelect('customerReturn.sale', 'sale')
            .leftJoinAndSelect('customerReturn.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .leftJoinAndSelect('customerReturn.processedBy', 'processedBy')
            .leftJoinAndSelect('customerReturn.approvedBy', 'approvedBy')
            .leftJoinAndSelect('customerReturn.rejectedBy', 'rejectedBy')
            .leftJoinAndSelect('customerReturn.refundProcessedBy', 'refundProcessedBy');

        if (filters.organization_id) {
            queryBuilder.where('customerReturn.organization_id = :organizationId', {
                organizationId: filters.organization_id,
            });
            if (filters.facility_id) {
                queryBuilder.andWhere('customerReturn.facility_id = :facilityId', {
                    facilityId: filters.facility_id,
                });
            }
        } else if (filters.facility_id) {
            queryBuilder.where('customerReturn.facility_id = :facilityId', { facilityId: filters.facility_id });
        }

        if (filters.status) {
            queryBuilder.andWhere('customerReturn.status = :status', { status: filters.status });
        }

        if (filters.sale_number) {
            queryBuilder.andWhere('sale.sale_number ILIKE :saleNumber', {
                saleNumber: `%${filters.sale_number}%`,
            });
        }

        if (filters.start_date) {
            queryBuilder.andWhere('customerReturn.created_at >= :startDate', { startDate: filters.start_date });
        }

        if (filters.end_date) {
            queryBuilder.andWhere('customerReturn.created_at <= :endDate', { endDate: filters.end_date });
        }

        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('customerReturn.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async getReturn(returnId: number, organizationId?: number, facilityId?: number): Promise<CustomerReturn> {
        return this.findReturnOrFail(returnId, organizationId, facilityId);
    }

    private async getPreviouslyReturnedQuantity(
        saleId: number,
        saleItemId: number,
        organizationId: number,
        facilityId: number,
        entityManager?: EntityManager,
    ): Promise<number> {
        const repository = (entityManager || AppDataSource.manager).getRepository(CustomerReturnItem);
        const rawResult = await repository
            .createQueryBuilder('returnItem')
            .innerJoin('returnItem.return', 'customerReturn')
            .select('COALESCE(SUM(returnItem.quantity_returned), 0)', 'quantity')
            .where('returnItem.sale_item_id = :saleItemId', { saleItemId })
            .andWhere('customerReturn.sale_id = :saleId', { saleId })
            .andWhere('customerReturn.organization_id = :organizationId', { organizationId })
            .andWhere('customerReturn.facility_id = :facilityId', { facilityId })
            .andWhere('customerReturn.status IN (:...statuses)', { statuses: ACTIVE_RETURN_STATUSES })
            .getRawOne<{ quantity: string }>();

        return Number(rawResult?.quantity || 0);
    }

    private async findReturnOrFail(
        returnId: number,
        organizationId?: number,
        facilityId?: number,
        entityManager?: EntityManager,
    ): Promise<CustomerReturn> {
        const repository = (entityManager || AppDataSource.manager).getRepository(CustomerReturn);
        const where: FindOptionsWhere<CustomerReturn> = { id: returnId };

        if (organizationId) {
            where.organization_id = organizationId;
        }

        if (facilityId) {
            where.facility_id = facilityId;
        }

        const customerReturn = await repository.findOne({
            where,
            relations: [
                'items',
                'items.saleItem',
                'items.medicine',
                'items.batch',
                'sale',
                'sale.items',
                'processedBy',
                'approvedBy',
                'rejectedBy',
                'refundProcessedBy',
                'facility',
                'creditNote',
            ],
        });

        if (!customerReturn) {
            throw new AppError('Return not found', 404);
        }

        return customerReturn;
    }
}
