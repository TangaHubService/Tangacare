import { Repository, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Medicine } from '../../entities/Medicine.entity';
import { PurchaseOrder } from '../../entities/PurchaseOrder.entity';
import { Batch } from '../../entities/Batch.entity';
import { SaleItem, Sale, SaleStatus } from '../../entities/Sale.entity';
import { InsuranceClaim, InsuranceClaimStatus } from '../../entities/InsuranceClaim.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { StockMovement, StockMovementType } from '../../entities/StockMovement.entity';
import { Stock } from '../../entities/Stock.entity';
import { Facility } from '../../entities/Facility.entity';
import { GoodsReceipt } from '../../entities/GoodsReceipt.entity';
import { AuditService, StockMovementRow } from './audit.service';
import { ReplenishmentService } from './replenishment.service';

export interface SalesSummaryReport {
    facility_id: number;
    period: { start: string; end: string };
    total_revenue: number;
    total_profit: number;
    total_sales_count: number;
    total_items_sold: number;
    top_selling_items: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        revenue: number;
        profit: number;
    }>;
    daily_sales: Array<{
        date: string;
        revenue: number;
        profit: number;
        sales_count: number;
    }>;
    transactions: Array<{
        sale_id: number;
        sale_number: string;
        date: string;
        patient_name: string | null;
        cashier_name: string;
        total_amount: number;
        profit: number;
        items_count: number;
    }>;
    /** Present when transaction list is capped for payload size */
    transactions_total?: number;
    transactions_truncated?: boolean;
}

export interface LowStockReport {
    facility_id: number;
    items: Array<{
        medicine_id: number;
        medicine_name: string;
        current_quantity: number;
        min_stock_level: number;
        reorder_point: number;
        avg_daily_consumption?: number;
        days_of_cover?: number;
        deficit_quantity?: number;
        status: 'critical' | 'low' | 'warning';
        recommended_action?: string;
    }>;
}

export interface ExpiryReport {
    facility_id: number;
    expiring_soon: Array<{
        batch_id: number;
        batch_number: string;
        medicine_name: string;
        expiry_date: string;
        days_until_expiry: number;
        quantity: number;
        risk_level?: 'critical' | 'warning' | 'watch';
        recommended_action?: string;
    }>;
    expired: Array<{
        batch_id: number;
        batch_number: string;
        medicine_name: string;
        expiry_date: string;
        quantity: number;
        risk_level?: 'expired';
        recommended_action?: string;
    }>;
}

export interface DailyCashReport {
    facility_id: number;
    date: string;
    total_sales: number;
    by_payment_method: Array<{
        method: string;
        amount: number;
        transaction_count: number;
        percentage: number;
    }>;
    opening_balance?: number;
    closing_balance?: number;
}

export interface ControlledDrugsRegisterReport {
    facility_id: number;
    period: { start: string; end: string };
    total_transactions: number;
    total_quantity_dispensed: number;
    transactions: Array<{
        sale_id: number;
        sale_number: string;
        date: string;
        medicine_name: string;
        batch_number: string;
        quantity: number;
        patient_name: string | null;
        cashier_name: string;
    }>;
}

export interface StockRegisterReport {
    facility_id: number;
    period?: { start: string; end: string };
    data: StockMovementRow[];
    total: number;
    page: number;
    limit: number;
}

export interface PurchaseHistoryReport {
    facility_id: number;
    period: { start: string; end: string };
    total_orders: number;
    total_amount: number;
    orders: Array<{
        order_id: number;
        order_number: string;
        supplier_name: string;
        order_date: string;
        received_date: string | null;
        status: string;
        total_amount: number;
        items_count: number;
    }>;
}

export interface TaxSummaryReport {
    facility_id: number;
    period: { start: string; end: string };
    total_taxable_amount: number;
    total_vat_amount: number;
    tax_details: Array<{
        tax_rate: number;
        taxable_amount: number;
        tax_amount: number;
    }>;
}

export interface CustomerLoyaltyReport {
    facility_id: number;
    total_patients: number;
    repeat_customers: number;
    top_patients: Array<{
        patient_id: number;
        patient_name: string;
        total_spent: number;
        visit_count: number;
        last_visit: string;
    }>;
}

export interface EmployeePerformanceReport {
    facility_id: number;
    period: { start: string; end: string };
    performers: Array<{
        employee_id: number;
        employee_name: string;
        total_sales: number;
        transaction_count: number;
        average_transaction_value: number;
    }>;
}

export interface VendorReturnsReport {
    facility_id: number;
    total_returned_amount: number;
    return_count: number;
    recent_notes: Array<{
        note_id: number;
        note_number: string;
        sale_number: string;
        amount: number;
        reason: string;
        created_at: string;
    }>;
}

export interface PurchaseReport {
    facility_id: number;
    period: { start: string; end: string };
    summary: {
        total_amount: number;
        order_count: number;
        average_order_value: number;
        by_status: Record<string, number>;
    };
    by_supplier: Array<{
        supplier_id: number;
        supplier_name: string;
        order_count: number;
        total_amount: number;
    }>;
    by_item: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity_ordered: number;
        total_amount: number;
    }>;
    orders: Array<{
        id: number;
        order_number: string;
        supplier_name: string;
        date: string;
        status: string;
        total_amount: number;
    }>;
}

export interface InventoryAgingReport {
    facility_id: number;
    as_of_date: string;
    summary: {
        total_quantity: number;
        total_value: number;
    };
    buckets: Array<{
        bucket: '0-30' | '31-60' | '61-90' | '90+';
        quantity: number;
        value: number;
        item_count: number;
    }>;
    items: Array<{
        medicine_id: number;
        medicine_name: string;
        batch_id: number;
        batch_number: string;
        quantity: number;
        unit_cost: number;
        inventory_value: number;
        age_days: number;
        bucket: '0-30' | '31-60' | '61-90' | '90+';
    }>;
}

export interface PurchaseVsSalesReport {
    facility_id: number;
    period: { start: string; end: string };
    totals: {
        purchase_amount: number;
        sales_amount: number;
        variance_amount: number;
        purchase_to_sales_ratio: number;
    };
    timeline: Array<{
        date: string;
        purchase_amount: number;
        sales_amount: number;
        variance_amount: number;
    }>;
}

export interface MedicineMarginReport {
    facility_id: number;
    period: { start: string; end: string };
    summary: {
        total_revenue: number;
        total_cogs: number;
        total_profit: number;
        average_margin_percent: number;
    };
    items: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        revenue: number;
        cogs: number;
        profit: number;
        profit_margin_percent: number;
    }>;
}

export interface PaymentBreakdown {
    payment_method: string;
    total_amount: number;
    transaction_count?: number;
    percentage?: number;
}

export interface CategorySummary {
    category_id: number;
    category_name: string;
    revenue: number;
    profit: number;
}

export interface TopRevenueMedicine {
    medicine_id: number;
    medicine_name: string;
    revenue: number;
    quantity: number;
    profit: number;
}

export interface BatchTraceabilityRow {
    transaction_id: number;
    transaction_number: string;
    date: string;
    patient_id: number | null;
    patient_name: string;
    quantity: number;
    dispensed_by: string;
}

export interface BatchTraceabilityReport {
    batch_id: number;
    batch_number: string;
    medicine_name: string;
    expiry_date: string;
    total_dispensed: number;
    patients: BatchTraceabilityRow[];
}

export interface ControlledDrugRegisterRow {
    id: number;
    date: string;
    type: string;
    reference: string;
    quantity_in: number;
    quantity_out: number;
    balance: number;
    user_name: string;
    notes: string;
}

export interface ControlledDrugRegisterReport {
    medicine_id: number;
    medicine_name: string;
    current_balance: number;
    movements: ControlledDrugRegisterRow[];
}

export interface InsuranceDashboardSummary {
    period: { start: string; end: string };
    open_claims_count: number;
    open_claims_expected_total: number;
    rejected_claims_count: number;
    insurance_received_total: number;
    sales_patient_paid_total: number;
    sales_insurance_expected_total: number;
    top_providers: Array<{
        provider_id: number;
        provider_name: string;
        claims_count: number;
        expected_total: number;
    }>;
    stale_pending_claims_count: number;
}

export class ReportingService {
    private purchaseOrderRepository: Repository<PurchaseOrder>;
    private batchRepository: Repository<Batch>;
    private saleItemRepository: Repository<SaleItem>;
    private saleRepository: Repository<Sale>;
    private medicineRepository: Repository<Medicine>;
    private dispenseRepository: Repository<DispenseTransaction>;
    private auditService: AuditService;
    private replenishmentService: ReplenishmentService;

    private stockRepository: Repository<Stock>;

    constructor() {
        this.purchaseOrderRepository = AppDataSource.getRepository(PurchaseOrder);
        this.batchRepository = AppDataSource.getRepository(Batch);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.saleRepository = AppDataSource.getRepository(Sale);
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
        this.auditService = new AuditService();
        this.replenishmentService = new ReplenishmentService();
        this.stockRepository = AppDataSource.getRepository(Stock);
    }

    private requireScope(facilityId?: number, organizationId?: number, context: string = 'report'): void {
        if (!facilityId && !organizationId) {
            throw new Error(`facilityId or organizationId is required for ${context}`);
        }
    }

    private static readonly SALES_SUMMARY_MAX_RANGE_DAYS = 366;
    private static readonly SALES_SUMMARY_MAX_TRANSACTION_ROWS_DEFAULT = 2000;

    private getSalesSummaryMaxTransactionRows(): number {
        const raw = process.env.SALES_SUMMARY_MAX_TRANSACTION_ROWS;
        const n = raw ? parseInt(raw, 10) : NaN;
        if (Number.isFinite(n) && n > 0) {
            return Math.min(n, 50_000);
        }
        return ReportingService.SALES_SUMMARY_MAX_TRANSACTION_ROWS_DEFAULT;
    }

    private enforceSalesSummaryDateRange(startDate: Date, endDate: Date): void {
        const ms = endDate.getTime() - startDate.getTime();
        const days = ms / (24 * 60 * 60 * 1000);
        if (days > ReportingService.SALES_SUMMARY_MAX_RANGE_DAYS || days < 0) {
            throw new AppError(
                `Sales summary date range must be between 0 and ${ReportingService.SALES_SUMMARY_MAX_RANGE_DAYS} days`,
                400,
            );
        }
    }

    private applyTenantScope<T extends SelectQueryBuilder<any>>(
        query: T,
        alias: string,
        facilityId?: number,
        organizationId?: number,
    ): T {
        if (organizationId) {
            query.andWhere(`${alias}.organization_id = :organizationId`, { organizationId });
        }

        if (facilityId) {
            query.andWhere(`${alias}.facility_id = :facilityId`, { facilityId });
        }

        return query;
    }

    async getSalesSummaryReport(
        facilityId: number | undefined,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
        options?: { includeTransactions?: boolean },
    ): Promise<SalesSummaryReport> {
        const includeTransactions = options?.includeTransactions ?? true;
        this.requireScope(facilityId, organizationId, 'sales summary report');
        this.enforceSalesSummaryDateRange(startDate, endDate);

        // Get all sales in period
        const salesQuery = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .leftJoinAndSelect('sale.patient', 'patient')
            .leftJoinAndSelect('sale.cashier', 'cashier')
            .where('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .orderBy('sale.created_at', 'DESC');
        this.applyTenantScope(salesQuery, 'sale', facilityId, organizationId);

        const sales = await salesQuery.getMany();

        const dispenseQuery = this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .leftJoinAndSelect('dt.patient', 'patient')
            .leftJoinAndSelect('dt.dispensed_by', 'dispensed_by')
            .where('dt.created_at BETWEEN :startDate AND :endDate', { startDate, endDate });
        this.applyTenantScope(dispenseQuery, 'dt', facilityId, organizationId);

        const dispenseTransactions = await dispenseQuery.getMany();

        // Calculate totals
        let totalRevenue = 0;
        let totalProfit = 0;
        let totalItemsSold = 0;
        let totalSalesCount = sales.length;

        const medicineStats = new Map<number, { name: string; quantity: number; revenue: number; profit: number }>();
        const dailyStats = new Map<string, { revenue: number; profit: number; count: number }>();

        sales.forEach((sale) => {
            let saleRevenue = 0;
            let saleProfit = 0;

            sale.items?.forEach((item) => {
                const itemRevenue = Number(item.total_price);
                const itemCost = Number(item.unit_cost || 0) * item.quantity;
                const itemProfit = itemRevenue - itemCost;

                saleRevenue += itemRevenue;
                saleProfit += itemProfit;
                totalItemsSold += item.quantity;

                // Medicine stats
                const existing = medicineStats.get(item.medicine_id) || {
                    name: item.medicine?.name || 'Unknown',
                    quantity: 0,
                    revenue: 0,
                    profit: 0,
                };
                existing.quantity += item.quantity;
                existing.revenue += itemRevenue;
                existing.profit += itemProfit;
                medicineStats.set(item.medicine_id, existing);
            });

            if (saleRevenue === 0) {
                saleRevenue = Number(sale.subtotal || 0);
            }

            totalRevenue += saleRevenue;
            totalProfit += saleProfit;

            // Daily stats
            const date = new Date(sale.created_at).toISOString().split('T')[0];
            const dailyExisting = dailyStats.get(date) || { revenue: 0, profit: 0, count: 0 };
            dailyExisting.revenue += saleRevenue;
            dailyExisting.profit += saleProfit;
            dailyExisting.count += 1;
            dailyStats.set(date, dailyExisting);
        });

        // Add dispense transactions to stats
        dispenseTransactions.forEach((dt) => {
            const revenue = Number(dt.total_amount);
            const cost = Number(dt.unit_cost || 0) * dt.quantity;
            const profit = revenue - cost;

            totalRevenue += revenue;
            totalProfit += profit;
            totalSalesCount += 1;
            totalItemsSold += dt.quantity;

            // Medicine stats for dispense
            const medicineId = dt.medicine_id;
            const existingMed = medicineStats.get(medicineId) || {
                name: dt.medicine?.name || 'Unknown',
                quantity: 0,
                revenue: 0,
                profit: 0,
            };
            existingMed.quantity += dt.quantity;
            existingMed.revenue += revenue;
            existingMed.profit += profit;
            medicineStats.set(medicineId, existingMed);

            // Daily stats for dispense
            const date = new Date(dt.created_at).toISOString().split('T')[0];
            const dailyExisting = dailyStats.get(date) || { revenue: 0, profit: 0, count: 0 };
            dailyExisting.revenue += revenue;
            dailyExisting.profit += profit;
            dailyExisting.count += 1;
            dailyStats.set(date, dailyExisting);
        });

        // Top selling items
        const topSellingItems = Array.from(medicineStats.entries())
            .map(([medicine_id, data]) => ({
                medicine_id,
                medicine_name: data.name,
                quantity_sold: data.quantity,
                revenue: data.revenue,
                profit: data.profit,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Daily sales
        const dailySales = Array.from(dailyStats.entries())
            .map(([date, data]) => ({
                date,
                revenue: data.revenue,
                profit: data.profit,
                sales_count: data.count,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        if (!includeTransactions) {
            return {
                facility_id: facilityId || 0,
                period: { start: startDate.toISOString(), end: endDate.toISOString() },
                total_revenue: totalRevenue,
                total_profit: totalProfit,
                total_sales_count: totalSalesCount,
                total_items_sold: totalItemsSold,
                top_selling_items: topSellingItems,
                daily_sales: dailySales,
                transactions: [],
            };
        }

        // Transaction list (Flattened to Line Items for detailed reporting)
        const transactions: any[] = [];
        sales.forEach((sale) => {
            if (sale.items && sale.items.length > 0) {
                sale.items.forEach((item) => {
                    const itemRevenue = Number(item.total_price);
                    const itemCost = Number(item.unit_cost || 0) * item.quantity;
                    const itemProfit = itemRevenue - itemCost;

                    transactions.push({
                        id: `sale-item-${item.id}`, // Item ID for unique key
                        sale_id: sale.id, // Parent Sale ID
                        transaction_number: sale.sale_number, // Mapped for frontend
                        date: new Date(sale.created_at).toISOString(),
                        patient_name: sale.patient ? `${sale.patient.first_name} ${sale.patient.last_name}` : null,
                        cashier_name: sale.cashier ? `${sale.cashier.first_name} ${sale.cashier.last_name}` : 'Unknown',
                        medicine_name: item.medicine?.name || 'Unknown',
                        quantity: item.quantity,
                        total_amount: itemRevenue, // Line total
                        profit: itemProfit,
                    });
                });
            }
        });

        dispenseTransactions.forEach((dt) => {
            transactions.push({
                id: `dispense-${dt.id}`,
                sale_id: dt.id,
                transaction_number: dt.transaction_number,
                date: new Date(dt.created_at).toISOString(),
                patient_name: dt.patient ? `${dt.patient.first_name} ${dt.patient.last_name}` : null,
                cashier_name: dt.dispensed_by
                    ? `${dt.dispensed_by.first_name} ${dt.dispensed_by.last_name}`
                    : 'Unknown',
                medicine_name: dt.medicine?.name || 'Unknown',
                quantity: dt.quantity,
                total_amount: Number(dt.total_amount),
                profit: Number(dt.total_amount) - Number(dt.unit_cost || 0) * dt.quantity,
            });
        });

        const transactionsTotal = transactions.length;
        const maxTx = this.getSalesSummaryMaxTransactionRows();
        const transactionsOut =
            transactionsTotal > maxTx ? transactions.slice(0, maxTx) : transactions;

        return {
            facility_id: facilityId || 0,
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            total_revenue: totalRevenue,
            total_profit: totalProfit,
            total_sales_count: totalSalesCount,
            total_items_sold: totalItemsSold,
            top_selling_items: topSellingItems,
            daily_sales: dailySales,
            transactions: transactionsOut,
            ...(transactionsTotal > maxTx
                ? { transactions_total: transactionsTotal, transactions_truncated: true }
                : {}),
        };
    }

    async getLowStockReport(facilityId: number | undefined, organizationId?: number): Promise<LowStockReport> {
        this.requireScope(facilityId, organizationId, 'low stock report');

        // Get all medicines with their total stock
        const queryBuilder = this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.stocks', 'stock')
            .where('stock.is_deleted = :isDeleted', { isDeleted: false });
        if (organizationId) {
            queryBuilder.andWhere('stock.organization_id = :organizationId', { organizationId });
        }
        if (facilityId) {
            queryBuilder.andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const medicines = await queryBuilder
            .select([
                'medicine.id',
                'medicine.name',
                'medicine.min_stock_level',
                'medicine.reorder_point',
                'medicine.avg_daily_consumption',
                'SUM(stock.quantity - stock.reserved_quantity) as available_quantity',
            ])
            .groupBy('medicine.id')
            .having('SUM(stock.quantity - stock.reserved_quantity) <= medicine.min_stock_level')
            .orHaving('SUM(stock.quantity - stock.reserved_quantity) <= medicine.reorder_point')
            .getRawMany();

        const items = medicines.map((row) => {
            const currentQty = Number(row.available_quantity) || 0;
            const minLevel = row.medicine_min_stock_level || 0;
            const reorderPoint = row.medicine_reorder_point || 0;
            const avgDailyConsumption = Number(row.medicine_avg_daily_consumption || 0);
            const targetLevel = Math.max(minLevel, reorderPoint);
            const deficitQuantity = Math.max(0, targetLevel - currentQty);
            const daysOfCover = avgDailyConsumption > 0 ? currentQty / avgDailyConsumption : currentQty > 0 ? 999 : 0;

            let status: 'critical' | 'low' | 'warning' = 'warning';
            if (currentQty === 0) status = 'critical';
            else if (currentQty <= minLevel) status = 'critical';
            else if (currentQty <= reorderPoint) status = 'low';

            let recommendedAction = 'Monitor levels and review next scheduled order.';
            if (status === 'critical' && currentQty === 0) {
                recommendedAction = 'Immediate replenishment required: place urgent PO and check transfer options.';
            } else if (status === 'critical') {
                recommendedAction = 'Expedite reorder now and prioritize dispensing control.';
            } else if (status === 'low') {
                recommendedAction = 'Create reorder within 24-48h to restore target stock.';
            }

            return {
                medicine_id: row.medicine_id,
                medicine_name: row.medicine_name,
                current_quantity: currentQty,
                min_stock_level: minLevel,
                reorder_point: reorderPoint,
                avg_daily_consumption: avgDailyConsumption,
                days_of_cover: Math.round(daysOfCover * 10) / 10,
                deficit_quantity: deficitQuantity,
                status,
                recommended_action: recommendedAction,
            };
        });

        return {
            facility_id: facilityId || 0,
            items: items.sort((a, b) => {
                const statusOrder = { critical: 0, low: 1, warning: 2 };
                return statusOrder[a.status] - statusOrder[b.status];
            }),
        };
    }

    async getExpiryReport(
        facilityId: number | undefined,
        days: number = 30,
        organizationId?: number,
    ): Promise<ExpiryReport> {
        this.requireScope(facilityId, organizationId, 'expiry report');

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        const today = new Date();

        const expiringQuery = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.medicine', 'medicine')
            .leftJoin('stocks', 'stock', 'stock.batch_id = batch.id')
            .where('stock.is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('batch.expiry_date <= :expiryDate', { expiryDate })
            .andWhere('batch.expiry_date > :today', { today })
            .andWhere('stock.quantity > 0');
        if (organizationId) {
            expiringQuery.andWhere('stock.organization_id = :organizationId', { organizationId });
        }
        if (facilityId) {
            expiringQuery.andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const expiringBatches = await expiringQuery
            .select([
                'batch.id',
                'batch.batch_number',
                'batch.expiry_date',
                'medicine.id',
                'medicine.name',
                'SUM(stock.quantity) as total_quantity',
            ])
            .groupBy('batch.id, medicine.id')
            .getRawMany();

        // Expired
        const expiredQuery = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.medicine', 'medicine')
            .leftJoin('stocks', 'stock', 'stock.batch_id = batch.id')
            .where('stock.is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('batch.expiry_date < :today', { today })
            .andWhere('stock.quantity > 0');
        if (organizationId) {
            expiredQuery.andWhere('stock.organization_id = :organizationId', { organizationId });
        }
        if (facilityId) {
            expiredQuery.andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const expiredBatches = await expiredQuery
            .select([
                'batch.id',
                'batch.batch_number',
                'batch.expiry_date',
                'medicine.id',
                'medicine.name',
                'SUM(stock.quantity) as total_quantity',
            ])
            .groupBy('batch.id, medicine.id')
            .getRawMany();

        const expiringSoon = expiringBatches.map((row) => {
            const expiryDate = new Date(row.batch_expiry_date);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const riskLevel: 'critical' | 'warning' | 'watch' =
                daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 30 ? 'warning' : 'watch';
            const recommendedAction =
                riskLevel === 'critical'
                    ? 'Prioritize sell-through now or transfer immediately.'
                    : riskLevel === 'warning'
                        ? 'Apply discount/transfer plan before expiry window tightens.'
                        : 'Monitor weekly and prepare rotation plan.';
            return {
                batch_id: row.batch_id,
                batch_number: row.batch_batch_number,
                medicine_name: row.medicine_name,
                expiry_date: expiryDate.toISOString().split('T')[0],
                days_until_expiry: daysUntilExpiry,
                quantity: Number(row.total_quantity),
                risk_level: riskLevel,
                recommended_action: recommendedAction,
            };
        });

        const expired = expiredBatches.map((row) => {
            return {
                batch_id: row.batch_id,
                batch_number: row.batch_batch_number,
                medicine_name: row.medicine_name,
                expiry_date: new Date(row.batch_expiry_date).toISOString().split('T')[0],
                quantity: Number(row.total_quantity),
                risk_level: 'expired' as const,
                recommended_action: 'Stop dispensing and complete disposal/return workflow immediately.',
            };
        });

        return {
            facility_id: facilityId || 0,
            expiring_soon: expiringSoon.sort((a, b) => a.days_until_expiry - b.days_until_expiry),
            expired: expired.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)),
        };
    }

    async getDailyCashReport(facilityId: number, date: Date, organizationId?: number): Promise<DailyCashReport> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all sales for the day
        const sales = await this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.payments', 'payments')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startOfDay AND :endOfDay', { startOfDay, endOfDay })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .andWhere(organizationId ? 'sale.organization_id = :organizationId' : '1=1', { organizationId })
            .getMany();

        const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

        // Group by payment method
        const paymentMethodMap = new Map<string, { amount: number; count: number }>();

        sales.forEach((sale) => {
            sale.payments?.forEach((payment) => {
                const method = payment.method || 'UNKNOWN';
                const existing = paymentMethodMap.get(method) || { amount: 0, count: 0 };
                existing.amount += Number(payment.amount);
                existing.count += 1;
                paymentMethodMap.set(method, existing);
            });
        });

        const byPaymentMethod = Array.from(paymentMethodMap.entries())
            .map(([method, data]) => ({
                method,
                amount: data.amount,
                transaction_count: data.count,
                percentage: totalSales > 0 ? (data.amount / totalSales) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        return {
            facility_id: facilityId,
            date: date.toISOString().split('T')[0],
            total_sales: totalSales,
            by_payment_method: byPaymentMethod,
        };
    }

    async getControlledDrugsRegisterReport(
        facilityId: number,
        startDate: Date,
        endDate: Date,
        organizationId: number,
    ): Promise<ControlledDrugsRegisterReport> {
        // Get all sales of controlled drugs
        const sales = await this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .leftJoinAndSelect('items.batch', 'batch')
            .leftJoinAndSelect('sale.patient', 'patient')
            .leftJoinAndSelect('sale.cashier', 'cashier')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .andWhere('medicine.is_controlled_drug = :isControlled', { isControlled: true })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .orderBy('sale.created_at', 'ASC')
            .getMany();

        let totalQuantity = 0;
        const transactions: any[] = [];

        sales.forEach((sale) => {
            sale.items?.forEach((item) => {
                if (item.medicine?.is_controlled_drug) {
                    totalQuantity += item.quantity;
                    transactions.push({
                        sale_id: sale.id,
                        sale_number: sale.sale_number,
                        date: new Date(sale.created_at).toISOString(),
                        medicine_name: item.medicine.name,
                        drug_schedule: item.medicine.drug_schedule,
                        batch_number: item.batch?.batch_number || 'N/A',
                        quantity: item.quantity,
                        prescription_id: sale.prescription_id ?? null,
                        patient_id_number: sale.patient_id_number ?? null,
                        patient_name: sale.patient ? `${sale.patient.first_name} ${sale.patient.last_name}` : null,
                        cashier_name: sale.cashier ? `${sale.cashier.first_name} ${sale.cashier.last_name}` : 'Unknown',
                    });
                }
            });
        });

        return {
            facility_id: facilityId,
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            total_transactions: transactions.length,
            total_quantity_dispensed: totalQuantity,
            transactions,
        };
    }

    async getStockRegisterReport(
        facilityId: number,
        startDate?: Date,
        endDate?: Date,
        page: number = 1,
        limit: number = 100,
    ): Promise<StockRegisterReport> {
        const result = await this.auditService.getStockMovements(facilityId, startDate, endDate, page, limit);

        return {
            facility_id: facilityId,
            period: startDate && endDate ? { start: startDate.toISOString(), end: endDate.toISOString() } : undefined,
            data: result.data,
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }

    async getPurchaseHistoryReport(
        facilityId: number,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
    ): Promise<PurchaseHistoryReport> {
        const orders = await this.purchaseOrderRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .leftJoinAndSelect('po.items', 'items')
            .where('po.facility_id = :facilityId', { facilityId })
            .andWhere('po.order_date BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere(organizationId ? 'po.organization_id = :organizationId' : '1=1', { organizationId })
            .orderBy('po.order_date', 'DESC')
            .getMany();

        const totalOrders = orders.length;
        const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

        const orderList = orders.map((order) => ({
            order_id: order.id,
            order_number: order.order_number,
            supplier_name: order.supplier?.name || 'Unknown',
            order_date: new Date(order.order_date).toISOString().split('T')[0],
            received_date: order.received_date ? new Date(order.received_date).toISOString().split('T')[0] : null,
            status: order.status,
            total_amount: Number(order.total_amount),
            items_count: order.items?.length || 0,
        }));

        return {
            facility_id: facilityId,
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            total_orders: totalOrders,
            total_amount: totalAmount,
            orders: orderList,
        };
    }

    async getTaxSummary(
        facilityId: number,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
    ): Promise<TaxSummaryReport> {
        const results = await this.saleRepository
            .createQueryBuilder('sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :voided', { voided: 'voided' })
            .andWhere(organizationId ? 'sale.organization_id = :organizationId' : '1=1', { organizationId })
            .select([
                'sale.vat_rate as tax_rate',
                'SUM(sale.subtotal) as taxable_amount',
                'SUM(sale.vat_amount) as tax_amount',
            ])
            .groupBy('sale.vat_rate')
            .getRawMany();

        const totalTaxable = results.reduce((sum, r) => sum + Number(r.taxable_amount || 0), 0);
        const totalVat = results.reduce((sum, r) => sum + Number(r.tax_amount || 0), 0);

        return {
            facility_id: facilityId,
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            total_taxable_amount: totalTaxable,
            total_vat_amount: totalVat,
            tax_details: results.map((r) => ({
                tax_rate: Number(r.tax_rate),
                taxable_amount: Number(r.taxable_amount),
                tax_amount: Number(r.tax_amount),
            })),
        };
    }

    async getCustomerLoyaltyReport(facilityId: number, organizationId?: number): Promise<CustomerLoyaltyReport> {
        // Use raw query for efficient grouping and count
        const statsQuery = this.saleRepository
            .createQueryBuilder('sale')
            .innerJoin('sale.patient', 'patient')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.patient_id IS NOT NULL')
            .select([
                'sale.patient_id as patient_id',
                "CONCAT(patient.first_name, ' ', patient.last_name) as patient_name",
                'SUM(sale.total_amount) as total_spent',
                'COUNT(sale.id) as visit_count',
                'MAX(sale.created_at) as last_visit',
            ])
            .groupBy('sale.patient_id')
            .addGroupBy('patient.first_name')
            .addGroupBy('patient.last_name')
            .orderBy('SUM(sale.total_amount)', 'DESC')
            .limit(20);
        if (organizationId) {
            statsQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }
        const stats = await statsQuery.getRawMany();

        const totalPatientsQuery = this.saleRepository
            .createQueryBuilder('sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.patient_id IS NOT NULL')
            .select('COUNT(DISTINCT sale.patient_id)', 'count');
        if (organizationId) {
            totalPatientsQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }
        const totalPatientsResult = await totalPatientsQuery.getRawOne();

        const repeatCustomersQuery = this.saleRepository
            .createQueryBuilder('sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.patient_id IS NOT NULL')
            .select('sale.patient_id')
            .groupBy('sale.patient_id')
            .having('COUNT(sale.id) > 1');
        if (organizationId) {
            repeatCustomersQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }
        const repeatCustomersResult = await repeatCustomersQuery.getCount();

        return {
            facility_id: facilityId,
            total_patients: Number(totalPatientsResult?.count || 0),
            repeat_customers: repeatCustomersResult,
            top_patients: stats.map((s) => ({
                patient_id: Number(s.patient_id),
                patient_name: s.patient_name,
                total_spent: Number(s.total_spent),
                visit_count: Number(s.visit_count),
                last_visit: s.last_visit,
            })),
        };
    }



    async getEmployeePerformanceReport(
        facilityId: number,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
    ): Promise<EmployeePerformanceReport> {
        // 1. Get stats from Sales
        const saleStatsQuery = this.saleRepository
            .createQueryBuilder('sale')
            .innerJoin('sale.cashier', 'cashier')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :voided', { voided: 'voided' })
            .select([
                'sale.cashier_id as employee_id',
                "CONCAT(cashier.first_name, ' ', cashier.last_name) as employee_name",
                'SUM(sale.total_amount) as total_sales',
                'COUNT(sale.id) as transaction_count',
            ])
            .groupBy('sale.cashier_id')
            .addGroupBy('cashier.first_name')
            .addGroupBy('cashier.last_name');
        if (organizationId) {
            saleStatsQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }
        const saleStats = await saleStatsQuery.getRawMany();

        // 2. Get stats from Dispense Transactions
        const dispenseStatsQuery = this.dispenseRepository
            .createQueryBuilder('dt')
            .innerJoin('dt.dispensed_by', 'user')
            .where('dt.facility_id = :facilityId', { facilityId })
            .andWhere('dt.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .select([
                'dt.dispensed_by_id as employee_id',
                "CONCAT(user.first_name, ' ', user.last_name) as employee_name",
                'SUM(dt.total_amount) as total_sales',
                'COUNT(dt.id) as transaction_count',
            ])
            .groupBy('dt.dispensed_by_id')
            .addGroupBy('user.first_name')
            .addGroupBy('user.last_name');
        if (organizationId) {
            dispenseStatsQuery.andWhere('dt.organization_id = :organizationId', { organizationId });
        }
        const dispenseStats = await dispenseStatsQuery.getRawMany();

        // 3. Merge results
        const performanceMap = new Map<number, any>();

        const merge = (stats: any[]) => {
            stats.forEach((s) => {
                const id = Number(s.employee_id);
                const existing = performanceMap.get(id) || {
                    employee_id: id,
                    employee_name: s.employee_name,
                    total_sales: 0,
                    transaction_count: 0,
                };
                existing.total_sales += Number(s.total_sales || 0);
                existing.transaction_count += Number(s.transaction_count || 0);
                performanceMap.set(id, existing);
            });
        };

        merge(saleStats);
        merge(dispenseStats);

        const performers = Array.from(performanceMap.values())
            .map((p) => ({
                ...p,
                average_transaction_value: p.transaction_count > 0 ? p.total_sales / p.transaction_count : 0,
            }))
            .sort((a, b) => b.total_sales - a.total_sales);

        return {
            facility_id: facilityId,
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            performers,
        };
    }

    async getVendorReturnsReport(facilityId: number, organizationId?: number): Promise<VendorReturnsReport> {
        // Since original logic used CreditNote which might not be directly in ReportingService,
        // we'll implement a simplified version or ensured required entities are available.
        const creditNotesQuery = AppDataSource.getRepository('CreditNote')
            .createQueryBuilder('cn')
            .innerJoinAndSelect('cn.sale', 'sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .orderBy('cn.created_at', 'DESC')
            .limit(50);
        if (organizationId) {
            creditNotesQuery.andWhere('cn.organization_id = :organizationId', { organizationId });
        }
        const creditNotes = await creditNotesQuery.getMany();

        const totalReturned = creditNotes.reduce((sum: number, cn: any) => sum + Number(cn.amount), 0);

        return {
            facility_id: facilityId,
            total_returned_amount: totalReturned,
            return_count: creditNotes.length,
            recent_notes: creditNotes.map((cn: any) => ({
                note_id: cn.id,
                note_number: cn.note_number,
                sale_number: cn.sale.sale_number,
                amount: Number(cn.amount),
                reason: cn.reason,
                created_at: cn.created_at.toISOString(),
            })),
        };
    }

    async getBatchTraceability(
        batchId: number,
        organizationId?: number,
        facilityId?: number,
    ): Promise<BatchTraceabilityReport> {
        const batchQuery = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.medicine', 'medicine')
            .where('batch.id = :batchId', { batchId });
        if (organizationId) {
            batchQuery.andWhere('batch.organization_id = :organizationId', { organizationId });
        }
        if (facilityId) {
            batchQuery.andWhere('batch.facility_id = :facilityId', { facilityId });
        }
        const batch = await batchQuery.getOne();

        if (!batch) {
            throw new Error('Batch not found');
        }

        const transactions = await this.dispenseRepository.find({
            where: {
                batch_id: batchId,
                ...(organizationId ? { organization_id: organizationId } : {}),
                ...(facilityId ? { facility_id: facilityId } : {}),
            },
            relations: ['patient', 'dispensed_by'],
            order: { created_at: 'DESC' },
        });

        const patients: BatchTraceabilityRow[] = transactions.map((t) => ({
            transaction_id: t.id,
            transaction_number: t.transaction_number,
            date: t.created_at.toISOString(),
            patient_id: t.patient_id,
            patient_name: t.patient ? `${t.patient.first_name} ${t.patient.last_name}` : 'Walk-in',
            quantity: t.quantity,
            dispensed_by: t.dispensed_by ? `${t.dispensed_by.first_name} ${t.dispensed_by.last_name}` : 'Unknown',
        }));

        return {
            batch_id: batchId,
            batch_number: batch.batch_number,
            medicine_name: batch.medicine.name,
            expiry_date: batch.expiry_date.toISOString(),
            total_dispensed: patients.reduce((sum, p) => sum + p.quantity, 0),
            patients,
        };
    }

    async getControlledDrugRegister(
        facilityId: number,
        medicineId: number,
        organizationId: number,
    ): Promise<ControlledDrugRegisterReport> {
        const medicine = await this.medicineRepository.findOne({
            where: { id: medicineId, organization_id: organizationId },
        });

        if (!medicine) {
            throw new AppError('Medicine not found', 404);
        }

        const movements = await AppDataSource.getRepository(StockMovement)
            .createQueryBuilder('sm')
            .leftJoinAndSelect('sm.user', 'user')
            .where('sm.facility_id = :facilityId', { facilityId })
            .andWhere('sm.medicine_id = :medicineId', { medicineId })
            .andWhere('sm.organization_id = :organizationId', { organizationId })
            .orderBy('sm.created_at', 'ASC')
            .getMany();

        let runningBalance = 0;
        const registerRows: ControlledDrugRegisterRow[] = movements.map((m) => {
            const qtyIn =
                m.type === StockMovementType.IN ||
                    m.type === StockMovementType.TRANSFER_IN ||
                    (m.type === StockMovementType.ADJUSTMENT && m.quantity > 0)
                    ? Math.abs(m.quantity)
                    : 0;
            const qtyOut =
                m.type === StockMovementType.OUT ||
                    m.type === StockMovementType.TRANSFER_OUT ||
                    (m.type === StockMovementType.ADJUSTMENT && m.quantity < 0)
                    ? Math.abs(m.quantity)
                    : 0;

            runningBalance = m.new_balance;

            return {
                id: m.id,
                date: m.created_at.toISOString(),
                type: m.type,
                reference: m.reference_type ? `${m.reference_type} #${m.reference_id}` : 'Manual Adjustment',
                quantity_in: qtyIn,
                quantity_out: qtyOut,
                balance: runningBalance,
                user_name: m.user ? `${m.user.first_name} ${m.user.last_name}` : 'System',
                notes: m.notes || '',
            };
        });

        return {
            medicine_id: medicineId,
            medicine_name: medicine.name,
            current_balance: runningBalance,
            movements: registerRows.reverse(),
        };
    }

    async getDailySalesReport(
        facilityId: number,
        date: string,
        organizationId?: number,
    ): Promise<{
        summary: {
            total_sales: number;
            total_transactions: number;
            average_sale_value: number;
            total_vat: number;
            total_items_sold: number;
        };
        sales: Sale[];
        payment_methods: Array<{ method: string; amount: number; count: number }>;
        hourly_breakdown: Array<{ hour: number; sales: number; transactions: number }>;
    }> {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const sales = await this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .leftJoinAndSelect('sale.payments', 'payments')
            .leftJoinAndSelect('sale.cashier', 'cashier')
            .leftJoinAndSelect('sale.patient', 'patient')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at >= :startDate', { startDate })
            .andWhere('sale.created_at <= :endDate', { endDate })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' })
            .andWhere(organizationId ? 'sale.organization_id = :organizationId' : '1=1', { organizationId })
            .orderBy('sale.created_at', 'DESC')
            .getMany();

        const totalSales = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
        const totalVat = sales.reduce((sum, s) => sum + Number(s.vat_amount), 0);
        const totalItems = sales.reduce((sum, s) => sum + (s.items?.length || 0), 0);

        const paymentMethodsMap = new Map<string, { amount: number; count: number }>();
        sales.forEach((sale) => {
            sale.payments?.forEach((payment) => {
                const existing = paymentMethodsMap.get(payment.method) || { amount: 0, count: 0 };
                paymentMethodsMap.set(payment.method, {
                    amount: existing.amount + Number(payment.amount),
                    count: existing.count + 1,
                });
            });
        });

        const paymentMethods = Array.from(paymentMethodsMap.entries()).map(([method, data]) => ({
            method,
            amount: data.amount,
            count: data.count,
        }));

        const hourlyMap = new Map<number, { sales: number; transactions: number }>();
        sales.forEach((sale) => {
            const hour = new Date(sale.created_at).getHours();
            const existing = hourlyMap.get(hour) || { sales: 0, transactions: 0 };
            hourlyMap.set(hour, {
                sales: existing.sales + Number(sale.total_amount),
                transactions: existing.transactions + 1,
            });
        });

        const hourlyBreakdown = Array.from(hourlyMap.entries())
            .map(([hour, data]) => ({ hour, ...data }))
            .sort((a, b) => a.hour - b.hour);

        return {
            summary: {
                total_sales: totalSales,
                total_transactions: sales.length,
                average_sale_value: sales.length > 0 ? totalSales / sales.length : 0,
                total_vat: totalVat,
                total_items_sold: totalItems,
            },
            sales,
            payment_methods: paymentMethods,
            hourly_breakdown: hourlyBreakdown,
        };
    }

    async getMonthlySalesReport(
        facilityId: number,
        year: number,
        month: number,
        organizationId?: number,
    ): Promise<{
        summary: {
            total_sales: number;
            total_transactions: number;
            total_profit: number;
            total_vat: number;
        };
        daily_breakdown: Array<{
            date: string;
            sales: number;
            transactions: number;
            profit: number;
        }>;
        top_selling_medicines: Array<{
            medicine_id: number;
            medicine_name: string;
            quantity_sold: number;
            revenue: number;
        }>;
    }> {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // 1. Get Sales
        const sales = await this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' })
            .andWhere(organizationId ? 'sale.organization_id = :organizationId' : '1=1', { organizationId })
            .getMany();

        // 2. Get Dispense Transactions
        const dispenseTransactions = await this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .where('dt.facility_id = :facilityId', { facilityId })
            .andWhere('dt.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere(organizationId ? 'dt.organization_id = :organizationId' : '1=1', { organizationId })
            .getMany();

        const totalSalesCount = sales.length + dispenseTransactions.length;
        const totalSalesRevenue =
            sales.reduce((sum, s) => sum + Number(s.total_amount), 0) +
            dispenseTransactions.reduce((sum, dt) => sum + Number(dt.total_amount), 0);
        const totalVat = sales.reduce((sum, s) => sum + Number(s.vat_amount), 0);

        let totalProfit = 0;
        sales.forEach((sale) => {
            sale.items?.forEach((item) => {
                const revenue = Number(item.unit_price) * item.quantity;
                const cost = Number(item.unit_cost) * item.quantity;
                totalProfit += revenue - cost;
            });
        });

        dispenseTransactions.forEach((dt) => {
            const revenue = Number(dt.total_amount);
            const cost = Number(dt.unit_cost || 0) * dt.quantity;
            totalProfit += revenue - cost;
        });

        const dailyMap = new Map<string, { sales: number; transactions: number; profit: number }>();

        const mergeToDaily = (date: Date, revenue: number, profit: number) => {
            const dateKey = date.toISOString().split('T')[0];
            const existing = dailyMap.get(dateKey) || { sales: 0, transactions: 0, profit: 0 };
            dailyMap.set(dateKey, {
                sales: existing.sales + revenue,
                transactions: existing.transactions + 1,
                profit: existing.profit + profit,
            });
        };

        sales.forEach((sale) => {
            let saleProfit = 0;
            sale.items?.forEach((item) => {
                saleProfit += Number(item.unit_price) * item.quantity - Number(item.unit_cost) * item.quantity;
            });
            mergeToDaily(sale.created_at, Number(sale.total_amount), saleProfit);
        });

        dispenseTransactions.forEach((dt) => {
            const revenue = Number(dt.total_amount);
            const profit = revenue - Number(dt.unit_cost || 0) * dt.quantity;
            mergeToDaily(dt.created_at, revenue, profit);
        });

        const dailyBreakdown = Array.from(dailyMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const medicineMap = new Map<number, { name: string; quantity: number; revenue: number }>();
        sales.forEach((sale) => {
            sale.items?.forEach((item) => {
                const existing = medicineMap.get(item.medicine_id) || {
                    name: item.medicine?.name || 'Unknown',
                    quantity: 0,
                    revenue: 0,
                };
                medicineMap.set(item.medicine_id, {
                    name: existing.name,
                    quantity: existing.quantity + item.quantity,
                    revenue: existing.revenue + Number(item.total_price),
                });
            });
        });

        const topSellingMedicines = Array.from(medicineMap.entries())
            .map(([medicine_id, data]) => ({
                medicine_id,
                medicine_name: data.name,
                quantity_sold: data.quantity,
                revenue: data.revenue,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 20);

        return {
            summary: {
                total_sales: totalSalesRevenue,
                total_transactions: totalSalesCount,
                total_profit: totalProfit,
                total_vat: totalVat,
            },
            daily_breakdown: dailyBreakdown,
            top_selling_medicines: topSellingMedicines,
        };
    }

    async getSalesByMedicine(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<
        Array<{
            medicine_id: number;
            medicine_name: string;
            quantity_sold: number;
            revenue: number;
            cost: number;
            profit: number;
            profit_margin: number;
            transactions: number;
        }>
    > {
        if (!facilityId && !organizationId) {
            throw new Error('facilityId or organizationId is required for sales-by-medicine report');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // 1. Get stats from SaleItems
        const salesByMedicineQuery = this.saleItemRepository
            .createQueryBuilder('item')
            .leftJoin('item.sale', 'sale')
            .leftJoin('item.medicine', 'medicine')
            .where('sale.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' });

        if (facilityId) {
            salesByMedicineQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            salesByMedicineQuery
                .innerJoin('sale.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const saleResults = await salesByMedicineQuery
            .select('item.medicine_id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('SUM(item.quantity)', 'quantity_sold')
            .addSelect('SUM(item.total_price)', 'revenue')
            .addSelect('SUM(item.unit_cost * item.quantity)', 'cost')
            .addSelect('COUNT(DISTINCT sale.id)', 'transactions')
            .groupBy('item.medicine_id')
            .addGroupBy('medicine.name')
            .getRawMany();

        // 2. Get stats from DispenseTransactions
        const dispenseByMedicineQuery = this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoin('dt.medicine', 'medicine')
            .where('dt.created_at BETWEEN :start AND :end', { start, end });

        if (facilityId) {
            dispenseByMedicineQuery.andWhere('dt.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            dispenseByMedicineQuery
                .innerJoin('dt.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const dispenseResults = await dispenseByMedicineQuery
            .select('dt.medicine_id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('SUM(dt.quantity)', 'quantity_sold')
            .addSelect('SUM(dt.total_amount)', 'revenue')
            .addSelect('SUM(dt.unit_cost * dt.quantity)', 'cost')
            .addSelect('COUNT(dt.id)', 'transactions')
            .groupBy('dt.medicine_id')
            .addGroupBy('medicine.name')
            .getRawMany();

        // 3. Merge results
        const medicineMap = new Map<number, any>();

        const merge = (stats: any[]) => {
            stats.forEach((row) => {
                const id = Number(row.medicine_id);
                const existing = medicineMap.get(id) || {
                    medicine_id: id,
                    medicine_name: row.medicine_name,
                    quantity_sold: 0,
                    revenue: 0,
                    cost: 0,
                    transactions: 0,
                };
                existing.quantity_sold += Number(row.quantity_sold || 0);
                existing.revenue += Number(row.revenue || 0);
                existing.cost += Number(row.cost || 0);
                existing.transactions += Number(row.transactions || 0);
                medicineMap.set(id, existing);
            });
        };

        merge(saleResults);
        merge(dispenseResults);

        return Array.from(medicineMap.values())
            .map((item) => {
                const profit = item.revenue - item.cost;
                return {
                    ...item,
                    profit,
                    profit_margin: item.revenue > 0 ? (profit / item.revenue) * 100 : 0,
                };
            })
            .sort((a, b) => b.revenue - a.revenue);
    }

    async getSalesByCategory(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<
        Array<{
            category_id: number;
            category_name: string;
            quantity_sold: number;
            revenue: number;
            profit: number;
        }>
    > {
        if (!facilityId && !organizationId) {
            throw new Error('facilityId or organizationId is required for sales-by-category report');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // 1. Get stats from SaleItems
        const salesByCategoryQuery = this.saleItemRepository
            .createQueryBuilder('item')
            .leftJoin('item.sale', 'sale')
            .leftJoin('item.medicine', 'medicine')
            .leftJoin('medicine.category', 'category')
            .where('sale.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' });

        if (facilityId) {
            salesByCategoryQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            salesByCategoryQuery
                .innerJoin('sale.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const saleResults = await salesByCategoryQuery
            .select('category.id', 'category_id')
            .addSelect('category.name', 'category_name')
            .addSelect('SUM(item.quantity)', 'quantity_sold')
            .addSelect('SUM(item.total_price)', 'revenue')
            .addSelect('SUM(item.total_price - (item.unit_cost * item.quantity))', 'profit')
            .groupBy('category.id')
            .addGroupBy('category.name')
            .getRawMany();

        // 2. Get stats from DispenseTransactions
        const dispenseByCategoryQuery = this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoin('dt.medicine', 'medicine')
            .leftJoin('medicine.category', 'category')
            .where('dt.created_at BETWEEN :start AND :end', { start, end });

        if (facilityId) {
            dispenseByCategoryQuery.andWhere('dt.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            dispenseByCategoryQuery
                .innerJoin('dt.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const dispenseResults = await dispenseByCategoryQuery
            .select('category.id', 'category_id')
            .addSelect('category.name', 'category_name')
            .addSelect('SUM(dt.quantity)', 'quantity_sold')
            .addSelect('SUM(dt.total_amount)', 'revenue')
            .addSelect('SUM(dt.total_amount - (dt.unit_cost * dt.quantity))', 'profit')
            .groupBy('category.id')
            .addGroupBy('category.name')
            .getRawMany();

        // 3. Merge results
        const categoryMap = new Map<number, any>();

        const merge = (stats: any[]) => {
            stats.forEach((row) => {
                const id = Number(row.category_id || 0);
                const existing = categoryMap.get(id) || {
                    category_id: id,
                    category_name: row.category_name || 'Uncategorized',
                    quantity_sold: 0,
                    revenue: 0,
                    profit: 0,
                };
                existing.quantity_sold += Number(row.quantity_sold || 0);
                existing.revenue += Number(row.revenue || 0);
                existing.profit += Number(row.profit || 0);
                categoryMap.set(id, existing);
            });
        };

        merge(saleResults);
        merge(dispenseResults);

        return Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
    }

    async getSalesByCashier(
        facilityId: number,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<
        Array<{
            cashier_id: number;
            cashier_name: string;
            total_sales: number;
            total_transactions: number;
            average_sale_value: number;
        }>
    > {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const result = await this.saleRepository
            .createQueryBuilder('sale')
            .leftJoin('sale.cashier', 'cashier')
            .select('sale.cashier_id', 'cashier_id')
            .addSelect('cashier.first_name', 'first_name')
            .addSelect('cashier.last_name', 'last_name')
            .addSelect('SUM(sale.total_amount)', 'total_sales')
            .addSelect('COUNT(sale.id)', 'total_transactions')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at >= :startDate', { startDate: start })
            .andWhere('sale.created_at <= :endDate', { endDate: end })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' })
            .andWhere(organizationId ? 'sale.organization_id = :organizationId' : '1=1', { organizationId })
            .groupBy('sale.cashier_id')
            .addGroupBy('cashier.first_name')
            .addGroupBy('cashier.last_name')
            .orderBy('total_sales', 'DESC')
            .getRawMany();

        return result.map((row) => ({
            cashier_id: row.cashier_id,
            cashier_name: `${row.first_name} ${row.last_name}`,
            total_sales: Number(row.total_sales),
            total_transactions: Number(row.total_transactions),
            average_sale_value:
                Number(row.total_transactions) > 0 ? Number(row.total_sales) / Number(row.total_transactions) : 0,
        }));
    }

    async getPaymentMethodSummary(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<PaymentBreakdown[]> {
        if (!facilityId && !organizationId) {
            throw new Error('facilityId or organizationId is required for payment-method summary');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const paymentMethodQuery = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoin('sale.payments', 'payment')
            .where('sale.created_at >= :startDate', { startDate: start })
            .andWhere('sale.created_at <= :endDate', { endDate: end })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' });

        if (facilityId) {
            paymentMethodQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            paymentMethodQuery
                .innerJoin('sale.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const result = await paymentMethodQuery
            .select('payment.method', 'payment_method')
            .addSelect('SUM(payment.amount)', 'total_amount')
            .addSelect('COUNT(payment.id)', 'transaction_count')
            .groupBy('payment.method')
            .getRawMany();

        const totalAmount = result.reduce((sum, row) => sum + Number(row.total_amount), 0);

        return result.map((row) => ({
            payment_method: row.payment_method || 'Unknown',
            total_amount: Number(row.total_amount),
            transaction_count: Number(row.transaction_count),
            percentage: totalAmount > 0 ? (Number(row.total_amount) / totalAmount) * 100 : 0,
        }));
    }

    async getInsuranceDashboardSummary(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<InsuranceDashboardSummary> {
        this.requireScope(facilityId, organizationId, 'insurance dashboard summary');

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 30);

        const salesQb = this.saleRepository
            .createQueryBuilder('sale')
            .select('COALESCE(SUM(sale.patient_paid_amount), 0)', 'patient_paid')
            .addSelect('COALESCE(SUM(sale.insurance_expected_amount), 0)', 'ins_expected')
            .where('sale.created_at >= :start', { start })
            .andWhere('sale.created_at <= :end', { end })
            .andWhere('sale.status != :voided', { voided: SaleStatus.VOIDED });

        if (facilityId) {
            salesQb.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            salesQb.innerJoin('sale.facility', 'sf').andWhere('sf.organization_id = :organizationId', {
                organizationId,
            });
        }

        const salesAgg = await salesQb.getRawOne();

        const claimRepo = AppDataSource.getRepository(InsuranceClaim);

        const baseClaimQb = () => {
            const qb = claimRepo
                .createQueryBuilder('claim')
                .innerJoin('claim.sale', 'sale')
                .where('sale.created_at >= :start', { start })
                .andWhere('sale.created_at <= :end', { end })
                .andWhere('sale.status != :voided', { voided: SaleStatus.VOIDED });
            if (facilityId) {
                qb.andWhere('sale.facility_id = :facilityId', { facilityId });
            } else if (organizationId) {
                qb.innerJoin('sale.facility', 'scf').andWhere('scf.organization_id = :organizationId', {
                    organizationId,
                });
            }
            return qb;
        };

        const openStatuses = [
            InsuranceClaimStatus.PENDING,
            InsuranceClaimStatus.SUBMITTED,
            InsuranceClaimStatus.APPROVED,
            InsuranceClaimStatus.PARTIALLY_APPROVED,
        ];

        const openRow = await baseClaimQb()
            .andWhere('claim.status IN (:...openSt)', { openSt: openStatuses })
            .select('COUNT(claim.id)::int', 'cnt')
            .addSelect('COALESCE(SUM(claim.expected_amount), 0)', 'tot')
            .getRawOne();

        const rejectedRow = await baseClaimQb()
            .andWhere('claim.status = :rej', { rej: InsuranceClaimStatus.REJECTED })
            .select('COUNT(claim.id)::int', 'cnt')
            .getRawOne();

        const receivedRow = await baseClaimQb()
            .andWhere('claim.status = :paid', { paid: InsuranceClaimStatus.PAID })
            .select('COALESCE(SUM(claim.actual_received_amount), 0)', 'tot')
            .getRawOne();

        const staleRow = await baseClaimQb()
            .andWhere('claim.status IN (:...pendSt)', {
                pendSt: [InsuranceClaimStatus.PENDING, InsuranceClaimStatus.SUBMITTED],
            })
            .andWhere('claim.created_at < :stale', { stale: staleCutoff })
            .select('COUNT(claim.id)::int', 'cnt')
            .getRawOne();

        const topProviders = await baseClaimQb()
            .innerJoin('claim.provider', 'prov')
            .select('prov.id', 'provider_id')
            .addSelect('prov.name', 'provider_name')
            .addSelect('COUNT(claim.id)::int', 'claims_count')
            .addSelect('COALESCE(SUM(claim.expected_amount), 0)', 'expected_total')
            .groupBy('prov.id')
            .addGroupBy('prov.name')
            .orderBy('expected_total', 'DESC')
            .limit(8)
            .getRawMany();

        return {
            period: { start: startDate, end: endDate },
            open_claims_count: Number(openRow?.cnt ?? 0),
            open_claims_expected_total: Number(openRow?.tot ?? 0),
            rejected_claims_count: Number(rejectedRow?.cnt ?? 0),
            insurance_received_total: Number(receivedRow?.tot ?? 0),
            sales_patient_paid_total: Number(salesAgg?.patient_paid ?? 0),
            sales_insurance_expected_total: Number(salesAgg?.ins_expected ?? 0),
            top_providers: topProviders.map((r) => ({
                provider_id: Number(r.provider_id),
                provider_name: String(r.provider_name),
                claims_count: Number(r.claims_count),
                expected_total: Number(r.expected_total),
            })),
            stale_pending_claims_count: Number(staleRow?.cnt ?? 0),
        };
    }

    async getGrossVsNetSales(
        facilityId: number,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<{
        gross_sales: number;
        total_returns: number;
        net_sales: number;
        return_rate: number;
    }> {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Gross sales (excluding voided)
        const grossResult = await this.saleRepository
            .createQueryBuilder('sale')
            .select('SUM(sale.total_amount)', 'gross_sales')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at >= :startDate', { startDate: start })
            .andWhere('sale.created_at <= :endDate', { endDate: end })
            .andWhere('sale.status != :voidedStatus', { voidedStatus: 'voided' })
            .andWhere(organizationId ? 'sale.organization_id = :organizationId' : '1=1', { organizationId })
            .getRawOne();

        const grossSales = Number(grossResult?.gross_sales || 0);

        // Total returns (completed returns only)
        const returnsResult = await AppDataSource.getRepository('CustomerReturn')
            .createQueryBuilder('return')
            .select('SUM(return.total_refund_amount)', 'total_returns')
            .where('return.facility_id = :facilityId', { facilityId })
            .andWhere('return.created_at >= :startDate', { startDate: start })
            .andWhere('return.created_at <= :endDate', { endDate: end })
            .andWhere('return.status = :completedStatus', { completedStatus: 'completed' })
            .andWhere(organizationId ? 'return.organization_id = :organizationId' : '1=1', { organizationId })
            .getRawOne();

        const totalReturns = Number(returnsResult?.total_returns || 0);
        const netSales = grossSales - totalReturns;
        const returnRate = grossSales > 0 ? (totalReturns / grossSales) * 100 : 0;

        return {
            gross_sales: grossSales,
            total_returns: totalReturns,
            net_sales: netSales,
            return_rate: returnRate,
        };
    }

    // Alias for getSalesSummaryReport to support legacy/dashboard calls
    async getSalesReport(
        facilityId: number | undefined,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
    ): Promise<any> {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const report = await this.getSalesSummaryReport(facilityId, start, end, organizationId, {
            includeTransactions: false,
        });
        return {
            ...report,
            daily_sales: report.daily_sales.map((d) => ({
                ...d,
                sales: d.revenue,
            })),
        };
    }

    async getStockReport(facilityId: number, organizationId?: number): Promise<{
        total_medicines: number;
        low_stock_count: number;
        expiring_batches_count: number;
        total_value: number;
    }> {
        const stockScopeQuery = this.stockRepository
            .createQueryBuilder('stock')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false });

        if (organizationId) {
            stockScopeQuery.andWhere('stock.organization_id = :organizationId', { organizationId });
        }

        const totalMedicinesResult = await stockScopeQuery
            .clone()
            .select('COUNT(DISTINCT stock.medicine_id)', 'count')
            .getRawOne();
        const totalMedicines = Number(totalMedicinesResult?.count || 0);

        // Calculate total inventory value
        const stockItems = await stockScopeQuery.clone().leftJoinAndSelect('stock.batch', 'batch').getMany();

        const totalValue = stockItems.reduce((sum, item) => {
            const quantity = Number(item.quantity) || 0;
            const cost = Number(item.batch?.unit_cost) || 0;
            return sum + quantity * cost;
        }, 0);

        const lowStock = await this.getLowStockReport(facilityId, organizationId);
        const lowStockCount = lowStock.items.length;

        const expiry = await this.getExpiryReport(facilityId, 30, organizationId);
        const expiringBatchesCount = expiry.expiring_soon.length + expiry.expired.length;

        return {
            total_medicines: totalMedicines,
            low_stock_count: lowStockCount,
            expiring_batches_count: expiringBatchesCount,
            total_value: totalValue,
        };
    }

    async getDetailedStockReport(facilityId: number, organizationId?: number): Promise<any[]> {
        const stockQuery = this.stockRepository
            .createQueryBuilder('stock')
            .innerJoinAndSelect('stock.medicine', 'medicine')
            .leftJoinAndSelect('stock.batch', 'batch')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .orderBy('medicine.name', 'ASC');

        if (organizationId) {
            stockQuery.andWhere('stock.organization_id = :organizationId', { organizationId });
        }

        const stockItems = await stockQuery.getMany();

        // Group by medicine
        const medicineMap = new Map<number, any>();

        stockItems.forEach((stock) => {
            const existing = medicineMap.get(stock.medicine_id) || {
                medicine_name: stock.medicine?.name || 'Unknown',
                brand_name: stock.medicine?.brand_name || 'N/A',
                category: stock.medicine?.category?.name || 'Uncategorized',
                current_quantity: 0,
                min_stock_level: stock.medicine?.min_stock_level || 0,
            };
            existing.current_quantity += Number(stock.quantity);
            medicineMap.set(stock.medicine_id, existing);
        });

        return Array.from(medicineMap.values());
    }

    async getTotalSalesAllTime(facilityId?: number, organizationId?: number): Promise<number> {
        const saleQuery = this.saleRepository
            .createQueryBuilder('sale')
            .where('sale.status != :voided', { voided: SaleStatus.VOIDED });

        if (facilityId) {
            saleQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            saleQuery
                .innerJoin('sale.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', { organizationId });
        }

        const saleResult = await saleQuery.select('SUM(sale.total_amount)', 'total').getRawOne();
        const saleTotal = Number(saleResult?.total || 0);

        const dispenseQuery = this.dispenseRepository.createQueryBuilder('dispense');

        if (facilityId) {
            dispenseQuery.where('dispense.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            dispenseQuery
                .innerJoin('dispense.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', { organizationId });
        }

        const dispenseResult = await dispenseQuery.select('SUM(dispense.total_amount)', 'total').getRawOne();
        const dispenseTotal = Number(dispenseResult?.total || 0);

        return saleTotal + dispenseTotal;
    }

    async getInventoryStatus(facilityId: number, organizationId?: number): Promise<any> {
        // Simplified inventory status for dashboard
        const totalValueQuery = this.stockRepository
            .createQueryBuilder('s')
            .innerJoin('s.batch', 'b')
            .where('s.facility_id = :facilityId', { facilityId })
            .andWhere('s.is_deleted = :isDeleted', { isDeleted: false })
            .select('SUM(s.quantity * b.unit_cost)', 'value');

        if (organizationId) {
            totalValueQuery.andWhere('s.organization_id = :organizationId', { organizationId });
        }

        const totalValue = await totalValueQuery.getRawOne();

        return {
            total_value: Number(totalValue?.value || 0),
            status: 'Operational',
        };
    }

    async getConsumptionTrends(
        facilityId: number,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
    ): Promise<any> {
        const trendsQuery = this.saleItemRepository
            .createQueryBuilder('item')
            .innerJoin('item.sale', 'sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .select(["TO_CHAR(sale.created_at, 'YYYY-MM-DD') as date", 'SUM(item.quantity) as quantity'])
            .groupBy('date')
            .orderBy('date', 'ASC');

        if (organizationId) {
            trendsQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }

        const trends = await trendsQuery.getRawMany();

        return trends;
    }

    async getExpiryHeatMap(
        facilityId: number | undefined,
        organizationId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<any> {
        const query = this.batchRepository
            .createQueryBuilder('batch')
            .innerJoin('batch.stocks', 'stock')
            .where('batch.expiry_date BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('stock.quantity > 0');

        query.andWhere('stock.organization_id = :organizationId', { organizationId });
        if (facilityId) {
            query.andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const batches = await query
            .select(["TO_CHAR(batch.expiry_date, 'YYYY-MM-DD') as date", 'COUNT(batch.id) as count'])
            .groupBy('date')
            .getRawMany();

        return batches.map((b) => ({ date: b.date, count: Number(b.count) }));
    }

    async getFEFOCompliance(
        facilityId: number | undefined,
        organizationId: number,
        nearExpiryDays: number = 30,
    ): Promise<any> {
        const lookbackDays =
            Number.isFinite(nearExpiryDays) && nearExpiryDays > 0 ? Math.floor(nearExpiryDays) : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);

        const dispenseQuery = this.dispenseRepository
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .leftJoinAndSelect('dt.batch', 'batch')
            .where('dt.created_at >= :startDate', { startDate })
            .andWhere('dt.organization_id = :organizationId', { organizationId })
            .orderBy('dt.created_at', 'ASC');

        if (facilityId) {
            dispenseQuery.andWhere('dt.facility_id = :facilityId', { facilityId });
        }

        const transactions = await dispenseQuery.getMany();

        let compliantCount = 0;
        const violations: Array<{
            transaction_id: number;
            date: string;
            medicine_name: string;
            batch_used: string;
            batch_expiry: string;
            earlier_batch_available: string;
            earlier_expiry: string;
        }> = [];

        for (const transaction of transactions) {
            if (!transaction.batch?.expiry_date) {
                compliantCount += 1;
                continue;
            }

            const earlierBatchQuery = this.stockRepository
                .createQueryBuilder('stock')
                .leftJoinAndSelect('stock.batch', 'batch')
                .where('stock.organization_id = :organizationId', { organizationId })
                .andWhere('stock.medicine_id = :medicineId', { medicineId: transaction.medicine_id })
                .andWhere('stock.batch_id != :batchId', { batchId: transaction.batch_id })
                .andWhere('stock.quantity > 0')
                .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
                .andWhere('batch.expiry_date < :currentExpiry', { currentExpiry: transaction.batch.expiry_date })
                .andWhere('batch.expiry_date >= :transactionDate', { transactionDate: transaction.created_at })
                .orderBy('batch.expiry_date', 'ASC');

            if (facilityId) {
                earlierBatchQuery.andWhere('stock.facility_id = :facilityId', { facilityId });
            }

            const earlierBatchStock = await earlierBatchQuery.getOne();

            if (!earlierBatchStock?.batch) {
                compliantCount += 1;
                continue;
            }

            violations.push({
                transaction_id: transaction.id,
                date: transaction.created_at.toISOString(),
                medicine_name: transaction.medicine?.name || 'Unknown',
                batch_used: transaction.batch.batch_number,
                batch_expiry: transaction.batch.expiry_date.toISOString(),
                earlier_batch_available: earlierBatchStock.batch.batch_number,
                earlier_expiry: earlierBatchStock.batch.expiry_date.toISOString(),
            });
        }

        const totalTransactions = transactions.length;
        const complianceRate = totalTransactions > 0 ? (compliantCount / totalTransactions) * 100 : 100;

        return {
            compliance_rate: complianceRate,
            total_transactions: totalTransactions,
            compliant_transactions: compliantCount,
            violations: violations.slice(0, 50),
            // Legacy aliases kept for backward compatibility
            rate: complianceRate,
            compliant_count: compliantCount,
            total_count: totalTransactions,
        };
    }

    async getABCAnalysis(facilityId: number | undefined, organizationId: number): Promise<any> {
        const result = await this.getSalesByMedicine(
            facilityId,
            new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            new Date().toISOString(),
            organizationId,
        );

        const sortedItems = [...result].sort((a, b) => b.revenue - a.revenue);
        const totalValue = sortedItems.reduce((sum, r) => sum + r.revenue, 0);
        let cumulativeValue = 0;

        const mappedItems = sortedItems.map((item) => {
            cumulativeValue += item.revenue;
            const cumulativePercentage = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;

            let classification: 'A' | 'B' | 'C' = 'C';
            if (cumulativePercentage <= 80) classification = 'A';
            else if (cumulativePercentage <= 95) classification = 'B';

            return {
                medicine_id: item.medicine_id,
                medicine_name: item.medicine_name,
                consumption_value: item.revenue,
                cumulative_percentage: cumulativePercentage,
                classification,
            };
        });

        const class_a = mappedItems.filter((i) => i.classification === 'A');
        const class_b = mappedItems.filter((i) => i.classification === 'B');
        const class_c = mappedItems.filter((i) => i.classification === 'C');

        const getClassSummary = (items: any[]) => {
            const val = items.reduce((sum, i) => sum + i.consumption_value, 0);
            return {
                itemCount: items.length,
                totalValue: val,
                percentage: totalValue > 0 ? (val / totalValue) * 100 : 0,
            };
        };

        return {
            class_a,
            class_b,
            class_c,
            all_items: mappedItems,
            summary: {
                totalValue,
                classes: {
                    A: getClassSummary(class_a),
                    B: getClassSummary(class_b),
                    C: getClassSummary(class_c),
                },
            },
        };
    }

    async getMultiLocationComparison(organizationId: number, metric: string): Promise<any> {
        const normalizedMetric = (metric || 'inventory_value').toLowerCase();
        const facilities = await AppDataSource.getRepository(Facility).find({
            where: {
                organization_id: organizationId,
                is_active: true,
            },
        });

        if (facilities.length === 0) {
            return { facilities: [] };
        }

        const rangeEnd = new Date();
        const rangeStart = new Date();
        rangeStart.setDate(rangeStart.getDate() - 30);

        const data = await Promise.all(
            facilities.map(async (facility) => {
                let metricValue = 0;

                if (normalizedMetric === 'revenue' || normalizedMetric === 'sales') {
                    const [saleResult, dispenseResult] = await Promise.all([
                        this.saleRepository
                            .createQueryBuilder('sale')
                            .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
                            .where('sale.facility_id = :facilityId', { facilityId: facility.id })
                            .andWhere('sale.created_at BETWEEN :rangeStart AND :rangeEnd', { rangeStart, rangeEnd })
                            .andWhere('sale.status != :voidedStatus', { voidedStatus: SaleStatus.VOIDED })
                            .getRawOne(),
                        this.dispenseRepository
                            .createQueryBuilder('dt')
                            .select('COALESCE(SUM(dt.total_amount), 0)', 'total')
                            .where('dt.facility_id = :facilityId', { facilityId: facility.id })
                            .andWhere('dt.created_at BETWEEN :rangeStart AND :rangeEnd', { rangeStart, rangeEnd })
                            .getRawOne(),
                    ]);

                    metricValue = Number(saleResult?.total || 0) + Number(dispenseResult?.total || 0);
                } else if (normalizedMetric === 'low_stock' || normalizedMetric === 'low_stock_count') {
                    const lowStock = await this.getLowStockReport(facility.id, organizationId);
                    metricValue = lowStock.items.length;
                } else if (normalizedMetric === 'expiry' || normalizedMetric === 'expiry_risk') {
                    const expiry = await this.getExpiryReport(facility.id, 30, organizationId);
                    metricValue = expiry.expiring_soon.length + expiry.expired.length;
                } else {
                    const inventoryValue = await this.stockRepository
                        .createQueryBuilder('stock')
                        .leftJoin('stock.batch', 'batch')
                        .select(
                            'COALESCE(SUM((stock.quantity - stock.reserved_quantity) * COALESCE(stock.unit_cost, batch.unit_cost, 0)), 0)',
                            'value',
                        )
                        .where('stock.facility_id = :facilityId', { facilityId: facility.id })
                        .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
                        .getRawOne();

                    metricValue = Number(inventoryValue?.value || 0);
                }

                return {
                    facility_id: facility.id,
                    facility_name: facility.name,
                    metric_value: Math.round(metricValue * 100) / 100,
                    rank: 0,
                };
            }),
        );

        const ranked = data
            .sort((a, b) => b.metric_value - a.metric_value)
            .map((item, index) => ({
                ...item,
                rank: index + 1,
            }));

        return { facilities: ranked };
    }

    async getOverstockReport(facilityId: number | undefined, organizationId: number): Promise<any> {
        const query = this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin(
                'medicine.stocks',
                'stock',
                'stock.is_deleted = :isDeleted AND stock.organization_id = :organizationId',
                { isDeleted: false, organizationId },
            )
            .leftJoin('stock.batch', 'batch')
            .where('medicine.is_active = :isActive', { isActive: true })
            .andWhere('medicine.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            query.andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const rows = await query
            .select('medicine.id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('medicine.target_stock_level', 'target_stock_level')
            .addSelect('medicine.min_stock_level', 'min_stock_level')
            .addSelect('COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0)', 'current_quantity')
            .addSelect(
                'COALESCE(SUM((stock.quantity - stock.reserved_quantity) * COALESCE(stock.unit_cost, batch.unit_cost, 0)), 0)',
                'stock_value',
            )
            .groupBy('medicine.id')
            .addGroupBy('medicine.name')
            .addGroupBy('medicine.target_stock_level')
            .addGroupBy('medicine.min_stock_level')
            .getRawMany();

        const items = rows
            .map((row) => {
                const currentQuantity = Number(row.current_quantity || 0);
                const minStockLevel = Number(row.min_stock_level || 0);
                const configuredTarget = Number(row.target_stock_level || 0);
                const targetQuantity = configuredTarget > 0 ? configuredTarget : minStockLevel > 0 ? minStockLevel * 2 : 0;

                if (targetQuantity <= 0 || currentQuantity <= targetQuantity) {
                    return null;
                }

                const stockValue = Number(row.stock_value || 0);
                const unitValue = currentQuantity > 0 ? stockValue / currentQuantity : 0;
                const excess = currentQuantity - targetQuantity;

                return {
                    medicine_id: Number(row.medicine_id),
                    medicine_name: row.medicine_name,
                    current_quantity: currentQuantity,
                    target_quantity: targetQuantity,
                    excess,
                    excess_value: Math.round(excess * unitValue * 100) / 100,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.excess_value - a.excess_value);

        return { items };
    }

    async getReorderSuggestions(facilityId: number | undefined, organizationId: number): Promise<any> {
        return this.replenishmentService.getSuggestions(organizationId, facilityId);
    }

    async getTopMedicinesByRevenue(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<any> {
        const meds = await this.getSalesByMedicine(facilityId, startDate, endDate, organizationId);
        return meds.slice(0, 5).map((m) => ({
            medicine_id: m.medicine_id,
            medicine_name: m.medicine_name,
            revenue: m.revenue,
            quantity: m.quantity_sold,
            profit: m.profit,
        }));
    }

    async getCategoryPerformance(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<any> {
        return await this.getSalesByCategory(facilityId, startDate, endDate, organizationId);
    }

    async getExpiryRiskBuckets(facilityId: number | undefined, organizationId?: number): Promise<any> {
        const report = await this.getExpiryReport(facilityId, 90, organizationId);

        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const getBucket = (maxDate: Date) => {
            const batches = report.expiring_soon.filter((b: any) => new Date(b.expiry_date) <= maxDate);
            return {
                count: batches.length,
                value: batches.reduce((sum: number, b: any) => sum + Number(b.unit_cost || 0) * b.quantity, 0),
            };
        };

        return {
            under_30_days: getBucket(thirtyDays),
            under_60_days: getBucket(sixtyDays),
            under_90_days: getBucket(ninetyDays),
        };
    }

    /**
     * Daily value of stock received via goods receipts (PO receiving), by received_date.
     * Aligns with the "Received" series on the owner dashboard consumption chart (same currency as sales).
     */
    private async getDailyGoodsReceiptValueByDate(
        facilityId: number | undefined,
        startDate: Date,
        endDate: Date,
        organizationId?: number,
    ): Promise<Map<string, number>> {
        this.requireScope(facilityId, organizationId, 'goods receipt trend');
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const qb = AppDataSource.getRepository(GoodsReceipt)
            .createQueryBuilder('gr')
            .innerJoin('gr.items', 'gri')
            .select("TO_CHAR(gr.received_date::date, 'YYYY-MM-DD')", 'date')
            .addSelect('COALESCE(SUM(gri.quantity_received * gri.unit_cost), 0)', 'received_value')
            .where('gr.received_date BETWEEN :start AND :end', { start, end })
            .groupBy('gr.received_date::date')
            .orderBy('gr.received_date::date', 'ASC');

        this.applyTenantScope(qb, 'gr', facilityId, organizationId);

        const rows = await qb.getRawMany<{ date: string; received_value: string }>();
        const map = new Map<string, number>();
        for (const row of rows) {
            if (row.date) {
                map.set(row.date, Number(row.received_value || 0));
            }
        }
        return map;
    }

    async getSalesTrends(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<any> {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const report = await this.getSalesReport(facilityId, start, end, organizationId);
        const receivedByDate = await this.getDailyGoodsReceiptValueByDate(
            facilityId,
            start,
            end,
            organizationId,
        );

        const trendMap = new Map<string, Record<string, unknown>>();
        for (const d of report.daily_sales) {
            trendMap.set(d.date, {
                ...d,
                received: receivedByDate.get(d.date) ?? 0,
            });
        }
        for (const [date, received] of receivedByDate) {
            if (!trendMap.has(date)) {
                trendMap.set(date, {
                    date,
                    revenue: 0,
                    profit: 0,
                    sales_count: 0,
                    sales: 0,
                    received,
                });
            }
        }

        return Array.from(trendMap.values()).sort((a, b) =>
            String(a.date).localeCompare(String(b.date)),
        );
    }

    async getInventoryAgingReport(
        facilityId: number,
        organizationId: number,
        asOfDate?: Date,
    ): Promise<InventoryAgingReport> {
        const asOf = asOfDate ? new Date(asOfDate) : new Date();
        asOf.setHours(23, 59, 59, 999);

        const stocks = await this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.medicine', 'medicine')
            .leftJoinAndSelect('stock.batch', 'batch')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('stock.quantity > 0')
            .getMany();

        const buckets: InventoryAgingReport['buckets'] = [
            { bucket: '0-30', quantity: 0, value: 0, item_count: 0 },
            { bucket: '31-60', quantity: 0, value: 0, item_count: 0 },
            { bucket: '61-90', quantity: 0, value: 0, item_count: 0 },
            { bucket: '90+', quantity: 0, value: 0, item_count: 0 },
        ];

        const items: InventoryAgingReport['items'] = stocks.map((stock) => {
            const receivedDate = stock.batch?.created_at || stock.created_at;
            const ageDays = Math.max(
                0,
                Math.floor((asOf.getTime() - new Date(receivedDate).getTime()) / (1000 * 60 * 60 * 24)),
            );

            let bucket: InventoryAgingReport['items'][number]['bucket'] = '90+';
            if (ageDays <= 30) bucket = '0-30';
            else if (ageDays <= 60) bucket = '31-60';
            else if (ageDays <= 90) bucket = '61-90';

            const unitCost = Number(stock.unit_cost ?? stock.batch?.unit_cost ?? 0);
            const inventoryValue = Number(stock.quantity) * unitCost;

            const bucketRef = buckets.find((b) => b.bucket === bucket);
            if (bucketRef) {
                bucketRef.quantity += Number(stock.quantity);
                bucketRef.value += inventoryValue;
                bucketRef.item_count += 1;
            }

            return {
                medicine_id: stock.medicine_id,
                medicine_name: stock.medicine?.name || 'Unknown',
                batch_id: stock.batch_id,
                batch_number: stock.batch?.batch_number || '-',
                quantity: Number(stock.quantity),
                unit_cost: unitCost,
                inventory_value: inventoryValue,
                age_days: ageDays,
                bucket,
            };
        });

        return {
            facility_id: facilityId,
            as_of_date: asOf.toISOString(),
            summary: {
                total_quantity: items.reduce((sum, row) => sum + row.quantity, 0),
                total_value: items.reduce((sum, row) => sum + row.inventory_value, 0),
            },
            buckets,
            items: items.sort((a, b) => b.age_days - a.age_days),
        };
    }

    async getPurchaseVsSalesReport(
        facilityId: number,
        organizationId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<PurchaseVsSalesReport> {
        const purchaseRows = await this.purchaseOrderRepository
            .createQueryBuilder('po')
            .select("TO_CHAR(po.created_at::date, 'YYYY-MM-DD')", 'date')
            .addSelect('SUM(po.total_amount)', 'purchase_amount')
            .where('po.facility_id = :facilityId', { facilityId })
            .andWhere('po.organization_id = :organizationId', { organizationId })
            .andWhere('po.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('po.status NOT IN (:...excludedStatuses)', {
                excludedStatuses: ['draft', 'cancelled'],
            })
            .groupBy('po.created_at::date')
            .orderBy('po.created_at::date', 'ASC')
            .getRawMany();

        const salesRows = await this.saleRepository
            .createQueryBuilder('sale')
            .select("TO_CHAR(sale.created_at::date, 'YYYY-MM-DD')", 'date')
            .addSelect('SUM(sale.total_amount)', 'sales_amount')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :voided', { voided: SaleStatus.VOIDED })
            .groupBy('sale.created_at::date')
            .orderBy('sale.created_at::date', 'ASC')
            .getRawMany();

        const purchaseByDate = new Map<string, number>();
        const salesByDate = new Map<string, number>();

        purchaseRows.forEach((row) => {
            purchaseByDate.set(row.date, Number(row.purchase_amount || 0));
        });
        salesRows.forEach((row) => {
            salesByDate.set(row.date, Number(row.sales_amount || 0));
        });

        const allDates = Array.from(new Set([...purchaseByDate.keys(), ...salesByDate.keys()])).sort();
        const timeline = allDates.map((date) => {
            const purchaseAmount = purchaseByDate.get(date) || 0;
            const salesAmount = salesByDate.get(date) || 0;
            return {
                date,
                purchase_amount: purchaseAmount,
                sales_amount: salesAmount,
                variance_amount: salesAmount - purchaseAmount,
            };
        });

        const totalPurchaseAmount = timeline.reduce((sum, row) => sum + row.purchase_amount, 0);
        const totalSalesAmount = timeline.reduce((sum, row) => sum + row.sales_amount, 0);

        return {
            facility_id: facilityId,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            totals: {
                purchase_amount: totalPurchaseAmount,
                sales_amount: totalSalesAmount,
                variance_amount: totalSalesAmount - totalPurchaseAmount,
                purchase_to_sales_ratio: totalSalesAmount > 0 ? totalPurchaseAmount / totalSalesAmount : 0,
            },
            timeline,
        };
    }

    async getMedicineMarginReport(
        facilityId: number,
        organizationId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<MedicineMarginReport> {
        const rows = await this.saleItemRepository
            .createQueryBuilder('item')
            .innerJoin('item.sale', 'sale')
            .innerJoin('item.medicine', 'medicine')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :voided', { voided: SaleStatus.VOIDED })
            .select('item.medicine_id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('SUM(item.quantity)', 'quantity_sold')
            .addSelect('SUM(item.total_price)', 'revenue')
            .addSelect('SUM(COALESCE(item.unit_cost, 0) * item.quantity)', 'cogs')
            .groupBy('item.medicine_id')
            .addGroupBy('medicine.name')
            .orderBy('SUM(item.total_price)', 'DESC')
            .getRawMany();

        const items = rows.map((row) => {
            const revenue = Number(row.revenue || 0);
            const cogs = Number(row.cogs || 0);
            const profit = revenue - cogs;
            return {
                medicine_id: Number(row.medicine_id),
                medicine_name: row.medicine_name,
                quantity_sold: Number(row.quantity_sold || 0),
                revenue,
                cogs,
                profit,
                profit_margin_percent: revenue > 0 ? (profit / revenue) * 100 : 0,
            };
        });

        const totalRevenue = items.reduce((sum, row) => sum + row.revenue, 0);
        const totalCogs = items.reduce((sum, row) => sum + row.cogs, 0);
        const totalProfit = totalRevenue - totalCogs;

        return {
            facility_id: facilityId,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            summary: {
                total_revenue: totalRevenue,
                total_cogs: totalCogs,
                total_profit: totalProfit,
                average_margin_percent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
            },
            items,
        };
    }

    async getProfitReport(
        facilityId: number,
        organizationId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<{
        revenue: number;
        profit: number;
        profit_margin: number;
    }> {
        const summary = await this.getSalesSummaryReport(facilityId, startDate, endDate, organizationId, {
            includeTransactions: false,
        });
        const revenue = summary.total_revenue;
        const profit = summary.total_profit;
        const profitMargin = revenue > 0 ? profit / revenue : 0;

        return {
            revenue,
            profit,
            profit_margin: profitMargin,
        };
    }

    async getDeadStockReport(facilityId: number, organizationId: number, days: number = 90): Promise<any> {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - days);

        // 1. Get IDs of medicines sold in the last X days
        const soldMedicineRows = await this.saleItemRepository
            .createQueryBuilder('item')
            .innerJoin('item.sale', 'sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.created_at >= :dateThreshold', { dateThreshold })
            .select('DISTINCT item.medicine_id', 'id')
            .getRawMany();

        const soldMedicineIds = soldMedicineRows.map((r) => r.id);

        // 2. Get all medicines with positive stock in facility
        const query = this.stockRepository
            .createQueryBuilder('stock')
            .innerJoinAndSelect('stock.medicine', 'medicine')
            .leftJoinAndSelect('stock.batch', 'batch') // Use leftJoin in case batch is missing (orphaned stock)
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.quantity > 0')
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false }); // Ensure we check is_deleted

        if (soldMedicineIds.length > 0) {
            query.andWhere('medicine.id NOT IN (:...soldIds)', { soldIds: soldMedicineIds });
        }

        const stocks = await query.getMany();

        // Group by medicine
        const deadStockMap = new Map<number, any>();

        stocks.forEach((stock) => {
            const existing = deadStockMap.get(stock.medicine_id) || {
                medicine_id: stock.medicine_id,
                medicine_name: stock.medicine?.name,
                quantity: 0,
                value: 0,
            };
            existing.quantity += Number(stock.quantity);
            // Handle null batch or unit_cost
            const unitCost = Number(stock.batch?.unit_cost || 0);
            existing.value += Number(stock.quantity) * unitCost;
            deadStockMap.set(stock.medicine_id, existing);
        });

        return {
            facility_id: facilityId,
            items: Array.from(deadStockMap.values()).map((item) => ({
                ...item,
                last_sold: `More than ${days} days ago`,
                status: 'Non-moving',
            })),
        };
    }

    async getPurchaseReport(
        facilityId: number,
        organizationId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<PurchaseReport> {
        const orders = await this.purchaseOrderRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .leftJoinAndSelect('po.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .where('po.facility_id = :facilityId', { facilityId })
            .andWhere('po.organization_id = :organizationId', { organizationId })
            .andWhere('po.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .orderBy('po.created_at', 'DESC')
            .getMany();

        const summary = {
            total_amount: 0,
            order_count: orders.length,
            average_order_value: 0,
            by_status: {} as Record<string, number>,
        };

        const supplierMap = new Map<number, { name: string; count: number; total: number }>();
        const itemMap = new Map<number, { name: string; quantity: number; total: number }>();

        orders.forEach((po) => {
            const amount = Number(po.total_amount || 0);
            summary.total_amount += amount;
            summary.by_status[po.status] = (summary.by_status[po.status] || 0) + 1;

            // Supplier aggregation
            const supId = po.supplier_id;
            const supExisting = supplierMap.get(supId) || { name: po.supplier?.name || 'Unknown', count: 0, total: 0 };
            supExisting.count += 1;
            supExisting.total += amount;
            supplierMap.set(supId, supExisting);

            // Item aggregation
            po.items?.forEach((item) => {
                const medId = item.medicine_id;
                const itemExisting = itemMap.get(medId) || {
                    name: item.medicine?.name || 'Unknown',
                    quantity: 0,
                    total: 0,
                };
                itemExisting.quantity += Number(item.quantity_ordered || 0);
                itemExisting.total += Number(item.total_price || 0);
                itemMap.set(medId, itemExisting);
            });
        });

        summary.average_order_value = summary.order_count > 0 ? summary.total_amount / summary.order_count : 0;

        return {
            facility_id: facilityId,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            summary,
            by_supplier: Array.from(supplierMap.entries())
                .map(([supplier_id, data]) => ({
                    supplier_id,
                    supplier_name: data.name,
                    order_count: data.count,
                    total_amount: data.total,
                }))
                .sort((a, b) => b.total_amount - a.total_amount),
            by_item: Array.from(itemMap.entries())
                .map(([medicine_id, data]) => ({
                    medicine_id,
                    medicine_name: data.name,
                    quantity_ordered: data.quantity,
                    total_amount: data.total,
                }))
                .sort((a, b) => b.total_amount - a.total_amount),
            orders: orders.map((po) => ({
                id: po.id,
                order_number: po.order_number,
                supplier_name: po.supplier?.name || 'Unknown',
                date: po.created_at.toISOString(),
                status: po.status,
                total_amount: Number(po.total_amount || 0),
            })),
        };
    }

    /**
     * Diagnostic: compare `batches.current_quantity` to summed `stocks.quantity` for a facility.
     * Helps spot drift if any path updated stock without updating the batch aggregate.
     */
    async getBatchStockReconciliation(
        facilityId: number,
        organizationId?: number,
    ): Promise<{
        facility_id: number;
        organization_id: number | null;
        generated_at: string;
        mismatches: Array<{
            batch_id: number;
            batch_number: string;
            medicine_id: number;
            medicine_name: string;
            batch_current_quantity: number;
            stock_rows_sum: number;
            delta: number;
        }>;
        mismatch_count: number;
    }> {
        this.requireScope(facilityId, organizationId, 'batch vs stock reconciliation');

        const qb = this.stockRepository
            .createQueryBuilder('stock')
            .select('stock.batch_id', 'batch_id')
            .addSelect('SUM(stock.quantity)', 'stock_sum')
            .innerJoin('stock.batch', 'batch')
            .leftJoin('batch.medicine', 'medicine')
            .addSelect('batch.batch_number', 'batch_number')
            .addSelect('batch.medicine_id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('batch.current_quantity', 'batch_qty')
            .where('stock.is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('stock.facility_id = :facilityId', { facilityId })
            .groupBy('stock.batch_id')
            .addGroupBy('batch.batch_number')
            .addGroupBy('batch.medicine_id')
            .addGroupBy('medicine.name')
            .addGroupBy('batch.current_quantity');

        if (organizationId) {
            qb.andWhere('stock.organization_id = :organizationId', { organizationId });
        }

        const rows = await qb.getRawMany();

        const mismatches = rows
            .map((row: any) => {
                const batchQty = Number(row.batch_qty ?? 0);
                const stockSum = Number(row.stock_sum ?? 0);
                return {
                    batch_id: Number(row.batch_id),
                    batch_number: String(row.batch_number ?? ''),
                    medicine_id: Number(row.medicine_id ?? 0),
                    medicine_name: String(row.medicine_name ?? ''),
                    batch_current_quantity: batchQty,
                    stock_rows_sum: stockSum,
                    delta: batchQty - stockSum,
                };
            })
            .filter((r) => Math.abs(r.delta) > 0);

        return {
            facility_id: facilityId,
            organization_id: organizationId ?? null,
            generated_at: new Date().toISOString(),
            mismatches,
            mismatch_count: mismatches.length,
        };
    }

    async getFiscalQueueOperationalReport(facilityId: number, organizationId?: number): Promise<{
        facility_id: number;
        organization_id: number | null;
        generated_at: string;
        queue_summary: {
            pending: number;
            retryable: number;
            processing: number;
            dead_letter: number;
            success: number;
        };
        recent_failures: Array<{
            id: number;
            document_type: string;
            document_id: number | null;
            sale_id: number | null;
            attempt_count: number;
            last_error_code: string | null;
            error_message: string | null;
            last_attempt_at: string | null;
        }>;
    }> {
        this.requireScope(facilityId, organizationId, 'fiscal queue report');

        const summaryRows = await AppDataSource.query<Array<{ status: string; count: string }>>(
            `SELECT status, COUNT(*)::text AS count
             FROM ebm_submission_queue
             GROUP BY status`,
        );

        const failureRows = await AppDataSource.query<
            Array<{
                id: number;
                document_type: string;
                document_id: number | null;
                sale_id: number | null;
                attempt_count: number;
                last_error_code: string | null;
                error_message: string | null;
                last_attempt_at: string | null;
            }>
        >(
            `SELECT id, document_type, document_id, sale_id, attempt_count, last_error_code, error_message,
                    CASE WHEN last_attempt_at IS NULL THEN NULL ELSE to_char(last_attempt_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END AS last_attempt_at
             FROM ebm_submission_queue
             WHERE status IN ('retryable', 'dead_letter')
             ORDER BY updated_at DESC NULLS LAST, created_at DESC
             LIMIT 100`,
        );

        const byStatus: Record<string, number> = Object.fromEntries(
            summaryRows.map((row) => [row.status, Number(row.count)]),
        );

        return {
            facility_id: facilityId,
            organization_id: organizationId ?? null,
            generated_at: new Date().toISOString(),
            queue_summary: {
                pending: byStatus.pending || 0,
                retryable: byStatus.retryable || 0,
                processing: byStatus.processing || 0,
                dead_letter: byStatus.dead_letter || 0,
                success: byStatus.success || 0,
            },
            recent_failures: failureRows,
        };
    }
}
