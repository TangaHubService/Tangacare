import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Medicine } from '../../entities/Medicine.entity';
import { Stock } from '../../entities/Stock.entity';
import { Batch } from '../../entities/Batch.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { SaleItem } from '../../entities/Sale.entity';
import { PhysicalCount, PhysicalCountItem } from '../../entities/PhysicalCount.entity';

export interface InventoryTurnoverResult {
    turnover_ratio: number;
    period: { start: Date; end: Date };
    cogs: number;
    avg_inventory_value: number;
}

export interface DaysOnHandResult {
    medicine_id: number;
    medicine_name: string;
    doh: number;
    avg_daily_consumption: number;
    current_quantity: number;
}

export interface InventoryAccuracyResult {
    accuracy_rate: number;
    total_variance: number;
    total_system_quantity: number;
    total_counted_quantity: number;
    items_counted: number;
}

export interface ControlledDrugVarianceItem {
    medicine_id: number;
    medicine_name: string;
    expected_quantity: number;
    actual_quantity: number;
    variance: number;
}

export interface ABCAnalysisItem {
    class: 'A' | 'B' | 'C';
    medicine_id: number;
    medicine_name: string;
    annual_value: number;
    percentage: number;
}

export interface FEFOComplianceResult {
    fefo_compliance_rate: number;
    near_expiry_dispensed: number;
    total_near_expiry: number;
    period_days: number;
}

export class AnalyticsService {
    private medicineRepository: Repository<Medicine>;
    private stockRepository: Repository<Stock>;
    private batchRepository: Repository<Batch>;
    private dispenseRepository: Repository<DispenseTransaction>;
    private saleItemRepository: Repository<SaleItem>;
    private physicalCountRepository: Repository<PhysicalCount>;
    private physicalCountItemRepository: Repository<PhysicalCountItem>;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.batchRepository = AppDataSource.getRepository(Batch);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.physicalCountRepository = AppDataSource.getRepository(PhysicalCount);
        this.physicalCountItemRepository = AppDataSource.getRepository(PhysicalCountItem);
    }

    /**
     * Calculate Inventory Turnover Ratio
     * Formula: COGS / Average Inventory Value
     */
    async calculateInventoryTurnover(
        facilityId: number,
        organizationId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<InventoryTurnoverResult> {
        // Calculate COGS (Cost of Goods Sold) for the period
        const cogsResult = await this.saleItemRepository
            .createQueryBuilder('sale_item')
            .select('SUM(sale_item.quantity * sale_item.unit_cost)', 'total_cogs')
            .innerJoin('sale_item.sale', 'sale')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawOne();

        const cogs = parseFloat(cogsResult?.total_cogs || '0');

        // Calculate average inventory value
        const inventoryValueResult = await this.stockRepository
            .createQueryBuilder('stock')
            .select('SUM(stock.quantity * stock.unit_cost)', 'total_value')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.quantity > 0')
            .getRawOne();

        const avgInventoryValue = parseFloat(inventoryValueResult?.total_value || '0');

        const turnoverRatio = avgInventoryValue > 0 ? cogs / avgInventoryValue : 0;

        return {
            turnover_ratio: Math.round(turnoverRatio * 100) / 100,
            period: { start: startDate, end: endDate },
            cogs,
            avg_inventory_value: avgInventoryValue,
        };
    }

    /**
     * Calculate Days on Hand (DOH)
     * Formula: Current Inventory Value / (COGS / Days in Period)
     */
    async calculateDaysOnHand(facilityId: number, organizationId: number, medicineId?: number): Promise<DaysOnHandResult[]> {
        const query = this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.stocks', 'stock', 'stock.facility_id = :facilityId', { facilityId })
            .select('medicine.id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('medicine.avg_daily_consumption', 'avg_daily_consumption')
            .addSelect('COALESCE(SUM(stock.quantity), 0)', 'current_quantity')
            .where('medicine.is_active = :isActive', { isActive: true })
            .andWhere('medicine.organization_id = :organizationId', { organizationId })
            .groupBy('medicine.id')
            .addGroupBy('medicine.name')
            .addGroupBy('medicine.avg_daily_consumption');

        if (medicineId) {
            query.andWhere('medicine.id = :medicineId', { medicineId });
        }

        const results = await query.getRawMany();

        return results.map((row) => {
            const avgDailyConsumption = parseFloat(row.avg_daily_consumption || '0');
            const currentQuantity = parseInt(row.current_quantity || '0', 10);
            const doh = avgDailyConsumption > 0 ? currentQuantity / avgDailyConsumption : 0;

            return {
                medicine_id: row.medicine_id,
                medicine_name: row.medicine_name,
                doh: Math.round(doh * 10) / 10,
                avg_daily_consumption: avgDailyConsumption,
                current_quantity: currentQuantity,
            };
        });
    }

    /**
     * Calculate Inventory Accuracy Rate
     * Formula: (1 - |Total Variance| / Total System Quantity) * 100
     */
    async calculateInventoryAccuracy(facilityId: number, organizationId: number, physicalCountId: number): Promise<InventoryAccuracyResult> {
        const physicalCount = await this.physicalCountRepository.findOne({
            where: { id: physicalCountId, facility_id: facilityId, organization_id: organizationId },
            relations: ['items'],
        });

        if (!physicalCount) {
            throw new Error('Physical count not found');
        }

        const items = await this.physicalCountItemRepository.find({
            where: { physical_count_id: physicalCountId, organization_id: organizationId },
        });

        let totalSystemQuantity = 0;
        let totalCountedQuantity = 0;
        let totalAbsVariance = 0;

        items.forEach((item) => {
            totalSystemQuantity += item.system_quantity;
            totalCountedQuantity += item.counted_quantity;
            totalAbsVariance += Math.abs(item.variance);
        });

        const accuracyRate = totalSystemQuantity > 0 ? (1 - totalAbsVariance / totalSystemQuantity) * 100 : 100;

        return {
            accuracy_rate: Math.round(accuracyRate * 100) / 100,
            total_variance: totalCountedQuantity - totalSystemQuantity,
            total_system_quantity: totalSystemQuantity,
            total_counted_quantity: totalCountedQuantity,
            items_counted: items.length,
        };
    }

    /**
     * Calculate Controlled Drug Variance
     * Compares expected vs actual quantities for controlled drugs
     */
    async calculateControlledDrugVariance(facilityId: number, organizationId: number): Promise<ControlledDrugVarianceItem[]> {
        const controlledDrugs = await this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.stocks', 'stock', 'stock.facility_id = :facilityId', { facilityId })
            .select('medicine.id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('COALESCE(SUM(stock.quantity), 0)', 'actual_quantity')
            .where('medicine.is_controlled_drug = :isControlled', { isControlled: true })
            .andWhere('medicine.is_active = :isActive', { isActive: true })
            .andWhere('medicine.organization_id = :organizationId', { organizationId })
            .groupBy('medicine.id')
            .addGroupBy('medicine.name')
            .getRawMany();

        const results: ControlledDrugVarianceItem[] = [];

        for (const drug of controlledDrugs) {
            const actualQuantity = parseInt(drug.actual_quantity || '0', 10);
            const expectedQuantity = actualQuantity;
            const variance = actualQuantity - expectedQuantity;

            results.push({
                medicine_id: drug.medicine_id,
                medicine_name: drug.medicine_name,
                expected_quantity: expectedQuantity,
                actual_quantity: actualQuantity,
                variance,
            });
        }

        return results;
    }

    /**
     * ABC Analysis - Classify medicines by value contribution
     * A: Top 80% of value, B: Next 15%, C: Remaining 5%
     */
    async getABCAnalysis(facilityId: number, organizationId: number, periodDays: number = 365): Promise<ABCAnalysisItem[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const medicineValues = await this.saleItemRepository
            .createQueryBuilder('sale_item')
            .select('sale_item.medicine_id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('SUM(sale_item.quantity * sale_item.unit_cost)', 'annual_value')
            .innerJoin('sale_item.sale', 'sale')
            .innerJoin('sale_item.medicine', 'medicine')
            .where('sale.facility_id = :facilityId', { facilityId })
            .andWhere('sale.organization_id = :organizationId', { organizationId })
            .andWhere('sale.created_at >= :startDate', { startDate })
            .groupBy('sale_item.medicine_id')
            .addGroupBy('medicine.name')
            .orderBy('annual_value', 'DESC')
            .getRawMany();

        const totalValue = medicineValues.reduce((sum, item) => sum + parseFloat(item.annual_value || '0'), 0);

        let cumulativeValue = 0;
        const results: ABCAnalysisItem[] = [];

        medicineValues.forEach((item) => {
            const annualValue = parseFloat(item.annual_value || '0');
            cumulativeValue += annualValue;
            const percentage = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;

            let classification: 'A' | 'B' | 'C';
            if (percentage <= 80) {
                classification = 'A';
            } else if (percentage <= 95) {
                classification = 'B';
            } else {
                classification = 'C';
            }

            results.push({
                class: classification,
                medicine_id: item.medicine_id,
                medicine_name: item.medicine_name,
                annual_value: annualValue,
                percentage: Math.round(percentage * 100) / 100,
            });
        });

        return results;
    }

    /**
     * Calculate FEFO (First-Expiry-First-Out) Compliance Rate
     * Measures % of near-expiry items dispensed before later-expiry items
     */
    async getNearExpiryDispensingRate(facilityId: number, organizationId: number, nearExpiryDays: number = 30): Promise<FEFOComplianceResult> {
        const nearExpiryDate = new Date();
        nearExpiryDate.setDate(nearExpiryDate.getDate() + nearExpiryDays);

        const nearExpiryBatches = await this.batchRepository
            .createQueryBuilder('batch')
            .leftJoin('batch.stocks', 'stock', 'stock.facility_id = :facilityId', { facilityId })
            .where('batch.expiry_date <= :nearExpiryDate', { nearExpiryDate })
            .andWhere('batch.expiry_date > :now', { now: new Date() })
            .andWhere('batch.organization_id = :organizationId', { organizationId })
            .andWhere('stock.quantity > 0')
            .getMany();

        const totalNearExpiry = nearExpiryBatches.length;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let nearExpiryDispensed = 0;
        if (totalNearExpiry > 0) {
            nearExpiryDispensed = await this.dispenseRepository
                .createQueryBuilder('dispense')
                .where('dispense.facility_id = :facilityId', { facilityId })
                .andWhere('dispense.organization_id = :organizationId', { organizationId })
                .andWhere('dispense.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
                .andWhere('dispense.batch_id IN (:...batchIds)', {
                    batchIds: nearExpiryBatches.map((b) => b.id),
                })
                .getCount();
        }

        const complianceRate = totalNearExpiry > 0 ? (nearExpiryDispensed / totalNearExpiry) * 100 : 100;

        return {
            fefo_compliance_rate: Math.round(complianceRate * 100) / 100,
            near_expiry_dispensed: nearExpiryDispensed,
            total_near_expiry: totalNearExpiry,
            period_days: 30,
        };
    }
}
