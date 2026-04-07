import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Medicine } from '../../entities/Medicine.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';

export interface ConsumptionCalculationResult {
    medicine_id: number;
    medicine_name: string;
    avg_daily_consumption: number;
    total_dispensed: number;
    days_analyzed: number;
    last_calculated_at: Date;
}

export interface ReorderPointResult {
    medicine_id: number;
    medicine_name: string;
    reorder_point: number;
    avg_daily_consumption: number;
    lead_time_days: number;
    safety_stock_quantity: number;
}

export class ConsumptionService {
    private medicineRepository: Repository<Medicine>;
    private dispenseRepository: Repository<DispenseTransaction>;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
    }

    /**
     * Calculate average daily consumption for a specific medicine
     * @param medicineId Medicine ID
     * @param facilityId Facility ID
     * @param days Number of days to analyze (default: 90)
     */
    async calculateAverageDailyConsumption(
        medicineId: number,
        organizationId: number,
        facilityId: number,
        days: number = 90,
    ): Promise<ConsumptionCalculationResult> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get total quantity dispensed in the period
        const result = await this.dispenseRepository
            .createQueryBuilder('dispense')
            .select('SUM(dispense.quantity)', 'total_dispensed')
            .where('dispense.medicine_id = :medicineId', { medicineId })
            .andWhere('dispense.facility_id = :facilityId', { facilityId })
            .andWhere('dispense.organization_id = :organizationId', { organizationId })
            .andWhere('dispense.created_at >= :startDate', { startDate })
            .getRawOne();

        const totalDispensed = parseInt(result?.total_dispensed || '0', 10);
        const avgDailyConsumption = totalDispensed / days;

        // Update medicine record
        const medicine = await this.medicineRepository.findOne({
            where: { id: medicineId, organization_id: organizationId },
        });

        if (medicine) {
            medicine.avg_daily_consumption = Math.round(avgDailyConsumption * 100) / 100;
            medicine.last_consumption_calculated_at = new Date();
            await this.medicineRepository.save(medicine);
        }

        return {
            medicine_id: medicineId,
            medicine_name: medicine?.name || 'Unknown',
            avg_daily_consumption: Math.round(avgDailyConsumption * 100) / 100,
            total_dispensed: totalDispensed,
            days_analyzed: days,
            last_calculated_at: new Date(),
        };
    }

    /**
     * Recalculate average daily consumption for all active medicines in a facility
     * @param facilityId Facility ID
     * @param days Number of days to analyze (default: 90)
     */
    async recalculateAllConsumption(organizationId: number, facilityId: number, days: number = 90): Promise<ConsumptionCalculationResult[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get all medicines with dispense transactions in the period
        const medicinesWithDispenses = await this.dispenseRepository
            .createQueryBuilder('dispense')
            .select('DISTINCT dispense.medicine_id', 'medicine_id')
            .where('dispense.facility_id = :facilityId', { facilityId })
            .andWhere('dispense.organization_id = :organizationId', { organizationId })
            .andWhere('dispense.created_at >= :startDate', { startDate })
            .getRawMany();

        const results: ConsumptionCalculationResult[] = [];

        for (const item of medicinesWithDispenses) {
            try {
                const result = await this.calculateAverageDailyConsumption(item.medicine_id, organizationId, facilityId, days);
                results.push(result);
            } catch (error) {
                console.error(`Error calculating consumption for medicine ${item.medicine_id}:`, error);
            }
        }

        return results;
    }

    /**
     * Calculate reorder point for a medicine
     * Formula: (Lead Time Days × Avg Daily Consumption) + Safety Stock
     * @param medicineId Medicine ID
     * @param facilityId Facility ID
     */
    async calculateReorderPoint(medicineId: number, organizationId: number, facilityId: number): Promise<ReorderPointResult> {
        const medicine = await this.medicineRepository.findOne({
            where: { id: medicineId, organization_id: organizationId },
        });

        if (!medicine) {
            throw new Error(`Medicine with ID ${medicineId} not found`);
        }

        // Ensure avg_daily_consumption is calculated
        if (!medicine.avg_daily_consumption || !medicine.last_consumption_calculated_at) {
            await this.calculateAverageDailyConsumption(medicineId, organizationId, facilityId);
            // Reload medicine
            const updatedMedicine = await this.medicineRepository.findOne({
                where: { id: medicineId, organization_id: organizationId },
            });
            if (updatedMedicine) {
                Object.assign(medicine, updatedMedicine);
            }
        }

        const avgDailyConsumption = medicine.avg_daily_consumption || 0;
        const leadTimeDays = medicine.lead_time_days || 7;
        const safetyStock = medicine.safety_stock_quantity || 0;

        const reorderPoint = Math.ceil(leadTimeDays * avgDailyConsumption + safetyStock);

        // Update medicine record
        medicine.reorder_point = reorderPoint;
        await this.medicineRepository.save(medicine);

        return {
            medicine_id: medicine.id,
            medicine_name: medicine.name,
            reorder_point: reorderPoint,
            avg_daily_consumption: avgDailyConsumption,
            lead_time_days: leadTimeDays,
            safety_stock_quantity: safetyStock,
        };
    }

    /**
     * Recalculate reorder points for all active medicines in a facility
     * @param facilityId Facility ID
     */
    async recalculateAllReorderPoints(organizationId: number, facilityId: number): Promise<ReorderPointResult[]> {
        // First, ensure all consumption data is up to date
        await this.recalculateAllConsumption(organizationId, facilityId);

        // Get all active medicines
        const medicines = await this.medicineRepository.find({
            where: { is_active: true, organization_id: organizationId },
        });

        const results: ReorderPointResult[] = [];

        for (const medicine of medicines) {
            try {
                const result = await this.calculateReorderPoint(medicine.id, organizationId, facilityId);
                results.push(result);
            } catch (error) {
                console.error(`Error calculating reorder point for medicine ${medicine.id}:`, error);
            }
        }

        return results;
    }

    /**
     * Get medicines that are below their reorder point
     * @param facilityId Facility ID
     */
    async getMedicinesBelowReorderPoint(organizationId: number, facilityId?: number): Promise<any[]> {
        const queryBuilder = this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('medicine.stocks', 'stock', 'stock.is_deleted = :isDeleted' + (facilityId ? ' AND stock.facility_id = :facilityId' : ''), {
                facilityId,
                isDeleted: false,
            })
            .select('medicine.id', 'medicine_id')
            .addSelect('medicine.name', 'medicine_name')
            .addSelect('medicine.reorder_point', 'reorder_point')
            .addSelect('medicine.min_stock_level', 'min_stock_level')
            .addSelect('medicine.avg_daily_consumption', 'avg_daily_consumption')
            .addSelect('COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0)', 'current_quantity')
            .where('medicine.is_active = :isActive', { isActive: true })
            .andWhere('medicine.organization_id = :organizationId', { organizationId })
            .andWhere('(medicine.reorder_point IS NOT NULL OR medicine.min_stock_level IS NOT NULL)')
            .groupBy('medicine.id')
            .addGroupBy('medicine.name')
            .addGroupBy('medicine.reorder_point')
            .addGroupBy('medicine.min_stock_level')
            .addGroupBy('medicine.avg_daily_consumption')
            .having('COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0) <= COALESCE(medicine.reorder_point, 0)')
            .orHaving(
                'COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0) <= COALESCE(medicine.min_stock_level, 0)',
            );

        const medicines = await queryBuilder.getRawMany();

        return medicines.map((item: any) => ({
            medicine_id: item.medicine_id,
            medicine_name: item.medicine_name,
            reorder_point: item.reorder_point,
            min_stock_level: parseInt(item.min_stock_level || '0', 10),
            current_quantity: parseInt(item.current_quantity || '0', 10),
            avg_daily_consumption: parseFloat(item.avg_daily_consumption || '0'),
            shortage:
                Math.max(item.reorder_point || 0, item.min_stock_level || 0) -
                parseInt(item.current_quantity || '0', 10),
        }));
    }
}
