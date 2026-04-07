import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { Stock } from '../../entities/Stock.entity';

export class ReorderService {
    private dispenseRepository: Repository<DispenseTransaction>;
    private medicineRepository: Repository<Medicine>;
    private stockRepository: Repository<Stock>;

    constructor() {
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.stockRepository = AppDataSource.getRepository(Stock);
    }

    /**
     * Calculates the average daily consumption of a medicine over a specified period.
     * @param medicineId The ID of the medicine.
     * @param facilityId The ID of the facility.
     * @param days The number of days to look back (default: 30).
     */
    async calculateAverageDailyConsumption(medicineId: number, facilityId: number, days: number = 30): Promise<number> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const result = await this.dispenseRepository
            .createQueryBuilder('dt')
            .select('SUM(dt.quantity)', 'total')
            .where('dt.medicine_id = :medicineId', { medicineId })
            .andWhere('dt.facility_id = :facilityId', { facilityId })
            .andWhere('dt.created_at >= :startDate', { startDate })
            .getRawOne();

        const totalSold = parseFloat(result.total || '0');
        return totalSold / days;
    }

    /**
     * Calculates the recommended safety stock level.
     * Basic Formula: Average Daily Consumption * Lead Time
     * @param medicineId The ID of the medicine.
     * @param facilityId The ID of the facility.
     */
    async calculateSafetyStock(medicineId: number, facilityId: number): Promise<number> {
        const medicine = await this.medicineRepository.findOne({ where: { id: medicineId } });

        if (!medicine) {
            throw new AppError('Medicine not found', 404);
        }

        const avgConsumption = await this.calculateAverageDailyConsumption(medicineId, facilityId);

        // Use configured lead time or default to 7 days
        const leadTime = medicine.lead_time_days || 7;

        return Math.ceil(avgConsumption * leadTime);
    }

    /**
     * Identifies items that are below their minimum stock level.
     * @param facilityId The ID of the facility.
     */
    async getLowStockItems(facilityId: number): Promise<any[]> {
        // Get all stocks grouped by medicine for the facility
        const stockLevels = await this.stockRepository
            .createQueryBuilder('stock')
            .select('stock.medicine_id', 'medicine_id')
            .addSelect('SUM(stock.quantity)', 'total_quantity')
            .where('stock.facility_id = :facilityId', { facilityId })
            .groupBy('stock.medicine_id')
            .getRawMany();

        const lowStockItems = [];

        for (const stock of stockLevels) {
            const medicine = await this.medicineRepository.findOne({ where: { id: stock.medicine_id } });

            if (medicine && medicine.min_stock_level > 0) {
                const totalQuantity = parseFloat(stock.total_quantity);
                if (totalQuantity < medicine.min_stock_level) {
                    lowStockItems.push({
                        medicine,
                        current_stock: totalQuantity,
                        min_stock_level: medicine.min_stock_level,
                        shortage: medicine.min_stock_level - totalQuantity,
                    });
                }
            }
        }

        return lowStockItems;
    }

    /**
     * Generates a reorder suggestion for a specific medicine.
     * Suggests ordering enough to reach target_stock_level.
     */
    async getReorderSuggestion(medicineId: number, facilityId: number): Promise<any> {
        const medicine = await this.medicineRepository.findOne({ where: { id: medicineId } });
        if (!medicine) throw new AppError('Medicine not found', 404);

        const stockResult = await this.stockRepository
            .createQueryBuilder('stock')
            .select('SUM(stock.quantity)', 'total')
            .where('stock.medicine_id = :medicineId', { medicineId })
            .andWhere('stock.facility_id = :facilityId', { facilityId })
            .getRawOne();

        const currentStock = parseFloat(stockResult.total || '0');
        const targetLevel = medicine.target_stock_level || 0;

        // If no target set, use safety stock * 2 as heuristic or just 0
        const effectiveTarget =
            targetLevel > 0 ? targetLevel : (await this.calculateSafetyStock(medicineId, facilityId)) * 2;

        if (currentStock < effectiveTarget) {
            return {
                medicine,
                current_stock: currentStock,
                target_level: effectiveTarget,
                suggested_order_quantity: Math.ceil(effectiveTarget - currentStock),
            };
        }

        return null;
    }
}
