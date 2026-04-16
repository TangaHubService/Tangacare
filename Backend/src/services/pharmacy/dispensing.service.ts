import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { DispenseTransaction, DispenseType } from '../../entities/DispenseTransaction.entity';
import { StockService } from './stock.service';
import { SafetyService } from './safety.service';
import { SaleService } from './sale.service';
import { Stock } from '../../entities/Stock.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { CreateDispenseTransactionDto, CreateSaleDto } from '../../dto/pharmacy.dto';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { Batch } from '../../entities/Batch.entity';
import { User } from '../../entities/User.entity';
import { Sale, SalePaymentMethod } from '../../entities/Sale.entity';
import { generateDocumentNumber } from '../../utils/document-number.util';
import { SettingsService } from './settings.service';
import { SETTINGS_KEYS } from './settings.constants';

export class DispensingService {
    private dispenseRepository: Repository<DispenseTransaction>;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.dispenseRepository = source.getRepository(DispenseTransaction);
    }

    async generateTransactionNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('DISP');
    }

    /**
     * Legacy single-line dispense API — persisted only through {@link SaleService.createSale}
     * so outbound stock and payments share one ledger with POS.
     */
    async dispense(createDto: CreateDispenseTransactionDto, dispensedById: number): Promise<DispenseTransaction> {
        const stockService = new StockService();
        const safetyService = new SafetyService();
        const settingsService = new SettingsService();
        const effectiveSettings = await settingsService.getEffectiveValuesMap({
            branchId: createDto.facility_id,
            userId: dispensedById,
        });
        const controlledRulesEnabled = Boolean(
            effectiveSettings[SETTINGS_KEYS.CONTROLLED_RULES_ENABLED] ?? true,
        );
        const requirePrescription = Boolean(
            effectiveSettings[SETTINGS_KEYS.CONTROLLED_REQUIRE_PRESCRIPTION] ?? true,
        );
        const requirePatientId = Boolean(
            effectiveSettings[SETTINGS_KEYS.CONTROLLED_REQUIRE_PATIENT_ID] ?? false,
        );

        const safetyResult = await safetyService.performSafetyCheck(
            createDto.facility_id!,
            createDto.organization_id!,
            createDto.medicine_id,
            createDto.quantity,
            createDto.patient_id,
            createDto.prescription_id,
        );

        if (!safetyResult.is_safe) {
            throw new AppError(`Safety Alert: ${safetyResult.errors.join(', ')}`, 400);
        }

        const availableStocks = await stockService.getStockByLocation(
            createDto.facility_id!,
            createDto.organization_id!,
            createDto.department_id || null,
            createDto.medicine_id,
        );

        if (availableStocks.length === 0) {
            throw new AppError('No stock available for this medicine at this location', 404);
        }

        let stockToUse: Stock | undefined;
        if (createDto.batch_id) {
            stockToUse = availableStocks.find((s) => s.batch_id === createDto.batch_id);
            if (!stockToUse) {
                throw new AppError(`Batch ${createDto.batch_id} not available at this location`, 404);
            }
        } else {
            stockToUse = availableStocks[0];
        }

        if (!stockToUse) {
            throw new AppError('No suitable stock found', 404);
        }

        const medicine = await AppDataSource.manager.findOne(Medicine, {
            where: { id: createDto.medicine_id, organization_id: createDto.organization_id },
        });

        if (medicine?.is_controlled_drug && controlledRulesEnabled && requirePatientId && !createDto.patient_id_number) {
            throw new AppError('Patient ID Number is mandatory for controlled substances', 400);
        }

        if (medicine?.is_controlled_drug && controlledRulesEnabled && requirePrescription && !createDto.prescription_id) {
            throw new AppError(`Prescription required for controlled drug: ${medicine.name}`, 400);
        }

        const batch = await AppDataSource.manager.findOne(Batch, {
            where: { id: stockToUse.batch_id, organization_id: createDto.organization_id },
        });

        if (!batch) {
            throw new AppError('Batch not found', 404);
        }

        if (batch.expiry_date && new Date(batch.expiry_date) < new Date()) {
            throw new AppError(
                `Cannot dispense expired batch ${batch.batch_number}. Expiry date: ${batch.expiry_date.toISOString().split('T')[0]}`,
                400,
            );
        }

        const availableQuantity = stockToUse.quantity - stockToUse.reserved_quantity;
        if (availableQuantity < createDto.quantity) {
            throw new AppError(
                `Insufficient stock. Available: ${availableQuantity}, Requested: ${createDto.quantity}`,
                400,
            );
        }

        const performingUser = await AppDataSource.manager.findOne(User, { where: { id: dispensedById } });
        const unitPrice = Number(createDto.unit_price ?? stockToUse.unit_price ?? 0);
        const lineSubtotal = unitPrice * createDto.quantity;

        const saleDto: CreateSaleDto = {
            patient_id: createDto.patient_id,
            prescription_id: createDto.prescription_id,
            dispense_type: createDto.dispense_type,
            vat_rate: 0,
            items: [
                {
                    medicine_id: createDto.medicine_id,
                    batch_id: stockToUse.batch_id,
                    stock_id: stockToUse.id,
                    quantity: createDto.quantity,
                    unit_price: unitPrice,
                },
            ],
            payments: [{ method: SalePaymentMethod.CASH, amount: lineSubtotal }],
            patient_id_type: createDto.patient_id_type,
            patient_id_number: createDto.patient_id_number,
            fefo_override_reason: createDto.fefo_override_reason,
        };

        const saleService = new SaleService();
        const { sale } = await saleService.createSale(
            saleDto,
            dispensedById,
            createDto.facility_id!,
            createDto.organization_id!,
        );

        const auditService = new AuditService();
        await auditService.log({
            facility_id: createDto.facility_id,
            user_id: dispensedById,
            organization_id: createDto.organization_id,
            action: AuditAction.DISPENSE,
            entity_type: AuditEntityType.SALE,
            entity_id: sale.id,
            entity_name: sale.sale_number,
            description: `Legacy POST /dispensing recorded as sale ${sale.sale_number} (unified outbound ledger)`,
            new_values: {
                medicine_id: createDto.medicine_id,
                quantity: createDto.quantity,
                batch_id: stockToUse.batch_id,
                type: createDto.dispense_type,
            },
        });

        return this.mapSaleToDispenseResponse(sale, createDto, performingUser?.license_number);
    }

    private mapSaleToDispenseResponse(
        sale: Sale,
        createDto: CreateDispenseTransactionDto,
        license?: string | null,
    ): DispenseTransaction {
        const item = sale.items?.[0];
        if (!item) {
            throw new AppError('Sale created from dispense is missing line items', 500);
        }
        return {
            id: sale.id,
            transaction_number: sale.sale_number,
            facility_id: sale.facility_id,
            organization_id: sale.organization_id ?? createDto.organization_id,
            department_id: createDto.department_id,
            medicine_id: item.medicine_id,
            batch_id: item.batch_id,
            quantity: item.quantity,
            dispense_type: (createDto.dispense_type as DispenseType) || DispenseType.OTC,
            patient_id: sale.patient_id,
            prescription_id: sale.prescription_id ?? undefined,
            patient_id_type: sale.patient_id_type ?? undefined,
            patient_id_number: sale.patient_id_number ?? undefined,
            dispensing_pharmacist_license: license ?? undefined,
            dispensed_by_id: sale.cashier_id,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost ?? undefined,
            total_amount: sale.total_amount,
            notes: createDto.notes,
            created_at: sale.created_at,
            updated_at: sale.updated_at,
        } as DispenseTransaction;
    }

    async findAll(
        facilityId?: number,
        organizationId?: number,
        patientId?: number,
        page: number = 1,
        limit: number = 10,
    ): Promise<{ data: DispenseTransaction[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .leftJoinAndSelect('dt.batch', 'batch')
            .leftJoinAndSelect('dt.patient', 'patient')
            .leftJoinAndSelect('dt.dispensed_by', 'dispensed_by')
            .leftJoinAndSelect('dt.department', 'department');

        if (organizationId) {
            queryBuilder.where('dt.organization_id = :organizationId', { organizationId });
        }

        if (facilityId) {
            queryBuilder.andWhere('dt.facility_id = :facilityId', { facilityId });
        }

        if (patientId) {
            queryBuilder.andWhere('dt.patient_id = :patientId', { patientId });
        }

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('dt.created_at', 'DESC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async findAllByFacilityIds(
        facilityIds: number[],
        organizationId?: number,
        page: number = 1,
        limit: number = 10,
    ): Promise<{ data: DispenseTransaction[]; total: number; page: number; limit: number }> {
        if (facilityIds.length === 0) {
            return { data: [], total: 0, page, limit };
        }
        const queryBuilder = this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .leftJoinAndSelect('dt.batch', 'batch')
            .leftJoinAndSelect('dt.patient', 'patient')
            .leftJoinAndSelect('dt.dispensed_by', 'dispensed_by')
            .leftJoinAndSelect('dt.department', 'department')
            .where('dt.facility_id IN (:...facilityIds)', { facilityIds });

        if (organizationId) {
            queryBuilder.andWhere('dt.organization_id = :organizationId', { organizationId });
        }

        queryBuilder.orderBy('dt.created_at', 'DESC');

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();
        return { data, total, page, limit };
    }

    async findOne(id: number, organizationId: number, facilityId?: number): Promise<DispenseTransaction> {
        const transaction = await this.dispenseRepository.findOne({
            where: { id, organization_id: organizationId },
            relations: ['medicine', 'batch', 'patient', 'dispensed_by', 'facility', 'department', 'prescription'],
        });

        if (!transaction) {
            throw new AppError('Dispense transaction not found', 404);
        }

        if (facilityId && transaction.facility_id !== facilityId) {
            throw new AppError('You do not have permission to access this dispense transaction', 403);
        }

        return transaction;
    }

    async getSubstitutionRecommendations(
        facilityId: number,
        organizationId: number,
        medicineId: number,
    ): Promise<
        Array<{
            id: number;
            name: string;
            selling_price: number;
            total_stock: number;
            reason: string;
        }>
    > {
        const safetyService = new SafetyService();
        const rawRecommendations = await safetyService.getSmartRecommendations(facilityId, organizationId, medicineId);

        return (rawRecommendations || [])
            .map((row: any) => {
                const id = Number(row?.id ?? row?.medicine_id);
                if (!Number.isInteger(id) || id <= 0) {
                    return null;
                }

                return {
                    id,
                    name: String(row?.name ?? row?.medicine_name ?? `Medicine #${id}`),
                    selling_price: Number(row?.selling_price ?? row?.medicine_selling_price ?? 0),
                    total_stock: Number(row?.total_stock ?? 0),
                    reason: 'Same therapeutic category with available stock',
                };
            })
            .filter(
                (
                    item,
                ): item is {
                    id: number;
                    name: string;
                    selling_price: number;
                    total_stock: number;
                    reason: string;
                } => item !== null,
            );
    }
}
