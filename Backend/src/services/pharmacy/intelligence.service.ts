import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Facility } from '../../entities/Facility.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { ParReplenishmentTask, ParReplenishmentTaskStatus } from '../../entities/ParLevel.entity';
import { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItem } from '../../entities/PurchaseOrder.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { SaleItem, SaleStatus } from '../../entities/Sale.entity';
import { Stock } from '../../entities/Stock.entity';

type DemandHistory = Map<number, Map<string, number>>;

export type VelocitySegment = 'fast' | 'medium' | 'slow' | 'dead';
export type ExpiryActionType = 'markdown' | 'transfer' | 'vendor_return' | 'disposal' | 'monitor';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface VelocitySegmentationItem {
    medicine_id: number;
    medicine_name: string;
    segment: VelocitySegment;
    total_demand: number;
    daily_velocity: number;
    current_stock: number;
    days_of_cover: number;
    suggested_action: string;
}

export interface SupplierIntelligenceItem {
    supplier_id: number;
    supplier_name: string;
    total_orders: number;
    completed_orders: number;
    otif_rate: number;
    fill_rate: number;
    average_lead_time_days: number;
    lead_time_variance_days: number;
    short_fill_rate: number;
    price_volatility_percent: number;
    variance_attribution: {
        delay_impact_percent: number;
        fill_impact_percent: number;
        price_impact_percent: number;
    };
    monthly_fill_rate_trend: Array<{
        month: string;
        fill_rate: number;
    }>;
}

export interface NearExpiryActionItem {
    stock_id: number;
    medicine_id: number;
    medicine_name: string;
    batch_id: number;
    batch_number: string;
    department_id: number | null;
    quantity: number;
    unit_cost: number;
    days_to_expiry: number;
    projected_waste_qty: number;
    risk_value: number;
    risk_level: RiskLevel;
    recommended_action: ExpiryActionType;
    action_reason: string;
}

export interface DemandForecastItem {
    medicine_id: number;
    medicine_name: string;
    current_stock: number;
    historical_daily_average: number;
    forecast_total: number;
    forecast_daily: Array<{ date: string; quantity: number }>;
    trend_direction: 'up' | 'down' | 'stable';
    seasonality_profile: Array<{ weekday: number; factor: number }>;
    peak_weekday: number;
    trough_weekday: number;
    confidence_score: number;
    mape_estimate: number | null;
}

export interface SmartReorderItem {
    medicine_id: number;
    medicine_name: string;
    current_stock: number;
    at_risk_expiry_qty: number;
    usable_stock: number;
    forecast_horizon_demand: number;
    safety_stock: number;
    target_stock: number;
    recommended_order_qty: number;
    lead_time_days: number;
    days_of_cover: number;
    projected_stockout_date: string | null;
    jit_reorder_by_date: string | null;
    supplier_reliability_score: number;
    priority: RiskLevel;
    reason: string;
}

export interface PredictiveExpiryRiskItem {
    stock_id: number;
    medicine_id: number;
    medicine_name: string;
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    projected_consumption_before_expiry: number;
    projected_waste_qty: number;
    projected_waste_value: number;
    days_to_expiry: number;
    risk_level: RiskLevel;
}

export interface MultiBranchTransferSuggestion {
    medicine_id: number;
    medicine_name: string;
    from_facility_id: number;
    from_facility_name: string;
    to_facility_id: number;
    to_facility_name: string;
    suggested_transfer_qty: number;
    donor_days_cover: number;
    receiver_days_cover: number;
    estimated_stockout_days_prevented: number;
    rationale: string;
}

function avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = avg(values);
    const variance = avg(values.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance);
}

function toDateKey(value: Date): string {
    return value.toISOString().split('T')[0];
}

export class IntelligenceService {
    private medicineRepository: Repository<Medicine>;
    private stockRepository: Repository<Stock>;
    private saleItemRepository: Repository<SaleItem>;
    private dispenseRepository: Repository<DispenseTransaction>;
    private purchaseOrderRepository: Repository<PurchaseOrder>;
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>;
    private facilityRepository: Repository<Facility>;
    private parTaskRepository: Repository<ParReplenishmentTask>;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
        this.purchaseOrderRepository = AppDataSource.getRepository(PurchaseOrder);
        this.purchaseOrderItemRepository = AppDataSource.getRepository(PurchaseOrderItem);
        this.facilityRepository = AppDataSource.getRepository(Facility);
        this.parTaskRepository = AppDataSource.getRepository(ParReplenishmentTask);
    }

    private async getDemandHistory(
        organizationId: number,
        facilityIds: number[],
        startDate: Date,
        endDate: Date,
    ): Promise<Map<number, DemandHistory>> {
        if (facilityIds.length === 0) return new Map();

        const salesRows = await this.saleItemRepository
            .createQueryBuilder('item')
            .select('sale.facility_id', 'facility_id')
            .addSelect('item.medicine_id', 'medicine_id')
            .addSelect(`TO_CHAR(sale.created_at::date, 'YYYY-MM-DD')`, 'day')
            .addSelect('SUM(item.quantity)', 'qty')
            .innerJoin('item.sale', 'sale')
            .where('sale.facility_id IN (:...facilityIds)', { facilityIds })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('sale.status != :voided', { voided: SaleStatus.VOIDED })
            .groupBy('sale.facility_id')
            .addGroupBy('item.medicine_id')
            .addGroupBy('sale.created_at::date')
            .getRawMany();

        const dispenseRows = await this.dispenseRepository
            .createQueryBuilder('dispense')
            .select('dispense.facility_id', 'facility_id')
            .addSelect('dispense.medicine_id', 'medicine_id')
            .addSelect(`TO_CHAR(dispense.created_at::date, 'YYYY-MM-DD')`, 'day')
            .addSelect('SUM(dispense.quantity)', 'qty')
            .where('dispense.facility_id IN (:...facilityIds)', { facilityIds })
            .andWhere('dispense.organization_id = :organizationId', { organizationId })
            .andWhere('dispense.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('dispense.facility_id')
            .addGroupBy('dispense.medicine_id')
            .addGroupBy('dispense.created_at::date')
            .getRawMany();

        const byFacility = new Map<number, DemandHistory>();

        const append = (facilityId: number, medicineId: number, day: string, qty: number): void => {
            if (!byFacility.has(facilityId)) {
                byFacility.set(facilityId, new Map());
            }
            const history = byFacility.get(facilityId) as DemandHistory;
            if (!history.has(medicineId)) {
                history.set(medicineId, new Map());
            }
            const medicineHistory = history.get(medicineId) as Map<string, number>;
            medicineHistory.set(day, (medicineHistory.get(day) || 0) + qty);
        };

        salesRows.forEach((row) => {
            append(Number(row.facility_id), Number(row.medicine_id), String(row.day), Number(row.qty || 0));
        });
        dispenseRows.forEach((row) => {
            append(Number(row.facility_id), Number(row.medicine_id), String(row.day), Number(row.qty || 0));
        });

        return byFacility;
    }

    private async getStockMap(organizationId: number, facilityIds: number[]): Promise<Map<number, Map<number, number>>> {
        if (facilityIds.length === 0) return new Map();

        const rows = await this.stockRepository
            .createQueryBuilder('stock')
            .select('stock.facility_id', 'facility_id')
            .addSelect('stock.medicine_id', 'medicine_id')
            .addSelect('COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0)', 'qty')
            .where('stock.facility_id IN (:...facilityIds)', { facilityIds })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .groupBy('stock.facility_id')
            .addGroupBy('stock.medicine_id')
            .getRawMany();

        const byFacility = new Map<number, Map<number, number>>();
        rows.forEach((row) => {
            const facilityId = Number(row.facility_id);
            const medicineId = Number(row.medicine_id);
            if (!byFacility.has(facilityId)) {
                byFacility.set(facilityId, new Map());
            }
            (byFacility.get(facilityId) as Map<number, number>).set(medicineId, Number(row.qty || 0));
        });
        return byFacility;
    }

    async getVelocitySegmentation(
        facilityId: number,
        organizationId: number,
        days: number = 90,
    ): Promise<{
        period_days: number;
        summary: Record<VelocitySegment, number>;
        items: VelocitySegmentationItem[];
    }> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const demandByFacility = await this.getDemandHistory(organizationId, [facilityId], startDate, endDate);
        const stockByFacility = await this.getStockMap(organizationId, [facilityId]);
        const demand: DemandHistory = demandByFacility.get(facilityId) || new Map<number, Map<string, number>>();
        const stock: Map<number, number> = stockByFacility.get(facilityId) || new Map<number, number>();

        const medicineIds = Array.from(new Set([...demand.keys(), ...stock.keys()]));
        if (medicineIds.length === 0) {
            return {
                period_days: days,
                summary: { fast: 0, medium: 0, slow: 0, dead: 0 },
                items: [],
            };
        }

        const medicines = await this.medicineRepository.find({
            where: { id: In(medicineIds), organization_id: organizationId },
        });
        const medicineNameMap = new Map<number, string>();
        medicines.forEach((medicine) => medicineNameMap.set(medicine.id, medicine.name));

        const raw = medicineIds.map((medicineId) => {
            const totalDemand = (Array.from(demand.get(medicineId)?.values() || []) as number[]).reduce(
                (sum, value) => sum + value,
                0,
            );
            const currentStock = Number(stock.get(medicineId) || 0);
            return {
                medicine_id: medicineId,
                medicine_name: medicineNameMap.get(medicineId) || `Medicine #${medicineId}`,
                total_demand: totalDemand,
                daily_velocity: totalDemand / days,
                current_stock: currentStock,
            };
        });

        const active = raw
            .filter((item) => item.total_demand > 0)
            .sort((a, b) => b.daily_velocity - a.daily_velocity);
        const fastCutoff = Math.max(1, Math.ceil(active.length * 0.2));
        const mediumCutoff = Math.max(fastCutoff + 1, Math.ceil(active.length * 0.5));
        const rankMap = new Map<number, number>();
        active.forEach((item, index) => rankMap.set(item.medicine_id, index));

        const items = raw
            .map((item) => {
                const rank = rankMap.get(item.medicine_id);
                let segment: VelocitySegment = 'slow';
                if (item.total_demand <= 0) {
                    segment = item.current_stock > 0 ? 'dead' : 'slow';
                } else if (rank !== undefined && rank < fastCutoff) {
                    segment = 'fast';
                } else if (rank !== undefined && rank < mediumCutoff) {
                    segment = 'medium';
                }

                const daysOfCover = item.daily_velocity > 0 ? item.current_stock / item.daily_velocity : 999;
                let suggestedAction = 'Monitor regular consumption patterns';
                if (segment === 'fast') suggestedAction = 'Increase safety stock and prioritize replenishment';
                if (segment === 'medium') suggestedAction = 'Maintain current reorder cadence';
                if (segment === 'slow') suggestedAction = 'Reduce order frequency and monitor trends';
                if (segment === 'dead') suggestedAction = 'Run markdown/transfer/return action to release cash';

                return {
                    ...item,
                    segment,
                    days_of_cover: Math.round(daysOfCover * 10) / 10,
                    suggested_action: suggestedAction,
                };
            })
            .sort((a, b) => b.daily_velocity - a.daily_velocity);

        const summary: Record<VelocitySegment, number> = { fast: 0, medium: 0, slow: 0, dead: 0 };
        items.forEach((item) => {
            summary[item.segment] += 1;
        });

        return {
            period_days: days,
            summary,
            items,
        };
    }

    async getSupplierIntelligence(
        facilityId: number,
        organizationId: number,
        startDate?: Date,
        endDate?: Date,
    ): Promise<SupplierIntelligenceItem[]> {
        const query = this.purchaseOrderRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .leftJoinAndSelect('po.items', 'items')
            .where('po.facility_id = :facilityId', { facilityId })
            .andWhere('po.organization_id = :organizationId', { organizationId });

        if (startDate) {
            query.andWhere('COALESCE(po.order_date, po.created_at) >= :startDate', { startDate });
        }
        if (endDate) {
            query.andWhere('COALESCE(po.order_date, po.created_at) <= :endDate', { endDate });
        }

        const orders = await query.getMany();
        const grouped = new Map<number, { supplier_name: string; orders: PurchaseOrder[] }>();

        orders.forEach((order) => {
            if (!grouped.has(order.supplier_id)) {
                grouped.set(order.supplier_id, {
                    supplier_name: order.supplier?.name || 'Unknown',
                    orders: [],
                });
            }
            (grouped.get(order.supplier_id) as { supplier_name: string; orders: PurchaseOrder[] }).orders.push(order);
        });

        const result: SupplierIntelligenceItem[] = [];

        for (const [supplierId, group] of grouped.entries()) {
            const supplierOrders = group.orders;
            const totalOrders = supplierOrders.length;
            const completedOrders = supplierOrders.filter((order) =>
                [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED].includes(order.status),
            ).length;

            let otifCount = 0;
            let totalOrderedQty = 0;
            let totalReceivedQty = 0;
            let shortFillOrders = 0;
            const leadTimes: number[] = [];
            const pricePoints: number[] = [];
            const monthly = new Map<string, { ordered: number; received: number }>();

            supplierOrders.forEach((order) => {
                const orderItems = order.items || [];
                const orderedQty = orderItems.reduce((sum, item) => sum + Number(item.quantity_ordered || 0), 0);
                const receivedQty = orderItems.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0);
                const fillRate = orderedQty > 0 ? receivedQty / orderedQty : 1;

                totalOrderedQty += orderedQty;
                totalReceivedQty += receivedQty;
                if (fillRate < 0.98) shortFillOrders += 1;

                if (order.order_date && order.received_date) {
                    const leadDays =
                        (new Date(order.received_date).getTime() - new Date(order.order_date).getTime()) /
                        (1000 * 60 * 60 * 24);
                    if (Number.isFinite(leadDays) && leadDays >= 0) {
                        leadTimes.push(leadDays);
                    }
                }

                const onTime =
                    !!order.expected_delivery_date &&
                    !!order.received_date &&
                    new Date(order.received_date).getTime() <= new Date(order.expected_delivery_date).getTime();
                if (onTime && fillRate >= 0.98) otifCount += 1;

                orderItems.forEach((item) => {
                    const unitPrice = Number(item.unit_price || 0);
                    if (unitPrice > 0) pricePoints.push(unitPrice);
                });

                const month = toDateKey(new Date(order.created_at)).slice(0, 7);
                if (!monthly.has(month)) {
                    monthly.set(month, { ordered: 0, received: 0 });
                }
                const monthStats = monthly.get(month) as { ordered: number; received: number };
                monthStats.ordered += orderedQty;
                monthStats.received += receivedQty;
            });

            const fillRate = totalOrderedQty > 0 ? (totalReceivedQty / totalOrderedQty) * 100 : 0;
            const otifRate = totalOrders > 0 ? (otifCount / totalOrders) * 100 : 0;
            const averageLead = avg(leadTimes);
            const leadVariance = stdDev(leadTimes);
            const priceMean = avg(pricePoints);
            const priceVolatilityPercent = priceMean > 0 ? (stdDev(pricePoints) / priceMean) * 100 : 0;

            const delayImpact = 100 - Math.max(0, Math.min(100, otifRate));
            const fillImpact = Math.max(0, Math.min(100, 100 - fillRate));
            const priceImpact = Math.max(0, Math.min(100, priceVolatilityPercent));
            const impactTotal = delayImpact + fillImpact + priceImpact || 1;

            result.push({
                supplier_id: supplierId,
                supplier_name: group.supplier_name,
                total_orders: totalOrders,
                completed_orders: completedOrders,
                otif_rate: Math.round(otifRate * 10) / 10,
                fill_rate: Math.round(fillRate * 10) / 10,
                average_lead_time_days: Math.round(averageLead * 10) / 10,
                lead_time_variance_days: Math.round(leadVariance * 10) / 10,
                short_fill_rate: Math.round(((shortFillOrders / Math.max(totalOrders, 1)) * 100) * 10) / 10,
                price_volatility_percent: Math.round(priceVolatilityPercent * 10) / 10,
                variance_attribution: {
                    delay_impact_percent: Math.round((delayImpact / impactTotal) * 1000) / 10,
                    fill_impact_percent: Math.round((fillImpact / impactTotal) * 1000) / 10,
                    price_impact_percent: Math.round((priceImpact / impactTotal) * 1000) / 10,
                },
                monthly_fill_rate_trend: Array.from(monthly.entries())
                    .map(([month, stats]) => ({
                        month,
                        fill_rate: stats.ordered > 0 ? Math.round(((stats.received / stats.ordered) * 1000)) / 10 : 0,
                    }))
                    .sort((a, b) => a.month.localeCompare(b.month)),
            });
        }

        return result.sort((a, b) => b.otif_rate - a.otif_rate);
    }

    async getPredictiveExpiryRisk(
        facilityId: number,
        organizationId: number,
        horizonDays: number = 120,
        demandLookbackDays: number = 90,
    ): Promise<{
        horizon_days: number;
        summary: {
            at_risk_batches: number;
            projected_waste_qty: number;
            projected_waste_value: number;
        };
        items: PredictiveExpiryRiskItem[];
    }> {
        const now = new Date();
        const horizonDate = new Date();
        horizonDate.setDate(horizonDate.getDate() + horizonDays);

        const demandStartDate = new Date();
        demandStartDate.setDate(demandStartDate.getDate() - demandLookbackDays);
        const demandByFacility = await this.getDemandHistory(organizationId, [facilityId], demandStartDate, now);
        const demandMap: DemandHistory = demandByFacility.get(facilityId) || new Map<number, Map<string, number>>();

        const demandRate = new Map<number, number>();
        demandMap.forEach((dayMap, medicineId) => {
            const total = (Array.from(dayMap.values()) as number[]).reduce((sum, value) => sum + value, 0);
            demandRate.set(medicineId, total / demandLookbackDays);
        });

        const rows = await this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.batch', 'batch')
            .leftJoinAndSelect('stock.medicine', 'medicine')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('stock.quantity > 0')
            .andWhere('batch.expiry_date <= :horizonDate', { horizonDate })
            .getMany();

        const items: PredictiveExpiryRiskItem[] = rows.map((row) => {
            const qty = Number(row.quantity || 0);
            const dailyDemand = Number(demandRate.get(row.medicine_id) || 0);
            const daysToExpiry = Math.ceil(
                (new Date(row.batch.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            const projectedConsumption = Math.max(0, dailyDemand * Math.max(0, daysToExpiry));
            const projectedWasteQty = Math.max(0, qty - projectedConsumption);
            const unitCost = Number(row.unit_cost ?? row.batch?.unit_cost ?? 0);
            const projectedWasteValue = projectedWasteQty * unitCost;
            const wasteRatio = qty > 0 ? projectedWasteQty / qty : 0;

            let riskLevel: RiskLevel = 'low';
            if (daysToExpiry <= 0 || wasteRatio >= 0.8) riskLevel = 'critical';
            else if (daysToExpiry <= 30 || wasteRatio >= 0.5) riskLevel = 'high';
            else if (daysToExpiry <= 60 || wasteRatio >= 0.25) riskLevel = 'medium';

            return {
                stock_id: row.id,
                medicine_id: row.medicine_id,
                medicine_name: row.medicine?.name || 'Unknown',
                batch_id: row.batch_id,
                batch_number: row.batch?.batch_number || '-',
                expiry_date: new Date(row.batch.expiry_date).toISOString(),
                quantity: qty,
                projected_consumption_before_expiry: Math.round(projectedConsumption * 10) / 10,
                projected_waste_qty: Math.round(projectedWasteQty * 10) / 10,
                projected_waste_value: Math.round(projectedWasteValue * 100) / 100,
                days_to_expiry: daysToExpiry,
                risk_level: riskLevel,
            };
        });

        return {
            horizon_days: horizonDays,
            summary: {
                at_risk_batches: items.filter((item) => ['medium', 'high', 'critical'].includes(item.risk_level)).length,
                projected_waste_qty: Math.round(items.reduce((sum, item) => sum + item.projected_waste_qty, 0) * 10) / 10,
                projected_waste_value:
                    Math.round(items.reduce((sum, item) => sum + item.projected_waste_value, 0) * 100) / 100,
            },
            items: items.sort((a, b) => b.projected_waste_value - a.projected_waste_value),
        };
    }

    async getNearExpiryActionPlan(
        facilityId: number,
        organizationId: number,
        horizonDays: number = 90,
    ): Promise<{
        summary: Record<ExpiryActionType, number>;
        items: NearExpiryActionItem[];
    }> {
        const predictive = await this.getPredictiveExpiryRisk(facilityId, organizationId, horizonDays);
        const stockRows = await this.stockRepository.find({
            where: {
                id: In(predictive.items.map((item) => item.stock_id)),
                organization_id: organizationId,
            },
            relations: ['batch', 'medicine'],
        });
        const stockMap = new Map<number, Stock>();
        stockRows.forEach((row) => stockMap.set(row.id, row));

        const items: NearExpiryActionItem[] = predictive.items.map((item) => {
            const stock = stockMap.get(item.stock_id);
            const unitCost = Number(stock?.unit_cost ?? stock?.batch?.unit_cost ?? 0);

            let recommendedAction: ExpiryActionType = 'monitor';
            let actionReason = 'Demand is expected to absorb available stock';
            if (item.days_to_expiry <= 0) {
                recommendedAction = 'disposal';
                actionReason = 'Batch already expired';
            } else if (item.risk_level === 'critical' || item.days_to_expiry <= 7) {
                recommendedAction = 'markdown';
                actionReason = 'Immediate sell-through required';
            } else if (item.risk_level === 'high' || item.days_to_expiry <= 21) {
                recommendedAction = 'transfer';
                actionReason = 'Move stock to higher-consumption location';
            } else if (item.risk_level === 'medium' || item.days_to_expiry <= 45) {
                recommendedAction = 'vendor_return';
                actionReason = 'Return candidate before residual shelf-life is too short';
            }

            return {
                stock_id: item.stock_id,
                medicine_id: item.medicine_id,
                medicine_name: item.medicine_name,
                batch_id: item.batch_id,
                batch_number: item.batch_number,
                department_id: stock?.department_id || null,
                quantity: item.quantity,
                unit_cost: unitCost,
                days_to_expiry: item.days_to_expiry,
                projected_waste_qty: item.projected_waste_qty,
                risk_value: item.projected_waste_value,
                risk_level: item.risk_level,
                recommended_action: recommendedAction,
                action_reason: actionReason,
            };
        });

        const summary: Record<ExpiryActionType, number> = {
            markdown: 0,
            transfer: 0,
            vendor_return: 0,
            disposal: 0,
            monitor: 0,
        };
        items.forEach((item) => {
            summary[item.recommended_action] += 1;
        });

        return {
            summary,
            items: items.sort((a, b) => b.risk_value - a.risk_value),
        };
    }

    async getDemandForecast(
        facilityId: number,
        organizationId: number,
        horizonDays: number = 30,
        historyDays: number = 180,
    ): Promise<{
        horizon_days: number;
        history_days: number;
        medicines: DemandForecastItem[];
    }> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - historyDays);

        const demandByFacility = await this.getDemandHistory(organizationId, [facilityId], startDate, endDate);
        const stockByFacility = await this.getStockMap(organizationId, [facilityId]);
        const demand: DemandHistory = demandByFacility.get(facilityId) || new Map<number, Map<string, number>>();
        const stock: Map<number, number> = stockByFacility.get(facilityId) || new Map<number, number>();

        const medicineIds = Array.from(new Set([...demand.keys(), ...stock.keys()]));
        if (medicineIds.length === 0) {
            return {
                horizon_days: horizonDays,
                history_days: historyDays,
                medicines: [],
            };
        }

        const medicines = await this.medicineRepository.find({
            where: { id: In(medicineIds), organization_id: organizationId },
        });
        const medicineNameMap = new Map<number, string>();
        medicines.forEach((medicine) => medicineNameMap.set(medicine.id, medicine.name));

        const daysList: string[] = [];
        for (let i = historyDays - 1; i >= 0; i -= 1) {
            const day = new Date(endDate);
            day.setDate(day.getDate() - i);
            daysList.push(toDateKey(day));
        }

        const forecastItems: DemandForecastItem[] = medicineIds.map((medicineId) => {
            const medicineDemand = demand.get(medicineId) || new Map<string, number>();
            const series = daysList.map((day) => Number(medicineDemand.get(day) || 0));
            const avg7 = avg(series.slice(-7));
            const avg14 = avg(series.slice(-14));
            const avg28 = avg(series.slice(-28));
            const historicalDailyAverage = avg(series);
            const trendPerDay = avg(series.slice(-14)) - avg(series.slice(-28, -14));

            const weekdayBuckets: Record<number, number[]> = {
                0: [],
                1: [],
                2: [],
                3: [],
                4: [],
                5: [],
                6: [],
            };
            daysList.forEach((day, index) => {
                const weekday = new Date(day).getDay();
                weekdayBuckets[weekday].push(series[index]);
            });

            const globalAvg = historicalDailyAverage || 1;
            const weekdayFactor = new Map<number, number>();
            Object.keys(weekdayBuckets).forEach((key) => {
                const weekday = Number(key);
                const weekdayAvg = avg(weekdayBuckets[weekday]);
                weekdayFactor.set(weekday, Math.max(0.6, Math.min(1.4, weekdayAvg / globalAvg)));
            });
            const seasonalityProfile = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
                weekday,
                factor: Math.round(Number(weekdayFactor.get(weekday) || 1) * 1000) / 1000,
            }));

            const base = Math.max(0, avg7 * 0.5 + avg14 * 0.3 + avg28 * 0.2);
            const forecastDaily: Array<{ date: string; quantity: number }> = [];
            for (let step = 1; step <= horizonDays; step += 1) {
                const futureDate = new Date(endDate);
                futureDate.setDate(futureDate.getDate() + step);
                const factor = Number(weekdayFactor.get(futureDate.getDay()) || 1);
                const trended = Math.max(0, base + (trendPerDay / 14) * step);
                const qty = Math.max(0, trended * factor);
                forecastDaily.push({
                    date: toDateKey(futureDate),
                    quantity: Math.round(qty * 10) / 10,
                });
            }

            let mapeEstimate: number | null = null;
            if (series.length >= 56) {
                const errors: number[] = [];
                for (let i = 42; i < series.length; i += 1) {
                    const actual = series[i];
                    const baseline = avg(series.slice(Math.max(0, i - 28), i));
                    if (actual > 0) {
                        errors.push(Math.abs(actual - baseline) / actual);
                    }
                }
                if (errors.length > 0) {
                    mapeEstimate = Math.round(avg(errors) * 1000) / 10;
                }
            }

            const forecastTotal = Math.round(forecastDaily.reduce((sum, row) => sum + row.quantity, 0) * 10) / 10;
            const baselineTotal = Math.max(0, historicalDailyAverage * horizonDays);
            const trendDeltaRatio = baselineTotal > 0 ? (forecastTotal - baselineTotal) / baselineTotal : 0;
            let trendDirection: DemandForecastItem['trend_direction'] = 'stable';
            if (trendDeltaRatio > 0.08) {
                trendDirection = 'up';
            } else if (trendDeltaRatio < -0.08) {
                trendDirection = 'down';
            }

            const peakWeekday = seasonalityProfile.reduce((best, item) => (item.factor > best.factor ? item : best));
            const troughWeekday = seasonalityProfile.reduce((best, item) =>
                item.factor < best.factor ? item : best,
            );

            const confidence = Math.max(35, Math.min(95, 100 - Number(mapeEstimate || 35)));

            return {
                medicine_id: medicineId,
                medicine_name: medicineNameMap.get(medicineId) || `Medicine #${medicineId}`,
                current_stock: Number(stock.get(medicineId) || 0),
                historical_daily_average: Math.round(historicalDailyAverage * 100) / 100,
                forecast_total: forecastTotal,
                forecast_daily: forecastDaily,
                trend_direction: trendDirection,
                seasonality_profile: seasonalityProfile,
                peak_weekday: peakWeekday.weekday,
                trough_weekday: troughWeekday.weekday,
                confidence_score: Math.round(confidence * 10) / 10,
                mape_estimate: mapeEstimate,
            };
        });

        return {
            horizon_days: horizonDays,
            history_days: historyDays,
            medicines: forecastItems.sort((a, b) => b.forecast_total - a.forecast_total),
        };
    }

    async getSmartReorderPlan(
        facilityId: number,
        organizationId: number,
        horizonDays: number = 30,
    ): Promise<{
        horizon_days: number;
        generated_at: string;
        items: SmartReorderItem[];
    }> {
        const [forecast, expiryRisk, supplierIntel] = await Promise.all([
            this.getDemandForecast(facilityId, organizationId, horizonDays, 180),
            this.getPredictiveExpiryRisk(facilityId, organizationId, Math.max(90, horizonDays * 2), 90),
            this.getSupplierIntelligence(facilityId, organizationId),
        ]);

        const reliability =
            supplierIntel.length > 0
                ? avg(supplierIntel.map((item) => (item.otif_rate + item.fill_rate) / 2)) / 100
                : 0.8;

        const atRiskByMedicine = new Map<number, number>();
        expiryRisk.items.forEach((item) => {
            if (item.risk_level === 'high' || item.risk_level === 'critical') {
                atRiskByMedicine.set(
                    item.medicine_id,
                    (atRiskByMedicine.get(item.medicine_id) || 0) + item.projected_waste_qty,
                );
            }
        });

        const leadTimeRows = await this.purchaseOrderItemRepository
            .createQueryBuilder('item')
            .innerJoin('item.purchase_order', 'po')
            .select('item.medicine_id', 'medicine_id')
            .addSelect(
                'AVG(EXTRACT(EPOCH FROM (po.received_date::timestamp - po.order_date::timestamp)) / 86400.0)',
                'lead_time_days',
            )
            .where('po.facility_id = :facilityId', { facilityId })
            .andWhere('po.organization_id = :organizationId', { organizationId })
            .andWhere('po.status IN (:...statuses)', {
                statuses: [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED],
            })
            .andWhere('po.order_date IS NOT NULL')
            .andWhere('po.received_date IS NOT NULL')
            .groupBy('item.medicine_id')
            .getRawMany();

        const leadTimeMap = new Map<number, number>();
        leadTimeRows.forEach((row) => {
            const value = Number(row.lead_time_days || 0);
            if (Number.isFinite(value) && value > 0) {
                leadTimeMap.set(Number(row.medicine_id), value);
            }
        });
        const now = new Date();

        const items: SmartReorderItem[] = forecast.medicines
            .map((medicine) => {
                const atRiskQty = Number(atRiskByMedicine.get(medicine.medicine_id) || 0);
                const usableStock = Math.max(0, medicine.current_stock - atRiskQty);
                const leadTime = Math.max(2, Math.round(leadTimeMap.get(medicine.medicine_id) || 7));
                const dailyDemand = horizonDays > 0 ? medicine.forecast_total / horizonDays : 0;
                const safetyStock = Math.ceil(dailyDemand * Math.sqrt(leadTime) * (1.2 + (1 - reliability)));
                const targetStock = Math.ceil(medicine.forecast_total + safetyStock);
                const recommendedOrderQty = Math.max(0, targetStock - usableStock);
                const daysCover = dailyDemand > 0 ? usableStock / dailyDemand : 999;
                let projectedStockoutDate: string | null = null;
                let jitReorderByDate: string | null = null;
                if (dailyDemand > 0 && Number.isFinite(daysCover) && daysCover < 999) {
                    const stockoutDate = new Date(now);
                    stockoutDate.setDate(stockoutDate.getDate() + Math.max(0, Math.ceil(daysCover)));
                    projectedStockoutDate = toDateKey(stockoutDate);

                    const reorderDate = new Date(stockoutDate);
                    reorderDate.setDate(reorderDate.getDate() - leadTime);
                    jitReorderByDate = toDateKey(reorderDate);
                }

                let priority: RiskLevel = 'low';
                if (daysCover <= 3 || usableStock <= 0) priority = 'critical';
                else if (daysCover <= 7) priority = 'high';
                else if (daysCover <= 14) priority = 'medium';

                return {
                    medicine_id: medicine.medicine_id,
                    medicine_name: medicine.medicine_name,
                    current_stock: medicine.current_stock,
                    at_risk_expiry_qty: Math.round(atRiskQty * 10) / 10,
                    usable_stock: Math.round(usableStock * 10) / 10,
                    forecast_horizon_demand: medicine.forecast_total,
                    safety_stock: safetyStock,
                    target_stock: targetStock,
                    recommended_order_qty: recommendedOrderQty,
                    lead_time_days: leadTime,
                    days_of_cover: Math.round(daysCover * 10) / 10,
                    projected_stockout_date: projectedStockoutDate,
                    jit_reorder_by_date: jitReorderByDate,
                    supplier_reliability_score: Math.round(reliability * 1000) / 10,
                    priority,
                    reason:
                        recommendedOrderQty > 0
                            ? `Forecast demand ${medicine.forecast_total.toFixed(1)} with lead time ${leadTime} days`
                            : 'Current stock and expiry-adjusted inventory are sufficient',
                };
            })
            .filter((item) => item.recommended_order_qty > 0)
            .sort((a, b) => b.recommended_order_qty - a.recommended_order_qty);

        return {
            horizon_days: horizonDays,
            generated_at: new Date().toISOString(),
            items,
        };
    }

    async getMultiBranchTransferSuggestions(
        organizationId: number,
        lookbackDays: number = 60,
    ): Promise<{
        organization_id: number;
        generated_at: string;
        suggestions: MultiBranchTransferSuggestion[];
    }> {
        const facilities = await this.facilityRepository.find({
            where: { organization_id: organizationId, is_active: true },
        });
        if (facilities.length < 2) {
            return {
                organization_id: organizationId,
                generated_at: new Date().toISOString(),
                suggestions: [],
            };
        }

        const facilityIds = facilities.map((facility) => facility.id);
        const facilityNameMap = new Map<number, string>();
        facilities.forEach((facility) => facilityNameMap.set(facility.id, facility.name));

        const stockByFacility = await this.getStockMap(organizationId, facilityIds);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);
        const demandByFacility = await this.getDemandHistory(organizationId, facilityIds, startDate, endDate);

        const medicineIds = new Set<number>();
        stockByFacility.forEach((medicineMap) => {
            medicineMap.forEach((_value, medicineId) => medicineIds.add(medicineId));
        });
        demandByFacility.forEach((history) => {
            history.forEach((_day, medicineId) => medicineIds.add(medicineId));
        });

        const medicines = await this.medicineRepository.find({
            where: { id: In(Array.from(medicineIds)), organization_id: organizationId },
        });
        const medicineNameMap = new Map<number, string>();
        medicines.forEach((medicine) => medicineNameMap.set(medicine.id, medicine.name));

        const suggestions: MultiBranchTransferSuggestion[] = [];

        for (const medicineId of medicineIds) {
            const donorCandidates: Array<{ facility_id: number; qty: number; cover: number; excess: number }> = [];
            const receiverCandidates: Array<{ facility_id: number; qty: number; cover: number; shortage: number }> = [];

            for (const facilityId of facilityIds) {
                const qty = Number(stockByFacility.get(facilityId)?.get(medicineId) || 0);
                const demandHistory = demandByFacility.get(facilityId)?.get(medicineId) || new Map<string, number>();
                const totalDemand = (Array.from(demandHistory.values()) as number[]).reduce((sum, value) => sum + value, 0);
                const dailyDemand = totalDemand / lookbackDays;
                const cover = dailyDemand > 0 ? qty / dailyDemand : qty > 0 ? 999 : 0;

                const targetReceiverDays = 21;
                const donorSafeDays = 60;
                const shortage = Math.max(0, dailyDemand * targetReceiverDays - qty);
                const excess = Math.max(0, qty - dailyDemand * donorSafeDays);

                if (excess > 0 && cover > donorSafeDays) {
                    donorCandidates.push({ facility_id: facilityId, qty, cover, excess });
                }
                if (shortage > 0 && cover < 14) {
                    receiverCandidates.push({ facility_id: facilityId, qty, cover, shortage });
                }
            }

            donorCandidates.sort((a, b) => b.excess - a.excess);
            receiverCandidates.sort((a, b) => b.shortage - a.shortage);

            for (const receiver of receiverCandidates) {
                let remaining = receiver.shortage;
                for (const donor of donorCandidates) {
                    if (remaining <= 0) break;
                    if (donor.facility_id === receiver.facility_id || donor.excess <= 0) continue;

                    const suggestedQty = Math.floor(Math.min(donor.excess, remaining));
                    if (suggestedQty <= 0) continue;

                    donor.excess -= suggestedQty;
                    remaining -= suggestedQty;

                    suggestions.push({
                        medicine_id: medicineId,
                        medicine_name: medicineNameMap.get(medicineId) || `Medicine #${medicineId}`,
                        from_facility_id: donor.facility_id,
                        from_facility_name: facilityNameMap.get(donor.facility_id) || `Facility #${donor.facility_id}`,
                        to_facility_id: receiver.facility_id,
                        to_facility_name:
                            facilityNameMap.get(receiver.facility_id) || `Facility #${receiver.facility_id}`,
                        suggested_transfer_qty: suggestedQty,
                        donor_days_cover: Math.round(donor.cover * 10) / 10,
                        receiver_days_cover: Math.round(receiver.cover * 10) / 10,
                        estimated_stockout_days_prevented: Math.round(
                            Math.max(0, 21 - receiver.cover) * 10,
                        ) / 10,
                        rationale: 'Rebalance excess cover to branch with imminent stockout risk',
                    });
                }
            }
        }

        return {
            organization_id: organizationId,
            generated_at: new Date().toISOString(),
            suggestions: suggestions.slice(0, 200),
        };
    }

    async getMobileWorkflowBoard(
        facilityId: number,
        organizationId?: number,
    ): Promise<{
        generated_at: string;
        quick_actions: {
            par_tasks: Array<{
                task_id: number;
                medicine_id: number;
                medicine_name: string;
                suggested_quantity: number;
                priority: string;
            }>;
            urgent_expiry: Array<{
                stock_id: number;
                medicine_name: string;
                days_to_expiry: number;
                action: ExpiryActionType;
            }>;
            reorder_now: Array<{
                medicine_id: number;
                medicine_name: string;
                recommended_order_qty: number;
                priority: RiskLevel;
            }>;
            transfer_suggestions: Array<{
                medicine_name: string;
                from_facility_name: string;
                to_facility_name: string;
                qty: number;
            }>;
        };
    }> {
        const [parTasks, expiryPlan, smartReorder] = await Promise.all([
            this.parTaskRepository.find({
                where: {
                    facility_id: facilityId,
                    organization_id: organizationId,
                    status: ParReplenishmentTaskStatus.PENDING,
                },
                relations: ['medicine'],
                take: 10,
                order: { created_at: 'DESC' },
            }),
            this.getNearExpiryActionPlan(facilityId, organizationId!, 45),
            this.getSmartReorderPlan(facilityId, organizationId!, 21),
        ]);

        let transferSuggestions: MultiBranchTransferSuggestion[] = [];
        if (organizationId) {
            const multiBranch = await this.getMultiBranchTransferSuggestions(organizationId, 60);
            transferSuggestions = multiBranch.suggestions.filter((item) => item.to_facility_id === facilityId).slice(0, 10);
        }

        return {
            generated_at: new Date().toISOString(),
            quick_actions: {
                par_tasks: parTasks.map((task) => ({
                    task_id: task.id,
                    medicine_id: task.medicine_id,
                    medicine_name: task.medicine?.name || `Medicine #${task.medicine_id}`,
                    suggested_quantity: task.suggested_quantity,
                    priority: task.priority,
                })),
                urgent_expiry: expiryPlan.items
                    .filter((item) => item.risk_level === 'high' || item.risk_level === 'critical')
                    .slice(0, 10)
                    .map((item) => ({
                        stock_id: item.stock_id,
                        medicine_name: item.medicine_name,
                        days_to_expiry: item.days_to_expiry,
                        action: item.recommended_action,
                    })),
                reorder_now: smartReorder.items
                    .filter((item) => item.priority === 'high' || item.priority === 'critical')
                    .slice(0, 10)
                    .map((item) => ({
                        medicine_id: item.medicine_id,
                        medicine_name: item.medicine_name,
                        recommended_order_qty: item.recommended_order_qty,
                        priority: item.priority,
                    })),
                transfer_suggestions: transferSuggestions.slice(0, 10).map((item) => ({
                    medicine_name: item.medicine_name,
                    from_facility_name: item.from_facility_name,
                    to_facility_name: item.to_facility_name,
                    qty: item.suggested_transfer_qty,
                })),
            },
        };
    }
}
