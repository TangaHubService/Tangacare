import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { ReportingService } from '../../services/pharmacy/reporting.service';
import { DispensingService } from '../../services/pharmacy/dispensing.service';
import { FacilityService } from '../../services/pharmacy/facility.service';
import { AlertService } from '../../services/pharmacy/alert.service';
import { ResponseUtil } from '../../utils/response.util';
import { User, UserRole } from '../../entities/User.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { StatsService } from '../../services/pharmacy/stats.service';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

function buildDailySalesChart(
    dailySales: Array<{ date: string; sales: number }>,
    days: number,
): Array<{ date: string; sales: number }> {
    const map = new Map<string, number>();
    for (const d of dailySales) {
        map.set(d.date, (map.get(d.date) || 0) + d.sales);
    }
    const result: Array<{ date: string; sales: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        result.push({ date: dateStr, sales: map.get(dateStr) || 0 });
    }
    return result;
}

export class DashboardController {
    private statsService: StatsService;
    private reportingService: ReportingService;
    private dispensingService: DispensingService;
    private facilityService: FacilityService;
    private alertService: AlertService;

    constructor() {
        this.statsService = new StatsService();
        this.reportingService = new ReportingService();
        this.dispensingService = new DispensingService();
        this.facilityService = new FacilityService();
        this.alertService = new AlertService();
    }

    private async getStaffCount(facilityId?: number, organizationId?: number, role?: string): Promise<number> {
        const qb = AppDataSource.getRepository(User).createQueryBuilder('u').where('u.deleted_at IS NULL');
        if (facilityId) {
            qb.andWhere('u.facility_id = :facilityId', { facilityId });
        } else if (role === UserRole.OWNER && organizationId) {
            qb.andWhere('u.organization_id = :organizationId', { organizationId });
        } else {
            return 0;
        }
        return qb.getCount();
    }

    private async getActiveAlertsCount(facilityIds: number[], organizationId?: number): Promise<number> {
        if (facilityIds.length === 0 || !organizationId) return 0;
        let total = 0;
        for (const fid of facilityIds) {
            const stats = await this.alertService.getAlertStats(fid, organizationId);
            total += stats.total;
        }
        return total;
    }

    getStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const role = user?.role;

            if (facilityId) {
                if (!organizationId) {
                    ResponseUtil.error(res, 'Organization context missing', 400);
                    return;
                }
                const results = await Promise.all([
                    this.statsService.getDashboardStats(organizationId, facilityId),
                    this.getStaffCount(facilityId, undefined, role),
                    this.getActiveAlertsCount([facilityId], organizationId),
                    this.reportingService.getSalesReport(
                        facilityId,
                        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                        new Date(),
                        organizationId,
                    ),
                ]);

                const [stats, staffCount, activeAlertsCount, salesReport] = results;
                const dailySalesChart = buildDailySalesChart(salesReport.daily_sales, 14);

                const data = {
                    ...stats,
                    dailySales: String(Math.round(stats.dailySales)),
                    totalSalesAllTime: Math.round(stats.totalSalesAllTime),
                    dailySalesChart,
                    staffCount,
                    activeAlertsCount,
                };
                ResponseUtil.success(res, data, 'Dashboard stats retrieved successfully');
                return;
            }

            if (role === UserRole.OWNER && organizationId) {
                const facilities = await this.facilityService.findByOrganizationId(organizationId);
                if (facilities.length === 0) {
                    const emptyData = {
                        medicinesInStock: '0',
                        lowStockWarning: 0,
                        expiringSoon: 0,
                        dailySales: '0',
                        dailySalesChart: buildDailySalesChart([], 14),
                        staffCount: 0,
                        activeAlertsCount: 0,
                        trends: { medicines: '0%', lowStock: '0%', expiring: '0%', sales: '0%' },
                        isPositive: { medicines: true, lowStock: true, expiring: false, sales: true },
                    };
                    ResponseUtil.success(res, emptyData, 'Dashboard stats (no facilities in organization)');
                    return;
                }
                const endDate = new Date();
                const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
                let totalMedicines = 0;
                let lowStockCount = 0;
                let expiringBatchesCount = 0;
                const dailySalesByDate = new Map<string, number>();
                for (const fac of facilities) {
                    const stockReport = await this.reportingService.getStockReport(fac.id, organizationId);
                    totalMedicines += stockReport.total_medicines;
                    lowStockCount += stockReport.low_stock_count;
                    expiringBatchesCount += stockReport.expiring_batches_count;
                    const salesReport = await this.reportingService.getSalesReport(
                        fac.id,
                        startDate,
                        endDate,
                        organizationId,
                    );
                    for (const day of salesReport.daily_sales) {
                        const cur = dailySalesByDate.get(day.date) || 0;
                        dailySalesByDate.set(day.date, cur + day.sales);
                    }
                }
                const chartEntries = Array.from(dailySalesByDate.entries()).map(([date, sales]) => ({
                    date,
                    sales,
                }));
                const dailySalesChart = buildDailySalesChart(chartEntries, 14);
                const sortedDates = Array.from(dailySalesByDate.keys()).sort();
                const lastDate = sortedDates[sortedDates.length - 1];
                const dailySales = lastDate ? dailySalesByDate.get(lastDate) || 0 : 0;
                const facilityIds = facilities.map((f) => f.id);
                const staffCount = await this.getStaffCount(undefined, organizationId, role);
                const activeAlertsCount = await this.getActiveAlertsCount(facilityIds, organizationId);
                const totalSalesAllTime = await this.reportingService.getTotalSalesAllTime(undefined, organizationId);
                const data = {
                    medicinesInStock: String(totalMedicines),
                    lowStockWarning: lowStockCount,
                    expiringSoon: expiringBatchesCount,
                    dailySales: String(Math.round(dailySales)),
                    totalSalesAllTime: Math.round(totalSalesAllTime),
                    dailySalesChart,
                    staffCount,
                    activeAlertsCount,
                    trends: { medicines: '0%', lowStock: '0%', expiring: '0%', sales: '0%' },
                    isPositive: { medicines: true, lowStock: true, expiring: false, sales: true },
                };
                ResponseUtil.success(res, data, 'Dashboard stats retrieved successfully (all facilities)');
                return;
            }

            const emptyData = {
                medicinesInStock: '0',
                lowStockWarning: 0,
                expiringSoon: 0,
                dailySales: '0',
                totalSalesAllTime: 0,
                dailySalesChart: buildDailySalesChart([], 14),
                staffCount: 0,
                activeAlertsCount: 0,
                trends: { medicines: '0%', lowStock: '0%', expiring: '0%', sales: '0%' },
                isPositive: { medicines: true, lowStock: true, expiring: false, sales: true },
            };
            ResponseUtil.success(res, emptyData, 'Dashboard stats (no facility selected)');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate dashboard stats', error.message);
        }
    };

    getTransactions = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const role = user?.role;

            if (facilityId) {
                const { data } = await this.dispensingService.findAll(facilityId, organizationId, undefined, 1, 10);
                const transactions = data.map((t) => ({
                    id: String(t.id),
                    name: t.medicine?.name || `Medicine ${t.medicine_id}`,
                    category: t.dispense_type,
                    qty: String(t.quantity),
                    status: 'Completed',
                    date: t.created_at?.toISOString?.() || new Date(t.created_at as any).toISOString(),
                    sku: t.medicine?.code || '',
                }));
                ResponseUtil.success(res, transactions, 'Recent transactions retrieved successfully');
                return;
            }

            if (role === UserRole.OWNER && organizationId) {
                const facilityIds = (await this.facilityService.findByOrganizationId(organizationId)).map((f) => f.id);
                if (facilityIds.length === 0) {
                    ResponseUtil.success(res, [], 'Recent transactions (no facilities in organization)');
                    return;
                }
                const { data } = await this.dispensingService.findAllByFacilityIds(facilityIds, organizationId, 1, 10);
                const transactions = data.map((t) => ({
                    id: String(t.id),
                    name: t.medicine?.name || `Medicine ${t.medicine_id}`,
                    category: t.dispense_type,
                    qty: String(t.quantity),
                    status: 'Completed',
                    date: t.created_at?.toISOString?.() || new Date(t.created_at as any).toISOString(),
                    sku: t.medicine?.code || '',
                }));
                ResponseUtil.success(res, transactions, 'Recent transactions retrieved successfully (all facilities)');
                return;
            }

            ResponseUtil.success(res, [], 'Recent transactions (no facility selected)');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch recent transactions', error.message);
        }
    };

    getTopSellingMedicines = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            const order: 'ASC' | 'DESC' = (req.query.order as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            if (!facilityId) {
                ResponseUtil.success(res, [], 'Facility ID required');
                return;
            }

            const result = await AppDataSource.getRepository(DispenseTransaction)
                .createQueryBuilder('dt')
                .select('m.name', 'name')
                .addSelect('SUM(dt.quantity)', 'value')
                .innerJoin('dt.medicine', 'm')
                .where('dt.facility_id = :facilityId', { facilityId })
                .andWhere('dt.organization_id = :organizationId', { organizationId })
                .groupBy('m.name')
                .orderBy('SUM(dt.quantity)', order)
                .limit(5)
                .getRawMany();

            const formattedResult = result.map((item) => ({
                name: item.name,
                value: parseFloat(item.value),
            }));

            ResponseUtil.success(
                res,
                formattedResult,
                `${order === 'DESC' ? 'Top' : 'Lowest'} selling medicines retrieved successfully`,
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch selling medicines', error.message);
        }
    };

    getInventoryStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId) {
                ResponseUtil.error(res, 'Facility context required', 400);
                return;
            }
            const data = await this.reportingService.getInventoryStatus(facilityId, organizationId);
            ResponseUtil.success(res, data, 'Inventory status retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch inventory status', error.message);
        }
    };

    getConsumptionTrends = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId) {
                ResponseUtil.error(res, 'Facility context required', 400);
                return;
            }
            const days = req.query.days ? parseInt(String(req.query.days)) : 30;
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const data = await this.reportingService.getConsumptionTrends(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, data, 'Consumption trends retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch consumption trends', error.message);
        }
    };

    getExpiryRisk = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId) {
                ResponseUtil.error(res, 'Facility context required', 400);
                return;
            }
            const days = req.query.days ? parseInt(String(req.query.days)) : 90;
            const data = await this.reportingService.getExpiryReport(facilityId, days, organizationId);
            ResponseUtil.success(res, data, 'Expiry risk report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to fetch expiry risk', error.message);
        }
    };
}
