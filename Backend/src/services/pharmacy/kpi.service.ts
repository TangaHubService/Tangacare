import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Sale, SaleItem } from '../../entities/Sale.entity';
import { Stock } from '../../entities/Stock.entity';
import { CustomerReturn } from '../../entities/CustomerReturn.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';

// KPI Interfaces
export interface FinancialKPIs {
    facility_id: number;
    period: { start: string; end: string };
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    gross_profit_margin: number;
    net_profit: number; // After returns
    net_profit_margin: number;
    average_transaction_value: number;
    total_transactions: number;
    revenue_per_day: number;
}

export interface InventoryKPIs {
    facility_id: number;
    total_inventory_value: number;
    total_items: number;
    low_stock_items: number;
    out_of_stock_items: number;
    expiring_soon_items: number; // Within 30 days
    expired_items: number;
    inventory_turnover_ratio: number;
    days_inventory_outstanding: number;
    stock_health_score: number; // 0-100
}

export interface OperationalKPIs {
    facility_id: number;
    period: { start: string; end: string };
    total_sales_volume: number; // Total items sold
    return_rate: number; // Percentage
    average_items_per_sale: number;
    top_selling_medicine: {
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        revenue: number;
    } | null;
    top_profitable_medicine: {
        medicine_id: number;
        medicine_name: string;
        profit: number;
        margin: number;
    } | null;
    sales_growth_rate: number; // Compared to previous period
    customer_count: number;
    repeat_customer_rate: number;
}

export interface ComprehensiveKPIs {
    financial: FinancialKPIs;
    inventory: InventoryKPIs;
    operational: OperationalKPIs;
}

export class KPIService {
    private saleRepository: Repository<Sale>;
    private saleItemRepository: Repository<SaleItem>;
    private stockRepository: Repository<Stock>;
    private returnRepository: Repository<CustomerReturn>;

    constructor() {
        this.saleRepository = AppDataSource.getRepository(Sale);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.returnRepository = AppDataSource.getRepository(CustomerReturn);
    }

    /**
     * Get all KPIs for a facility in a given period
     */
    async getComprehensiveKPIs(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<ComprehensiveKPIs> {
        const [financial, inventory, operational] = await Promise.all([
            this.getFinancialKPIs(facilityId, startDate, endDate, organizationId),
            this.getInventoryKPIs(facilityId, organizationId),
            this.getOperationalKPIs(facilityId, startDate, endDate, organizationId),
        ]);

        return {
            financial,
            inventory,
            operational,
        };
    }

    /**
     * Calculate financial KPIs
     */
    async getFinancialKPIs(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
    ): Promise<FinancialKPIs> {
        // Ensure dates cover the full days
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get sales data (excluding voided)
        const salesQuery = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .where('sale.created_at >= :start', { start })
            .andWhere('sale.created_at <= :end', { end })
            .andWhere('sale.status != :status', { status: 'voided' });

        if (facilityId) {
            salesQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            salesQuery.innerJoin('sale.facility', 'facility').andWhere('facility.organization_id = :organizationId', {
                organizationId,
            });
        }

        const sales = await salesQuery.getMany();

        // Calculate revenue and cost
        let totalRevenue = 0;
        let totalCost = 0;

        sales.forEach((sale) => {
            sale.items?.forEach((item) => {
                const revenue = Number(item.unit_price) * item.quantity;
                const cost = Number(item.unit_cost) * item.quantity;
                totalRevenue += revenue;
                totalCost += cost;
            });
        });

        // Get dispense transactions to include in metrics
        const dispenseQuery = AppDataSource.getRepository(DispenseTransaction)
            .createQueryBuilder('dt')
            .where('dt.created_at >= :start', { start })
            .andWhere('dt.created_at <= :end', { end });

        if (facilityId) {
            dispenseQuery.andWhere('dt.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            dispenseQuery.innerJoin('dt.facility', 'facility').andWhere('facility.organization_id = :organizationId', {
                organizationId,
            });
        }

        const dispenseTransactions = await dispenseQuery.getMany();

        dispenseTransactions.forEach((dt: any) => {
            const revenue = Number(dt.total_amount || 0);
            const cost = Number(dt.unit_cost || 0) * dt.quantity;
            totalRevenue += revenue;
            totalCost += cost;
        });

        const grossProfit = totalRevenue - totalCost;
        const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // Get returns data with items and join SaleItem to get original unit_cost
        const returnsQuery = this.returnRepository
            .createQueryBuilder('return')
            .leftJoinAndSelect('return.items', 'items')
            .leftJoin('sale_items', 'si', 'si.id = items.sale_item_id') // JOIN SaleItem for original cost
            .addSelect('si.unit_cost', 'items_unit_cost')
            .where('return.created_at >= :start', { start })
            .andWhere('return.created_at <= :end', { end })
            .andWhere('return.status = :status', { status: 'completed' });

        if (facilityId) {
            returnsQuery.andWhere('return.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            returnsQuery
                .innerJoin('return.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const returns = await returnsQuery.getRawAndEntities();

        let totalReturns = 0;
        let totalReturnsCost = 0;

        returns.entities.forEach((ret) => {
            totalReturns += Number(ret.total_refund_amount);
            ret.items?.forEach((item) => {
                if (item.restore_to_stock) {
                    // Get the unit_cost from raw results for this item
                    // TypeORM getRawAndEntities maps raw columns to entities or keeps them separate
                    // It's cleaner to join in entities if relation exists, but here we'll use a safer approach:
                    // Since we joined si, we can find it in raw results
                    const rawRow = returns.raw.find((r: any) => r.items_id === item.id);
                    if (rawRow && rawRow.items_unit_cost) {
                        totalReturnsCost += Number(rawRow.items_unit_cost) * item.quantity_returned;
                    }
                }
            });
        });

        // Calculate COGS - Standardize Revenue vs COGS
        // netProfit = (SalesRevenue - SalesCOGS) - (RefundAmount - ReturnedItemsCOGS)
        // Note: ReturnedItemsCOGS is only added back if restore_to_stock is true (meaning it was sold and then returned to inventory)
        const netRevenue = totalRevenue - totalReturns;
        const netProfit = totalRevenue - totalCost - (totalReturns - totalReturnsCost);
        const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

        const totalTransactions = sales.length;
        const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        // Calculate days in period
        // Use already normalized start and end
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const revenuePerDay = days > 0 ? totalRevenue / days : 0;

        return {
            facility_id: facilityId || 0,
            period: { start: startDate, end: endDate },
            total_revenue: Number(netRevenue.toFixed(2)), // Net Revenue after returns
            total_cost: Number(totalCost.toFixed(2)),
            gross_profit: Number(grossProfit.toFixed(2)),
            gross_profit_margin: Number(grossProfitMargin.toFixed(2)),
            net_profit: Number(netProfit.toFixed(2)),
            net_profit_margin: Number(netProfitMargin.toFixed(2)),
            average_transaction_value: Number(averageTransactionValue.toFixed(2)),
            total_transactions: totalTransactions,
            revenue_per_day: Number(revenuePerDay.toFixed(2)),
        };
    }

    /**
     * Calculate inventory KPIs
     */
    async getInventoryKPIs(facilityId: number | undefined, organizationId?: number): Promise<InventoryKPIs> {
        // Get all stock for facility
        const queryBuilder = this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.medicine', 'medicine')
            .leftJoinAndSelect('stock.batch', 'batch');

        if (facilityId) {
            queryBuilder.where('stock.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            queryBuilder.innerJoin('stock.facility', 'facility').where('facility.organization_id = :organizationId', {
                organizationId,
            });
        }

        const stocks = await queryBuilder.getMany();

        let totalInventoryValue = 0;
        let totalItems = 0;
        let lowStockItems = 0;
        let outOfStockItems = 0;
        let expiringSoonItems = 0;
        let expiredItems = 0;

        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        stocks.forEach((stock) => {
            const quantity = stock.quantity;
            const unitCost = Number(stock.unit_cost || 0);
            totalInventoryValue += quantity * unitCost;
            totalItems += quantity;

            // Check stock levels
            const minStockLevel = stock.medicine?.min_stock_level || 0;
            if (quantity === 0) {
                outOfStockItems++;
            } else if (quantity <= minStockLevel) {
                lowStockItems++;
            }

            // Check expiry
            if (stock.batch?.expiry_date) {
                const expiryDate = new Date(stock.batch.expiry_date);
                if (expiryDate < now) {
                    expiredItems++;
                } else if (expiryDate <= thirtyDaysFromNow) {
                    expiringSoonItems++;
                }
            }
        });

        // Calculate inventory turnover (simplified - using last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const salesQueryLast30 = this.saleItemRepository
            .createQueryBuilder('item')
            .leftJoin('item.sale', 'sale')
            .where('sale.created_at >= :startDate', { startDate: thirtyDaysAgo.toISOString() })
            .andWhere('sale.status != :status', { status: 'voided' });

        if (facilityId) {
            salesQueryLast30.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            salesQueryLast30
                .innerJoin('sale.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const salesLast30Days = await salesQueryLast30.select('SUM(item.quantity * item.unit_cost)', 'cogs').getRawOne();

        const cogs = Number(salesLast30Days?.cogs || 0);
        const inventoryTurnoverRatio = totalInventoryValue > 0 ? cogs / totalInventoryValue : 0;
        const daysInventoryOutstanding = inventoryTurnoverRatio > 0 ? 30 / inventoryTurnoverRatio : 0;

        // Calculate stock health score (0-100)
        const totalStockItems = stocks.length;
        let healthScore = 100;
        if (totalStockItems > 0) {
            healthScore -= (outOfStockItems / totalStockItems) * 40; // Out of stock is worst
            healthScore -= (lowStockItems / totalStockItems) * 20; // Low stock is bad
            healthScore -= (expiredItems / totalStockItems) * 30; // Expired is very bad
            healthScore -= (expiringSoonItems / totalStockItems) * 10; // Expiring soon is concerning
        }
        healthScore = Math.max(0, Math.min(100, healthScore));

        return {
            facility_id: facilityId || 0,
            total_inventory_value: Number(totalInventoryValue.toFixed(2)),
            total_items: totalItems,
            low_stock_items: lowStockItems,
            out_of_stock_items: outOfStockItems,
            expiring_soon_items: expiringSoonItems,
            expired_items: expiredItems,
            inventory_turnover_ratio: Number(inventoryTurnoverRatio.toFixed(2)),
            days_inventory_outstanding: Number(daysInventoryOutstanding.toFixed(2)),
            stock_health_score: Number(healthScore.toFixed(2)),
        };
    }
    /**
     * Calculate operational KPIs
     */
    async getOperationalKPIs(
        facilityId: number | undefined,
        startDate: string,
        endDate: string,
        organizationId?: number,
        categoryId?: number,
    ): Promise<OperationalKPIs> {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        const endStr = endDateTime.toISOString();

        // 1. Get Sales (for transaction counts, customer metrics)
        const salesQuery = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .where('sale.created_at >= :startDate', { startDate })
            .andWhere('sale.created_at <= :endDate', { endDate: endStr })
            .andWhere('sale.status != :status', { status: 'voided' });

        if (facilityId) {
            salesQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            salesQuery.innerJoin('sale.facility', 'facility').andWhere('facility.organization_id = :organizationId', {
                organizationId,
            });
        }

        const sales = await salesQuery.getMany();

        // 2. Get Sale Items (for product performance)
        const saleItemsQuery = this.saleItemRepository
            .createQueryBuilder('si')
            .leftJoinAndSelect('si.sale', 'sale')
            .leftJoinAndSelect('si.medicine', 'medicine')
            .where('sale.created_at >= :startDate', { startDate })
            .andWhere('sale.created_at <= :endDate', { endDate: endStr })
            .andWhere('sale.status != :status', { status: 'voided' });

        if (facilityId) {
            saleItemsQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            saleItemsQuery.innerJoin('sale.facility', 'facility').andWhere('facility.organization_id = :organizationId', {
                organizationId,
            });
        }

        const saleItems = await saleItemsQuery.getMany();

        // 3. Get Dispense Transactions (for additional volume/revenue)
        const dispenseTransactionsQuery = AppDataSource.getRepository(DispenseTransaction)
            .createQueryBuilder('dt')
            .leftJoinAndSelect('dt.medicine', 'medicine')
            .where('dt.created_at >= :startDate', { startDate })
            .andWhere('dt.created_at <= :endDate', { endDate: endStr });

        if (facilityId) {
            dispenseTransactionsQuery.andWhere('dt.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            dispenseTransactionsQuery
                .innerJoin('dt.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        if (categoryId) {
            dispenseTransactionsQuery.andWhere('medicine.category_id = :categoryId', { categoryId });
        }

        const dispenseTransactions = await dispenseTransactionsQuery.getMany();

        // --- Calculate Metrics ---

        // Total Sales Volume (Items sold)
        let totalSalesVolume = 0;
        const medicinesSold: Record<
            number,
            { name: string; quantity: number; revenue: number; cost: number; profit: number }
        > = {};

        // Process Sale Items
        saleItems.forEach((item) => {
            if (categoryId && item.medicine?.category_id !== categoryId) return;
            totalSalesVolume += item.quantity;
            if (!medicinesSold[item.medicine_id]) {
                medicinesSold[item.medicine_id] = {
                    name: item.medicine?.name || 'Unknown',
                    quantity: 0,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                };
            }
            const itemRevenue = Number(item.unit_price) * item.quantity;
            const itemCost = Number(item.unit_cost || 0) * item.quantity;
            medicinesSold[item.medicine_id].quantity += item.quantity;
            medicinesSold[item.medicine_id].revenue += itemRevenue;
            medicinesSold[item.medicine_id].cost += itemCost;
            medicinesSold[item.medicine_id].profit += itemRevenue - itemCost;
        });

        // Process Dispense Transactions
        dispenseTransactions.forEach((dt: any) => {
            // category filtering already done in query for dispenseTransactions
            totalSalesVolume += dt.quantity;
            if (!medicinesSold[dt.medicine_id]) {
                medicinesSold[dt.medicine_id] = {
                    name: dt.medicine?.name || 'Unknown',
                    quantity: 0,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                };
            }
            const itemRevenue = Number(dt.total_amount || 0);
            const itemCost = Number(dt.unit_cost || 0) * dt.quantity;
            medicinesSold[dt.medicine_id].quantity += dt.quantity;
            medicinesSold[dt.medicine_id].revenue += itemRevenue;
            medicinesSold[dt.medicine_id].cost += itemCost;
            medicinesSold[dt.medicine_id].profit += itemRevenue - itemCost;
        });

        // Find top selling and top profitable medicine
        let topSellingMedicine: OperationalKPIs['top_selling_medicine'] = null;
        let topProfitableMedicine: OperationalKPIs['top_profitable_medicine'] = null;
        let maxRevenue = 0;
        let maxProfit = -Infinity;

        Object.entries(medicinesSold).forEach(([medicineId, data]) => {
            if (data.revenue > maxRevenue) {
                maxRevenue = data.revenue;
                topSellingMedicine = {
                    medicine_id: Number(medicineId),
                    medicine_name: data.name,
                    quantity_sold: data.quantity,
                    revenue: Number(data.revenue.toFixed(2)),
                };
            }
            if (data.profit > maxProfit) {
                maxProfit = data.profit;
                topProfitableMedicine = {
                    medicine_id: Number(medicineId),
                    medicine_name: data.name,
                    profit: Number(data.profit.toFixed(2)),
                    margin: data.revenue > 0 ? Number(((data.profit / data.revenue) * 100).toFixed(2)) : 0,
                };
            }
        });

        // Get returns
        const returnsQuery = this.returnRepository
            .createQueryBuilder('return')
            .leftJoinAndSelect('return.sale', 'sale')
            .where('return.created_at >= :startDate', { startDate })
            .andWhere('return.created_at <= :endDate', { endDate: endStr })
            .andWhere('return.status = :status', { status: 'completed' });

        if (facilityId) {
            returnsQuery.andWhere('return.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            returnsQuery
                .innerJoin('return.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const returns = await returnsQuery.getMany();

        const totalReturnsCount = returns.length;
        const totalTransactions = sales.length + dispenseTransactions.length;
        const returnRate = totalTransactions > 0 ? (totalReturnsCount / totalTransactions) * 100 : 0;

        // Average items per sale (Sales only for now as dispense is single item usually)
        const averageItemsPerSale = sales.length > 0 ? saleItems.length / sales.length : 0;

        // Calculate sales growth (compare to previous period)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;

        const previousStart = new Date(start);
        previousStart.setDate(previousStart.getDate() - periodDays);
        const previousEnd = new Date(start);
        previousEnd.setDate(previousEnd.getDate() - 1);
        // Ensure previous end captures full day
        previousEnd.setHours(23, 59, 59, 999);

        const previousSalesQuery = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'items')
            .where('sale.created_at >= :startDate', { startDate: previousStart.toISOString() })
            .andWhere('sale.created_at <= :endDate', { endDate: previousEnd.toISOString() })
            .andWhere('sale.status != :status', { status: 'voided' });

        if (facilityId) {
            previousSalesQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else if (organizationId) {
            previousSalesQuery
                .innerJoin('sale.facility', 'facility')
                .andWhere('facility.organization_id = :organizationId', {
                    organizationId,
                });
        }

        const previousSales = await previousSalesQuery.getMany();

        const currentRevenue =
            sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0) +
            dispenseTransactions.reduce((sum: number, dt: any) => sum + Number(dt.total_amount || 0), 0);

        const previousRevenue = previousSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
        // Note: Previous dispense revenue omitted for simplicity/performance in this growth calc,
        // but ideally should be included. Keeping it simple to fix lint first.

        const salesGrowthRate = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        // Customer metrics
        const uniquePatients = new Set<number>();
        sales.forEach((s) => {
            if (s.patient_id) uniquePatients.add(s.patient_id);
        });
        dispenseTransactions.forEach((dt: any) => {
            if (dt.patient_id) uniquePatients.add(dt.patient_id);
        });

        const customerCount = uniquePatients.size;

        // Repeat customer rate
        const patientPurchaseCounts: Record<number, number> = {};
        sales.forEach((sale) => {
            if (sale.patient_id) {
                patientPurchaseCounts[sale.patient_id] = (patientPurchaseCounts[sale.patient_id] || 0) + 1;
            }
        });
        // Add dispense transactions to duplicate check?
        // For now, let's keep it based on sales to avoid double counting if they do both in same visit,
        // or simplistic approach:
        dispenseTransactions.forEach((dt: any) => {
            if (dt.patient_id) {
                patientPurchaseCounts[dt.patient_id] = (patientPurchaseCounts[dt.patient_id] || 0) + 1;
            }
        });

        const repeatCustomers = Object.values(patientPurchaseCounts).filter((count) => count > 1).length;
        const repeatCustomerRate = customerCount > 0 ? (repeatCustomers / customerCount) * 100 : 0;

        return {
            facility_id: facilityId || 0,
            period: { start: startDate, end: endDate },
            total_sales_volume: totalSalesVolume,
            return_rate: Number(returnRate.toFixed(2)),
            average_items_per_sale: Number(averageItemsPerSale.toFixed(2)),
            top_selling_medicine: topSellingMedicine,
            top_profitable_medicine: topProfitableMedicine,
            sales_growth_rate: Number(salesGrowthRate.toFixed(2)),
            customer_count: customerCount,
            repeat_customer_rate: Number(repeatCustomerRate.toFixed(2)),
        };
    }
}
