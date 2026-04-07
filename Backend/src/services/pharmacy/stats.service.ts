import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Stock } from '../../entities/Stock.entity';
import { Batch } from '../../entities/Batch.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { Alert } from '../../entities/Alert.entity';
import { Sale } from '../../entities/Sale.entity';

export interface DashboardStats {
    medicinesInStock: number;
    lowStockWarning: number;
    expiringSoon: number;
    dailySales: number;
    totalSalesAllTime: number;
    totalInventoryValue?: number;
    trends: {
        medicines: string;
        lowStock: string;
        expiring: string;
        sales: string;
    };
    isPositive: {
        medicines: boolean;
        lowStock: boolean;
        expiring: boolean;
        sales: boolean;
    };
}

export class StatsService {
    private stockRepository: Repository<Stock>;
    private batchRepository: Repository<Batch>;
    private dispenseRepository: Repository<DispenseTransaction>;
    private alertRepository: Repository<Alert>;
    private saleRepository: Repository<Sale>;

    constructor() {
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.batchRepository = AppDataSource.getRepository(Batch);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
        this.alertRepository = AppDataSource.getRepository(Alert);
        this.saleRepository = AppDataSource.getRepository(Sale);
    }

    async getDashboardStats(organizationId: number, facilityId?: number): Promise<DashboardStats> {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + 30);

        const stockQuery = this.stockRepository
            .createQueryBuilder('stock')
            .select('COUNT(DISTINCT stock.medicine_id)', 'count')
            .where('stock.quantity > 0');

        if (facilityId) {
            stockQuery.andWhere('stock.facility_id = :facilityId', { facilityId });
        } else {
            stockQuery.andWhere('stock.organization_id = :organizationId', { organizationId });
        }

        const medicinesInStock = parseInt((await stockQuery.getRawOne())?.count || '0');

        const lowStockQuery = this.alertRepository
            .createQueryBuilder('alert')
            .where("alert.alert_type = 'low_stock'")
            .andWhere("alert.status = 'active'");

        if (facilityId) {
            lowStockQuery.andWhere('alert.facility_id = :facilityId', { facilityId });
        } else {
            lowStockQuery.andWhere('alert.organization_id = :organizationId', { organizationId });
        }

        const lowStockWarning = await lowStockQuery.getCount();

        const expiringQuery = this.batchRepository
            .createQueryBuilder('batch')
            .where('batch.expiry_date <= :expiryThreshold', { expiryThreshold })
            .andWhere('batch.expiry_date >= :today', { today })
            .andWhere('batch.current_quantity > 0');

        if (facilityId) {
            expiringQuery.andWhere('batch.facility_id = :facilityId', { facilityId });
        } else {
            expiringQuery.andWhere('batch.organization_id = :organizationId', { organizationId });
        }

        const expiringSoon = await expiringQuery.getCount();

        const salesQuery = this.dispenseRepository
            .createQueryBuilder('dispense')
            .select('COALESCE(SUM(dispense.total_amount), 0)', 'total')
            .where('dispense.created_at >= :today', { today })
            .andWhere('dispense.created_at < :tomorrow', { tomorrow });

        if (facilityId) {
            salesQuery.andWhere('dispense.facility_id = :facilityId', { facilityId });
        } else {
            salesQuery.andWhere('dispense.organization_id = :organizationId', { organizationId });
        }

        const dispenseSalesResult = await salesQuery.getRawOne();
        const dispenseSales = parseFloat(dispenseSalesResult?.total || '0');

        // Include Sale records
        const saleQuery = this.saleRepository
            .createQueryBuilder('sale')
            .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
            .where('sale.created_at >= :today', { today })
            .andWhere('sale.created_at < :tomorrow', { tomorrow })
            .andWhere('sale.status != :voided', { voided: 'voided' });

        if (facilityId) {
            saleQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else {
            saleQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }

        const saleResult = await saleQuery.getRawOne();
        const salesFromSale = parseFloat(saleResult?.total || '0');

        const dailySales = dispenseSales + salesFromSale;
        console.log(
            `[StatsService] Facility: ${facilityId}, Daily Sales (Dispense): ${dispenseSales}, Daily Sales (Sale): ${salesFromSale}`,
        );

        const allTimeSalesQuery = this.dispenseRepository
            .createQueryBuilder('dispense')
            .select('COALESCE(SUM(dispense.total_amount), 0)', 'total');

        if (facilityId) {
            allTimeSalesQuery.andWhere('dispense.facility_id = :facilityId', { facilityId });
        } else {
            allTimeSalesQuery.andWhere('dispense.organization_id = :organizationId', { organizationId });
        }
        const dispenseAllTimeResult = await allTimeSalesQuery.getRawOne();
        const dispenseAllTime = parseFloat(dispenseAllTimeResult?.total || '0');

        const saleAllTimeQuery = this.saleRepository
            .createQueryBuilder('sale')
            .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
            .where('sale.status != :voided', { voided: 'voided' });

        if (facilityId) {
            saleAllTimeQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else {
            saleAllTimeQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }
        const saleAllTime = parseFloat((await saleAllTimeQuery.getRawOne())?.total || '0');

        const totalSalesAllTime = dispenseAllTime + saleAllTime;

        // Inventory Value
        const inventoryValueQuery = this.batchRepository
            .createQueryBuilder('batch')
            .select('SUM(batch.current_quantity * batch.unit_cost)', 'total_value')
            .where('batch.current_quantity > 0');

        if (facilityId) {
            inventoryValueQuery.andWhere('batch.facility_id = :facilityId', { facilityId });
        } else {
            inventoryValueQuery.andWhere('batch.organization_id = :organizationId', { organizationId });
        }
        const totalInventoryValue = parseFloat((await inventoryValueQuery.getRawOne())?.total_value || '0');

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayMedicinesQuery = this.stockRepository
            .createQueryBuilder('stock')
            .select('COUNT(DISTINCT stock.medicine_id)', 'count')
            .where('stock.quantity > 0');

        if (facilityId) {
            yesterdayMedicinesQuery.andWhere('stock.facility_id = :facilityId', { facilityId });
        } else {
            yesterdayMedicinesQuery.andWhere('stock.organization_id = :organizationId', { organizationId });
        }

        const yesterdayMedicines = parseInt((await yesterdayMedicinesQuery.getRawOne())?.count || '0');
        const medicinesTrend = medicinesInStock - yesterdayMedicines;
        const medicinesTrendPercent =
            yesterdayMedicines > 0 ? ((medicinesTrend / yesterdayMedicines) * 100).toFixed(1) : '0';

        const yesterdayLowStockQuery = this.alertRepository
            .createQueryBuilder('alert')
            .where("alert.alert_type = 'low_stock'")
            .andWhere("alert.status = 'active'")
            .andWhere('alert.created_at < :today', { today });

        if (facilityId) {
            yesterdayLowStockQuery.andWhere('alert.facility_id = :facilityId', { facilityId });
        } else {
            yesterdayLowStockQuery.andWhere('alert.organization_id = :organizationId', { organizationId });
        }

        const yesterdayLowStock = await yesterdayLowStockQuery.getCount();
        const lowStockTrend = lowStockWarning - yesterdayLowStock;
        const lowStockTrendPercent =
            yesterdayLowStock > 0 ? ((lowStockTrend / yesterdayLowStock) * 100).toFixed(1) : '0';

        const yesterdayExpiryThreshold = new Date(expiryThreshold);
        yesterdayExpiryThreshold.setDate(yesterdayExpiryThreshold.getDate() - 1);

        const yesterdayExpiringQuery = this.batchRepository
            .createQueryBuilder('batch')
            .where('batch.expiry_date <= :yesterdayExpiryThreshold', {
                yesterdayExpiryThreshold,
            })
            .andWhere('batch.expiry_date >= :yesterday', { yesterday: yesterday })
            .andWhere('batch.current_quantity > 0');

        if (facilityId) {
            yesterdayExpiringQuery.andWhere('batch.facility_id = :facilityId', { facilityId });
        } else {
            yesterdayExpiringQuery.andWhere('batch.organization_id = :organizationId', { organizationId });
        }

        const yesterdayExpiring = await yesterdayExpiringQuery.getCount();
        const expiringTrend = expiringSoon - yesterdayExpiring;
        const expiringTrendPercent =
            yesterdayExpiring > 0 ? ((expiringTrend / yesterdayExpiring) * 100).toFixed(1) : '0';

        const yesterdaySalesQuery = this.dispenseRepository
            .createQueryBuilder('dispense')
            .select('COALESCE(SUM(dispense.total_amount), 0)', 'total')
            .where('dispense.created_at >= :yesterday', { yesterday })
            .andWhere('dispense.created_at < :today', { today });

        if (facilityId) {
            yesterdaySalesQuery.andWhere('dispense.facility_id = :facilityId', { facilityId });
        } else {
            yesterdaySalesQuery.andWhere('dispense.organization_id = :organizationId', { organizationId });
        }

        const yesterdaySalesResult = await yesterdaySalesQuery.getRawOne();
        const yesterdayDispenseSales = parseFloat(yesterdaySalesResult?.total || '0');

        const yesterdaySaleQuery = this.saleRepository
            .createQueryBuilder('sale')
            .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
            .where('sale.created_at >= :yesterday', { yesterday })
            .andWhere('sale.created_at < :today', { today })
            .andWhere('sale.status != :voided', { voided: 'voided' });

        if (facilityId) {
            yesterdaySaleQuery.andWhere('sale.facility_id = :facilityId', { facilityId });
        } else {
            yesterdaySaleQuery.andWhere('sale.organization_id = :organizationId', { organizationId });
        }
        const yesterdaySaleRecords = parseFloat((await yesterdaySaleQuery.getRawOne())?.total || '0');

        const yesterdaySales = yesterdayDispenseSales + yesterdaySaleRecords;

        const salesTrend = dailySales - yesterdaySales;
        const salesTrendPercent = yesterdaySales > 0 ? ((salesTrend / yesterdaySales) * 100).toFixed(1) : '0';

        return {
            medicinesInStock,
            lowStockWarning,
            expiringSoon,
            dailySales,
            totalSalesAllTime,
            totalInventoryValue,
            trends: {
                medicines: medicinesTrend >= 0 ? `+${medicinesTrendPercent}%` : `${medicinesTrendPercent}%`,
                lowStock: lowStockTrend >= 0 ? `+${lowStockTrendPercent}%` : `${lowStockTrendPercent}%`,
                expiring: expiringTrend >= 0 ? `+${expiringTrendPercent}%` : `${expiringTrendPercent}%`,
                sales: salesTrend >= 0 ? `+${salesTrendPercent}%` : `${salesTrendPercent}%`,
            },
            isPositive: {
                medicines: medicinesTrend >= 0,
                lowStock: lowStockTrend < 0,
                expiring: expiringTrend < 0,
                sales: salesTrend >= 0,
            },
        };
    }
}
