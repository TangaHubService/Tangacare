import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Sale, SaleItem, SaleStatus } from '../../entities/Sale.entity';
import { Stock } from '../../entities/Stock.entity';
import { Batch } from '../../entities/Batch.entity';
import { CustomerReturn } from '../../entities/CustomerReturn.entity';
import { Alert } from '../../entities/Alert.entity';

export interface DashboardSummary {
    facility_id: number;
    period: { start: string; end: string };

    // Financial KPIs
    total_revenue: number;
    total_profit: number;
    gross_profit_margin: number;
    average_transaction_value: number;
    total_transactions: number;

    // Inventory KPIs
    total_inventory_value: number;
    total_medicines: number;
    low_stock_count: number;
    out_of_stock_count: number;
    expiring_soon_count: number;
    expired_count: number;

    // Operational KPIs
    total_sales_volume: number;
    return_rate: number;
    top_selling_medicine: {
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        revenue: number;
    } | null;

    // Alerts
    critical_alerts_count: number;
    pending_alerts_count: number;

    // Trends (last 7 days)
    sales_trend: Array<{
        date: string;
        revenue: number;
        transactions: number;
    }>;
}

export class DashboardService {
    private saleRepository: Repository<Sale>;
    private saleItemRepository: Repository<SaleItem>;
    private stockRepository: Repository<Stock>;
    private batchRepository: Repository<Batch>;
    private returnRepository: Repository<CustomerReturn>;
    private alertRepository: Repository<Alert>;

    constructor() {
        this.saleRepository = AppDataSource.getRepository(Sale);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.batchRepository = AppDataSource.getRepository(Batch);
        this.returnRepository = AppDataSource.getRepository(CustomerReturn);
        this.alertRepository = AppDataSource.getRepository(Alert);
    }

    async getDashboardSummary(facilityId: number, startDate: Date, endDate: Date): Promise<DashboardSummary> {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);

        // Run all queries in parallel for performance
        const [financialData, inventoryData, operationalData, alertsData, trendsData] = await Promise.all([
            this.getFinancialKPIs(facilityId, startDate, endDateTime),
            this.getInventoryKPIs(facilityId),
            this.getOperationalKPIs(facilityId, startDate, endDateTime),
            this.getAlertsKPIs(facilityId),
            this.getSalesTrends(facilityId, 7),
        ]);

        return {
            facility_id: facilityId,
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            ...financialData,
            ...inventoryData,
            ...operationalData,
            ...alertsData,
            sales_trend: trendsData,
        };
    }

    // ========================================================================
    // FINANCIAL KPIs
    // ========================================================================

    private async getFinancialKPIs(facilityId: number, startDate: Date, endDate: Date) {
        // 1. Get Sales
        const sales = await this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .getMany();

        // 2. Get Dispense Transactions
        const dispenseTransactions = await AppDataSource.getRepository('DispenseTransaction')
            .createQueryBuilder('dt')
            .where('dt.facility_id = :facilityId', { facilityId })
            .andWhere('dt.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getMany();

        let totalRevenue = 0;
        let totalCost = 0;
        let totalTransactions = sales.length + dispenseTransactions.length;

        sales.forEach((sale) => {
            let saleRevenue = 0;

            sale.items?.forEach((item) => {
                saleRevenue += Number(item.total_price || 0);
                const itemCost = Number(item.unit_cost || 0) * item.quantity;
                totalCost += itemCost;
            });

            if (saleRevenue === 0) {
                saleRevenue = Number(sale.subtotal || 0);
            }

            totalRevenue += saleRevenue;
        });

        dispenseTransactions.forEach((dt: any) => {
            const revenue = Number(dt.total_amount || 0);
            const cost = Number(dt.unit_cost || 0) * dt.quantity;
            totalRevenue += revenue;
            totalCost += cost;
        });

        const totalProfit = totalRevenue - totalCost;
        const grossProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        return {
            total_revenue: totalRevenue,
            total_profit: totalProfit,
            gross_profit_margin: grossProfitMargin,
            average_transaction_value: averageTransactionValue,
            total_transactions: totalTransactions,
        };
    }

    private async getInventoryKPIs(facilityId: number) {
        // Get all stocks
        const stocks = await this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.medicine', 'medicine')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .getMany();

        const totalInventoryValue = stocks.reduce((sum, s) => sum + s.quantity * (s.unit_cost || 0), 0);
        const totalMedicines = new Set(stocks.map((s) => s.medicine_id)).size;

        // Low stock and out of stock
        const medicineStockMap = new Map<number, { quantity: number; minLevel: number }>();
        stocks.forEach((stock) => {
            const existing = medicineStockMap.get(stock.medicine_id) || {
                quantity: 0,
                minLevel: stock.medicine?.min_stock_level || 0,
            };
            existing.quantity += stock.quantity - stock.reserved_quantity;
            medicineStockMap.set(stock.medicine_id, existing);
        });

        let lowStockCount = 0;
        let outOfStockCount = 0;
        medicineStockMap.forEach((data) => {
            if (data.quantity === 0) {
                outOfStockCount++;
            } else if (data.quantity <= data.minLevel) {
                lowStockCount++;
            }
        });

        // Expiring and expired batches
        const today = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const [expiringSoon, expired] = await Promise.all([
            this.batchRepository
                .createQueryBuilder('batch')
                .leftJoin('stocks', 'stock', 'stock.batch_id = batch.id')
                .where('stock.facility_id = :facilityId', { facilityId })
                .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
                .andWhere('batch.expiry_date <= :expiryDate', { expiryDate })
                .andWhere('batch.expiry_date > :today', { today })
                .andWhere('stock.quantity > 0')
                .getCount(),
            this.batchRepository
                .createQueryBuilder('batch')
                .leftJoin('stocks', 'stock', 'stock.batch_id = batch.id')
                .where('stock.facility_id = :facilityId', { facilityId })
                .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
                .andWhere('batch.expiry_date < :today', { today })
                .andWhere('stock.quantity > 0')
                .getCount(),
        ]);

        return {
            total_inventory_value: totalInventoryValue,
            total_medicines: totalMedicines,
            low_stock_count: lowStockCount,
            out_of_stock_count: outOfStockCount,
            expiring_soon_count: expiringSoon,
            expired_count: expired,
        };
    }

    private async getOperationalKPIs(facilityId: number, startDate: Date, endDate: Date) {
        // Get sales items
        const saleItems = await this.saleItemRepository
            .createQueryBuilder('si')
            .leftJoinAndSelect('si.sale', 'sale')
            .leftJoinAndSelect('si.medicine', 'medicine')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .getMany();

        // Get dispense transactions
        const dispenseTransactions = await AppDataSource.getRepository('DispenseTransaction')
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .where('dt.facility_id = :facilityId', { facilityId })
            .andWhere('dt.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getMany();

        const totalSalesVolume =
            saleItems.reduce((sum, item) => sum + item.quantity, 0) +
            dispenseTransactions.reduce((sum: number, dt: any) => sum + dt.quantity, 0);

        // Get returns
        const returns = await this.returnRepository
            .createQueryBuilder('return')
            .leftJoinAndSelect('return.sale', 'sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('return.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getMany();

        const totalReturns = returns.reduce((sum, ret) => sum + Number(ret.total_refund_amount), 0);
        const totalSalesRevenue =
            saleItems.reduce((sum, item) => sum + Number(item.total_price), 0) +
            dispenseTransactions.reduce((sum: number, dt: any) => sum + Number(dt.total_amount), 0);

        const returnRate = totalSalesRevenue > 0 ? (totalReturns / totalSalesRevenue) * 100 : 0;

        // Top selling medicine (combine sales and dispense)
        const medicineMap = new Map<number, { name: string; quantity: number; revenue: number }>();

        saleItems.forEach((item) => {
            const existing = medicineMap.get(item.medicine_id) || {
                name: item.medicine?.name || 'Unknown',
                quantity: 0,
                revenue: 0,
            };
            existing.quantity += item.quantity;
            existing.revenue += Number(item.total_price);
            medicineMap.set(item.medicine_id, existing);
        });

        dispenseTransactions.forEach((dt: any) => {
            const existing = medicineMap.get(dt.medicine_id) || {
                name: dt.medicine?.name || 'Unknown',
                quantity: 0,
                revenue: 0,
            };
            existing.quantity += dt.quantity;
            existing.revenue += Number(dt.total_amount);
            medicineMap.set(dt.medicine_id, existing);
        });

        const topSelling =
            Array.from(medicineMap.entries())
                .map(([medicine_id, data]) => ({
                    medicine_id,
                    medicine_name: data.name,
                    quantity_sold: data.quantity,
                    revenue: data.revenue,
                }))
                .sort((a, b) => b.revenue - a.revenue)[0] || null;

        return {
            total_sales_volume: totalSalesVolume,
            return_rate: returnRate,
            top_selling_medicine: topSelling,
        };
    }

    private async getAlertsKPIs(facilityId: number) {
        const [criticalAlerts, pendingAlerts] = await Promise.all([
            this.alertRepository
                .createQueryBuilder('alert')
                .where('alert.facility_id = :facilityId', { facilityId })
                .andWhere('alert.severity = :severity', { severity: 'critical' })
                .andWhere('alert.status = :status', { status: 'active' })
                .getCount(),
            this.alertRepository
                .createQueryBuilder('alert')
                .where('alert.facility_id = :facilityId', { facilityId })
                .andWhere('alert.status = :status', { status: 'active' })
                .getCount(),
        ]);

        return {
            critical_alerts_count: criticalAlerts,
            pending_alerts_count: pendingAlerts,
        };
    }

    async getSalesTrends(facilityId: number, days: number = 7) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // 1. Get Sales
        const sales = await this.saleRepository
            .createQueryBuilder('sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :status', { status: SaleStatus.VOIDED })
            .getMany();

        // 2. Get Dispense Transactions
        const dispenseTransactions = await AppDataSource.getRepository('DispenseTransaction')
            .createQueryBuilder('dt')
            .where('dt.facility_id = :facilityId', { facilityId })
            .andWhere('dt.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getMany();

        const dailyMap = new Map<string, { revenue: number; count: number }>();

        const mergeToDaily = (date: Date, revenue: number) => {
            const dateKey = date.toISOString().split('T')[0];
            const existing = dailyMap.get(dateKey) || { revenue: 0, count: 0 };
            existing.revenue += revenue;
            existing.count += 1;
            dailyMap.set(dateKey, existing);
        };

        sales.forEach((sale) => {
            mergeToDaily(new Date(sale.created_at), Number(sale.total_amount));
        });

        dispenseTransactions.forEach((dt: any) => {
            mergeToDaily(new Date(dt.created_at), Number(dt.total_amount));
        });

        // Fill in missing days with zero values
        const trends = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const data = dailyMap.get(dateStr) || { revenue: 0, count: 0 };
            trends.push({
                date: dateStr,
                revenue: data.revenue,
                transactions: data.count,
            });
        }

        return trends;
    }
}
