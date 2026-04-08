import { Repository, EntityManager, Brackets } from 'typeorm';
import PDFDocument from 'pdfkit';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Sale, SaleItem, SalePayment, SalePaymentMethod, SaleStatus } from '../../entities/Sale.entity';
import { Batch } from '../../entities/Batch.entity';
import { InsuranceProvider } from '../../entities/InsuranceProvider.entity';
import { CreateSaleDto } from '../../dto/pharmacy.dto';
import { StockService } from './stock.service';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { Stock } from '../../entities/Stock.entity';
import { StockMovementType } from '../../entities/StockMovement.entity';
import { generateDocumentNumber } from '../../utils/document-number.util';
import { InsuranceService } from './insurance.service';
import { applyScope } from '../../utils/scope.util';
import { AuthRequest } from '../../middleware/auth.middleware';
import { SettingsService } from './settings.service';
import { SETTINGS_KEYS } from './settings.constants';
import { PdfBrandingUtil } from '../../utils/pdf-branding.util';
import { roundMoney, formatMoney as formatMoneyUtil } from '../../utils/money.util';



export class SaleService {
    private saleRepository: Repository<Sale>;
    constructor(entityManager?: EntityManager) {
        const source = (entityManager as any) || AppDataSource;
        this.saleRepository = source.getRepository(Sale);
    }
    async generateSaleNumber(facilityId: number): Promise<string> {
        void facilityId;
        return generateDocumentNumber('SALE');
    }

    async createSale(createDto: CreateSaleDto, cashierId: number, facilityId: number, organizationId: number): Promise<Sale> {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            const saleRepo = transactionalEntityManager.getRepository(Sale);
            const saleItemRepo = transactionalEntityManager.getRepository(SaleItem);
            const salePaymentRepo = transactionalEntityManager.getRepository(SalePayment);
            const batchRepo = transactionalEntityManager.getRepository(Batch);

            // Initialize services with the transaction manager
            const stockService = new StockService(transactionalEntityManager);
            const auditService = new AuditService(transactionalEntityManager);
            const settingsService = new SettingsService(transactionalEntityManager);
            const effectiveSettings = await settingsService.getEffectiveValuesMap({
                branchId: facilityId,
                userId: cashierId,
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
            const fefoStrict = Boolean(effectiveSettings[SETTINGS_KEYS.INVENTORY_FEFO_STRICT] ?? true);
            const vatEnabled = Boolean(effectiveSettings[SETTINGS_KEYS.TAX_VAT_ENABLED] ?? true);
            const defaultCurrency =
                (SettingsService.systemDefaultValue(SETTINGS_KEYS.CURRENCY_BASE) as string) ?? 'RWF';
            const currencyCode = String(effectiveSettings[SETTINGS_KEYS.CURRENCY_BASE] || defaultCurrency);

            if (!createDto.items || createDto.items.length === 0) {
                throw new AppError('Sale must have at least one item', 400);
            }

            // Validate stock availability and expiry for all items
            for (const item of createDto.items) {
                let stockSnapshot: Stock | null = null;
                if (item.stock_id) {
                    stockSnapshot = await transactionalEntityManager.getRepository(Stock).findOne({
                        where: {
                            id: item.stock_id,
                            facility_id: facilityId,
                            organization_id: organizationId,
                            medicine_id: item.medicine_id,
                            is_deleted: false,
                        },
                        lock: { mode: 'pessimistic_write' }, // ✅ CRITICAL: Lock row to prevent race conditions
                    });

                    if (!stockSnapshot) {
                        throw new AppError(
                            `Selected stock row ${item.stock_id} is not available for medicine ID ${item.medicine_id}`,
                            404,
                        );
                    }
                }

                const batchId = item.batch_id ?? stockSnapshot?.batch_id;
                if (!batchId) {
                    throw new AppError(
                        `Batch ID or stock ID is required for medicine ID ${item.medicine_id}`,
                        400,
                    );
                }

                if (item.batch_id && stockSnapshot && stockSnapshot.batch_id !== item.batch_id) {
                    throw new AppError(
                        `Selected stock row ${item.stock_id} does not match batch ${item.batch_id} for medicine ID ${item.medicine_id}`,
                        400,
                    );
                }

                // ✅ CRITICAL: Check if batch is available in this facility & not expired
                const batch = await batchRepo.findOne({
                    where: { id: batchId, facility_id: facilityId },
                    relations: ['medicine'],
                });
                if (!batch) {
                    throw new AppError(`Batch row is not available in current facility ${facilityId}`, 404);
                }
                if (new Date(batch.expiry_date) < new Date()) {
                    await auditService.log({
                        facility_id: facilityId,
                        user_id: cashierId,
                        organization_id: organizationId,
                        action: AuditAction.ACCESS_DENIED,
                        entity_type: AuditEntityType.BATCH,
                        entity_id: batch.id,
                        entity_name: batch.batch_number,
                        description: `BLOCKED: Attempted to sell expired item: ${batch.medicine?.name || 'Unknown'} (Batch: ${batch.batch_number}, Expired: ${new Date(batch.expiry_date).toLocaleDateString()})`,
                    });
                    throw new AppError(
                        `Cannot sell expired item: ${batch.medicine?.name || 'Unknown'} (Batch: ${batch.batch_number}, Expired: ${new Date(batch.expiry_date).toLocaleDateString()})`,
                        400,
                    );
                }

                // ✅ CRITICAL: Enforce Controlled Drug policies from effective settings
                if (batch.medicine?.is_controlled_drug && controlledRulesEnabled) {
                    if (requirePatientId && !createDto.patient_id_number) {
                        throw new AppError(
                            `Patient ID is required for controlled drug: ${batch.medicine.name}`,
                            400,
                        );
                    }

                    if (requirePrescription && !createDto.prescription_id) {
                        await auditService.log({
                            facility_id: facilityId,
                            user_id: cashierId,
                            organization_id: organizationId,
                            action: AuditAction.ACCESS_DENIED,
                            entity_type: AuditEntityType.SALE,
                            entity_id: 0, // No sale created yet
                            entity_name: 'Controlled Drug Sale',
                            description: `BLOCKED: Attempted to sell controlled drug without prescription: ${batch.medicine.name}`,
                        });
                        throw new AppError(
                            `Prescription ID is required for controlled drug: ${batch.medicine.name}`,
                            400,
                        );
                    }
                }

                if (stockSnapshot?.is_frozen) {
                    throw new AppError(
                        `Batch ${batch.batch_number} is quarantined/frozen and cannot be dispensed`,
                        409,
                    );
                }

                // ✅ CRITICAL: Enforce FEFO (block non-compliant batch selection)
                const earliestBatch = await stockService.getEarliestExpiringBatch(facilityId, organizationId, item.medicine_id);
                const earliestBatchCanFulfill =
                    earliestBatch &&
                    (await stockService.checkStockAvailability(
                        facilityId,
                        organizationId,
                        item.medicine_id,
                        earliestBatch.id,
                        item.quantity,
                        undefined,
                    ));
                if (
                    fefoStrict &&
                    earliestBatch &&
                    earliestBatchCanFulfill &&
                    earliestBatch.id !== batchId &&
                    new Date(earliestBatch.expiry_date) < new Date(batch.expiry_date)
                ) {
                    await auditService.log({
                        facility_id: facilityId,
                        user_id: cashierId,
                        organization_id: organizationId,
                        action: AuditAction.FEFO_VIOLATION,
                        entity_type: AuditEntityType.SALE,
                        entity_id: 0, // No sale created yet
                        entity_name: 'FEFO Violation',
                        description: `FEFO VIOLATION: Selected Batch ${batch.batch_number} (Exp: ${new Date(batch.expiry_date).toLocaleDateString()}), available earlier Batch ${earliestBatch.batch_number} (Exp: ${new Date(earliestBatch.expiry_date).toLocaleDateString()})`,
                    });
                    throw new AppError(
                        `FEFO rule: use batch ${earliestBatch.batch_number} (earlier expiry) before ${batch.batch_number}`,
                        409,
                    );
                }

                const isAvailable = item.stock_id
                    ? Number((stockSnapshot?.quantity || 0) - (stockSnapshot?.reserved_quantity || 0)) >=
                    Number(item.quantity || 0)
                    : await stockService.checkStockAvailability(
                        facilityId,
                        organizationId,
                        item.medicine_id,
                        batchId,
                        item.quantity,
                        undefined, // department_id
                        true, // lock for transaction
                    );
                if (!isAvailable) {
                    throw new AppError(
                        `Insufficient stock for medicine ID ${item.medicine_id}, batch ID ${batchId}`,
                        400,
                    );
                }

                const unitCost = await stockService.getBatchCost(batchId, organizationId);
                if (Number(item.unit_price) < unitCost) {
                    throw new AppError(
                        `Selling price cannot be below cost for medicine ID ${item.medicine_id} (price: ${Number(item.unit_price).toFixed(2)}, cost: ${unitCost.toFixed(2)})`,
                        400,
                    );
                }
            }

            const vatRate = vatEnabled
                ? await settingsService.normalizeVatRateToDecimal(createDto.vat_rate, {
                    tenantId: organizationId,
                    branchId: facilityId,
                    userId: cashierId,
                })
                : 0;
            const runtimeConfig = await settingsService.getRuntimeConfig({
                tenantId: organizationId,
                branchId: facilityId,
                userId: cashierId,
            });
            const decimals = runtimeConfig.currencyDecimals;
            const rawSubtotal = createDto.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
            const rawVatAmount = rawSubtotal * vatRate;
            const subtotal = roundMoney(rawSubtotal, decimals);
            const vatAmount = roundMoney(rawVatAmount, decimals);
            const totalAmount = roundMoney(subtotal + vatAmount, decimals);

            const payments = createDto.payments || [];
            const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
            const balanceAmount = totalAmount - paidAmount;

            let status: SaleStatus = SaleStatus.UNPAID;
            if (paidAmount >= totalAmount) status = SaleStatus.PAID;
            else if (paidAmount > 0) status = SaleStatus.PARTIALLY_PAID;

            const saleNumber = await this.generateSaleNumber(facilityId);

            const sale = saleRepo.create({
                sale_number: saleNumber,
                facility_id: facilityId,
                patient_id: createDto.patient_id,
                prescription_id: createDto.prescription_id,
                cashier_id: cashierId,
                patient_id_type: createDto.patient_id_type,
                patient_id_number: createDto.patient_id_number,
                subtotal,
                vat_rate: vatRate,
                vat_amount: vatAmount,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                balance_amount: balanceAmount,
                status,
                organization_id: organizationId,
            });

            const savedSale = await saleRepo.save(sale);

            // Process each sale item
            for (const item of createDto.items) {
                let stockSnapshot: Stock | null = null;
                if (item.stock_id) {
                    stockSnapshot = await transactionalEntityManager.getRepository(Stock).findOne({
                        where: {
                            id: item.stock_id,
                            facility_id: facilityId,
                            organization_id: organizationId,
                            medicine_id: item.medicine_id,
                            is_deleted: false,
                        },
                    });

                    if (!stockSnapshot) {
                        throw new AppError(
                            `Selected stock row ${item.stock_id} is not available for medicine ID ${item.medicine_id}`,
                            404,
                        );
                    }
                }

                const batchId = item.batch_id ?? stockSnapshot?.batch_id;
                if (!batchId) {
                    throw new AppError(
                        `Batch ID or stock ID is required for medicine ID ${item.medicine_id}`,
                        400,
                    );
                }

                // 1. Get batch cost for COGS (capture at sale time, not report time)
                const unitCost = await stockService.getBatchCost(batchId, organizationId);

                // 2. Create sale item with COGS
                const saleItem = saleItemRepo.create({
                    sale_id: savedSale.id,
                    medicine_id: item.medicine_id,
                    batch_id: batchId,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_cost: unitCost, // ✅ CRITICAL: Capture COGS at sale time
                    total_price: item.unit_price * item.quantity,
                    organization_id: organizationId,
                });
                await saleItemRepo.save(saleItem);

                // 3. Deduct stock and create stock movement linked to sale
                if (item.stock_id) {
                    await stockService.deductStock(item.stock_id, organizationId, item.quantity, {
                        type: StockMovementType.OUT,
                        reference_type: 'sale',
                        reference_id: savedSale.id,
                        user_id: cashierId,
                        notes: 'Stock deducted for sale',
                    });
                } else {
                    await stockService.deductStockForSale(
                        facilityId,
                        organizationId,
                        item.medicine_id,
                        batchId,
                        item.quantity,
                        savedSale.id, // ✅ Link stock movement to sale
                        cashierId,
                        undefined, // department_id
                    );
                }
            }

            let insuranceProvider: InsuranceProvider | null = null;
            if (createDto.insurance_provider_id) {
                insuranceProvider = await transactionalEntityManager.findOne(InsuranceProvider, {
                    where: { id: createDto.insurance_provider_id },
                });
            }

            for (const p of payments) {
                let paymentAmount = p.amount;

                // If payment method is INSURANCE, validate and calculate
                if (p.method === SalePaymentMethod.INSURANCE) {
                    if (!insuranceProvider) {
                        throw new AppError('Insurance provider is required for insurance payments', 400);
                    }

                    // Calculate coverage based on provider percentage
                    const coveragePercent = Number(insuranceProvider.coverage_percentage);
                    let CalculatedInsuranceAmount = (totalAmount * coveragePercent) / 100;

                    // Apply max coverage limit if defined
                    if (
                        insuranceProvider.max_coverage_limit &&
                        CalculatedInsuranceAmount > Number(insuranceProvider.max_coverage_limit)
                    ) {
                        CalculatedInsuranceAmount = Number(insuranceProvider.max_coverage_limit);
                    }

                    // Round to nearest integer (or logic preferred by user)
                    paymentAmount = Math.round(CalculatedInsuranceAmount);
                }

                const payment = salePaymentRepo.create({
                    sale_id: savedSale.id,
                    method: p.method as SalePaymentMethod,
                    amount: paymentAmount,
                    reference: p.reference,
                    organization_id: organizationId,
                });
                const savedPayment = await salePaymentRepo.save(payment);

                // ✅ CRITICAL: Audit each payment event
                await auditService.log({
                    facility_id: facilityId,
                    user_id: cashierId,
                    organization_id: organizationId,
                    action: AuditAction.UPDATE,
                    entity_type: AuditEntityType.SALE,
                    entity_id: savedSale.id,
                    entity_name: savedSale.sale_number,
                    description: `Payment received: ${currencyCode} ${paymentAmount} via ${p.method}`,
                    new_values: { payment_id: savedPayment.id, amount: paymentAmount, method: p.method },
                });

                if (p.method === SalePaymentMethod.INSURANCE && insuranceProvider) {
                    const insuranceService = new InsuranceService(transactionalEntityManager);
                    await insuranceService.createClaim({
                        sale_id: savedSale.id,
                        provider_id: insuranceProvider.id,
                        patient_insurance_number: createDto.patient_insurance_number,
                        total_amount: totalAmount,
                        applied_coverage_percentage: Number(insuranceProvider.coverage_percentage),
                        expected_amount: paymentAmount,
                        copay_amount: totalAmount - paymentAmount,
                        status: 'pending' as any,
                    });
                }
            }

            const result = await saleRepo.findOne({
                where: { id: savedSale.id },
                relations: ['items', 'items.medicine', 'items.batch', 'payments', 'patient', 'cashier', 'facility'],
            });

            if (!result) throw new AppError('Sale not found after creation', 500);
            return result;
        });
    }

    async listSales(
        facilityId: number | undefined,
        page: number = 1,
        limit: number = 10,
        organizationId?: number,
        req?: AuthRequest,
        patientId?: number,
        search?: string,
    ): Promise<{ data: Sale[]; total: number; page: number; limit: number }> {

        const skip = (page - 1) * limit;

        const queryBuilder = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.patient', 'patient')
            .leftJoinAndSelect('sale.cashier', 'cashier')
            .orderBy('sale.created_at', 'DESC');

        if (req?.scope) {
            applyScope(queryBuilder, req.scope);
            if (organizationId) {
                queryBuilder.andWhere('sale.organization_id = :organizationId', { organizationId });
            }
        } else {
            if (organizationId) {
                queryBuilder.andWhere('sale.organization_id = :organizationId', { organizationId });
                if (facilityId) {
                    queryBuilder.andWhere('sale.facility_id = :facilityId', { facilityId });
                }
            } else if (facilityId) {
                queryBuilder.where('sale.facility_id = :facilityId', { facilityId });
            }
        }

        if (patientId) {
            queryBuilder.andWhere('sale.patient_id = :patientId', { patientId });
        }

        if (search && search.trim() !== '') {
            const term = `%${search.trim()}%`;
            queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where('sale.sale_number ILIKE :term', { term })
                        .orWhere('patient.first_name ILIKE :term', { term })
                        .orWhere('patient.last_name ILIKE :term', { term });
                }),
            );
        }

        const [data, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

        return { data, total, page, limit };
    }

    async getSale(id: number, organizationId: number, facilityId?: number): Promise<Sale> {
        const where: any = { id, organization_id: organizationId };
        if (facilityId) where.facility_id = facilityId;

        const sale = await this.saleRepository.findOne({
            where,
            relations: ['items', 'items.medicine', 'items.batch', 'payments', 'patient', 'cashier', 'facility'],
        });
        if (!sale) throw new AppError('Sale not found', 404);
        return sale;
    }

    // H-1: Generate a PDF receipt for a completed sale
    async generateReceiptPdf(saleId: number, organizationId: number, facilityId: number): Promise<Buffer> {
        const sale = await this.getSale(saleId, organizationId, facilityId);
        const settingsService = new SettingsService();
        const runtimeConfig = await settingsService.getRuntimeConfig({
            tenantId: organizationId,
            branchId: facilityId,
        });

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A5', margin: 24, bufferPages: true });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const PRIMARY = '#0f766e';
            const PRIMARY_LIGHT = '#e6f4f1';
            const BORDER = '#dbe3ec';
            const MUTED = '#64748b';
            const TEXT = '#0f172a';
            const SOFT_BG = '#f8fafc';

            const left = doc.page.margins.left;
            const right = doc.page.width - doc.page.margins.right;
            const width = right - left;
            const bottomLimit = doc.page.height - doc.page.margins.bottom;

            const formatMoney = (value: number | string | null | undefined): string =>
                formatMoneyUtil(value, {
                    symbol: runtimeConfig.currencySymbol,
                    decimals: runtimeConfig.currencyDecimals,
                });

            const personName = (user: any): string =>
                [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || '-';

            const toSentenceCase = (value: string): string => {
                const normalized = String(value || '')
                    .replace(/[_-]+/g, ' ')
                    .trim()
                    .toLowerCase();
                return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '-';
            };

            const drawMeta = (label: string, value: string, x: number, y: number, w: number) => {
                doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text(label.toUpperCase(), x, y, { width: w });
                doc.font('Helvetica').fontSize(8.5).fillColor(TEXT).text(value, x, y + 9, { width: w });
            };

            const drawItemsHeader = (y: number) => {
                const headerH = 18;
                doc.roundedRect(left, y, width, headerH, 4).fill(PRIMARY_LIGHT);
                doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(7.5)
                    .text('ITEM', left + 8, y + 5, { width: width * 0.47 })
                    .text('QTY', left + width * 0.47, y + 5, { width: width * 0.12, align: 'center' })
                    .text('UNIT', left + width * 0.59, y + 5, { width: width * 0.20, align: 'right' })
                    .text('TOTAL', left + width * 0.79, y + 5, { width: width * 0.21 - 8, align: 'right' });
                return y + headerH + 4;
            };

            // Header Card
            const headerY = doc.y;
            doc.roundedRect(left, headerY, width, 82, 8).fill(SOFT_BG).strokeColor(BORDER).lineWidth(0.8).stroke();
            const logoOffset = PdfBrandingUtil.drawLogo(doc, left + 12, headerY + 12, 24);
            const headerTextX = left + 12 + logoOffset;
            doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(15)
                .text((sale.facility as any)?.name ?? 'Pharmacy', headerTextX, headerY + 10, {
                    width: width - 140 - logoOffset,
                });
            doc.font('Helvetica').fontSize(8).fillColor(MUTED);
            const facilityAddress = String((sale.facility as any)?.address || '-');
            doc.text(facilityAddress, headerTextX, headerY + 30, { width: width - 140 - logoOffset });
            if ((sale.facility as any)?.tin_number) {
                doc.text(`TIN: ${(sale.facility as any).tin_number}`, headerTextX, headerY + 45);
            }
            if ((sale.facility as any)?.phone) {
                doc.text(`Tel: ${(sale.facility as any).phone}`, headerTextX, headerY + 57);
            }

            doc.roundedRect(right - 120, headerY + 12, 108, 22, 6).fill(PRIMARY_LIGHT);
            doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(8.5)
                .text('SALES RECEIPT', right - 120, headerY + 19, { width: 108, align: 'center' });
            doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8)
                .text(`#${sale.sale_number}`, right - 120, headerY + 44, { width: 108, align: 'center' });

            doc.y = headerY + 96;

            // Sale Meta
            const metaY = doc.y;
            doc.roundedRect(left, metaY, width, 62, 8).strokeColor(BORDER).lineWidth(0.8).stroke();
            const half = width / 2;
            drawMeta(
                'Date',
                new Date(sale.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
                left + 10,
                metaY + 9,
                half - 18,
            );
            drawMeta('Cashier', personName(sale.cashier), left + 10, metaY + 33, half - 18);
            drawMeta('Patient', sale.patient_id ? personName(sale.patient) : 'Walk-in customer', left + half + 8, metaY + 9, half - 18);
            drawMeta(
                'Status',
                String((sale as any).status || '-').toUpperCase(),
                left + half + 8,
                metaY + 33,
                half - 18,
            );
            doc.y = metaY + 74;

            // Items Table
            doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text('Items', left, doc.y, { width });
            let rowY = drawItemsHeader(doc.y + 12);

            const nameW = width * 0.47;
            const qtyW = width * 0.12;
            const unitW = width * 0.20;
            const totalW = width * 0.21;

            for (const item of sale.items ?? []) {
                const medicineName = (item.medicine as any)?.name ?? `Medicine #${item.medicine_id}`;
                const nameHeight = doc.heightOfString(medicineName, { width: nameW - 12, align: 'left' });
                const rowH = Math.max(18, nameHeight + 6);

                if (rowY + rowH > bottomLimit - 140) {
                    doc.addPage();
                    doc.y = doc.page.margins.top;
                    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
                        .text(`Receipt ${sale.sale_number} (continued)`, left, doc.y, { width });
                    rowY = drawItemsHeader(doc.y + 10);
                }

                doc.font('Helvetica').fontSize(8.5).fillColor(TEXT)
                    .text(medicineName, left + 8, rowY + 3, { width: nameW - 12 })
                    .text(String(item.quantity), left + nameW, rowY + 3, { width: qtyW, align: 'center' })
                    .text(formatMoney(item.unit_price), left + nameW + qtyW, rowY + 3, { width: unitW, align: 'right' })
                    .text(formatMoney(item.total_price), left + nameW + qtyW + unitW, rowY + 3, { width: totalW - 8, align: 'right' });

                doc.moveTo(left, rowY + rowH).lineTo(right, rowY + rowH).strokeColor('#eef2f7').lineWidth(0.8).stroke();
                rowY += rowH;
            }

            doc.y = rowY + 10;

            // Totals Card
            const totalsW = 190;
            const totalsX = right - totalsW;
            const totalsY = doc.y;
            const totalsH = 72;

            if (totalsY + totalsH > bottomLimit - 80) {
                doc.addPage();
                doc.y = doc.page.margins.top;
            }

            doc.roundedRect(totalsX, doc.y, totalsW, totalsH, 8).fill(SOFT_BG).strokeColor(BORDER).lineWidth(0.8).stroke();
            let ty = doc.y + 10;
            const labelX = totalsX + 10;
            const valueX = totalsX + totalsW - 10;

            doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Subtotal', labelX, ty);
            doc.font('Helvetica-Bold').fillColor(TEXT).text(formatMoney(sale.subtotal), labelX, ty, { width: totalsW - 20, align: 'right' });
            ty += 14;

            const vatPct = Math.round(Number(sale.vat_rate ?? runtimeConfig.vatRate) * 100);
            doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`VAT (${vatPct}%)`, labelX, ty);
            doc.font('Helvetica-Bold').fillColor(TEXT).text(formatMoney(sale.vat_amount), labelX, ty, { width: totalsW - 20, align: 'right' });
            ty += 14;

            doc.moveTo(labelX, ty + 2).lineTo(valueX, ty + 2).strokeColor(BORDER).lineWidth(0.8).stroke();
            ty += 8;

            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PRIMARY).text('Total', labelX, ty);
            doc.text(formatMoney(sale.total_amount), labelX, ty, { width: totalsW - 20, align: 'right' });

            doc.y = Math.max(doc.y + totalsH + 8, rowY + 8);

            // Payments
            if (sale.payments?.length) {
                if (doc.y + 20 + sale.payments.length * 12 > bottomLimit - 60) {
                    doc.addPage();
                    doc.y = doc.page.margins.top;
                }

                doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEXT).text('Payment Breakdown', left, doc.y, { width });
                doc.y += 4;

                for (const payment of sale.payments) {
                    const method = toSentenceCase(String(payment.method || ''));
                    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(method, left, doc.y, { width: width * 0.5 });
                    doc.font('Helvetica-Bold').fillColor(TEXT).text(formatMoney(payment.amount), left, doc.y, {
                        width,
                        align: 'right',
                    });
                    doc.y += 12;
                }
            }

            // Footer
            const footerY = Math.min(bottomLimit - 58, doc.y + 8);
            doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(BORDER).lineWidth(0.8).stroke();
            doc.font('Helvetica').fontSize(7.2).fillColor(MUTED)
                .text('Thank you for choosing us. Keep this receipt for your records.', left, footerY + 6, {
                    width,
                    align: 'center',
                })
                .text(`Printed: ${new Date().toLocaleString('en-GB')}`, left, footerY + 16, {
                    width,
                    align: 'center',
                });

            PdfBrandingUtil.decorateBufferedPages(doc);
            doc.end();
        });
    }
}
