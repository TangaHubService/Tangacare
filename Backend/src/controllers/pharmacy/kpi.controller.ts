import { Request, Response } from 'express';
import { KPIService } from '../../services/pharmacy/kpi.service';
import { ReportingService } from '../../services/pharmacy/reporting.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId } from '../../utils/request.util';

export class KPIController {
    private kpiService: KPIService;
    private reportingService: ReportingService;

    constructor() {
        this.kpiService = new KPIService();
        this.reportingService = new ReportingService();
    }

    getComprehensiveKPIs = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const scope = (req as any).scope;
            const organizationId = scope?.organizationId as number | undefined;

            if (!facilityId && !organizationId) {
                ResponseUtil.badRequest(res, 'Facility ID or Organization ID is required');
                return;
            }

            const startDate = req.query.start_date as string;
            const endDate = req.query.end_date as string;

            if (!startDate || !endDate) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const kpis = await this.kpiService.getComprehensiveKPIs(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, kpis, 'KPIs retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve comprehensive KPIs', error.message);
        }
    };

    getInventoryKPIs = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const kpis = await this.kpiService.getInventoryKPIs(facilityId);
            ResponseUtil.success(res, kpis, 'Inventory KPIs retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve inventory KPIs', error.message);
        }
    };

    getFinancialKPIs = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const startDate = req.query.start_date as string;
            const endDate = req.query.end_date as string;

            if (!startDate || !endDate) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const kpis = await this.kpiService.getFinancialKPIs(facilityId, startDate, endDate);
            ResponseUtil.success(res, kpis, 'Financial KPIs retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve financial KPIs', error.message);
        }
    };

    getOperationalKPIs = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const startDate = req.query.start_date as string;
            const endDate = req.query.end_date as string;

            if (!startDate || !endDate) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const kpis = await this.kpiService.getOperationalKPIs(facilityId, startDate, endDate);
            ResponseUtil.success(res, kpis, 'Operational KPIs retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve operational KPIs', error.message);
        }
    };

    getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const scope = (req as any).scope;
            const organizationId = scope?.organizationId as number | undefined;

            if (!facilityId && !organizationId) {
                ResponseUtil.badRequest(res, 'Facility ID or Organization ID is required');
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

            const [todayKpis, monthKpis] = await Promise.all([
                this.kpiService.getComprehensiveKPIs(facilityId, today, today, organizationId),
                this.kpiService.getComprehensiveKPIs(facilityId, startOfMonthStr, today, organizationId),
            ]);

            const [topMeds, categories, payments, expiryRisk, salesTrend, insuranceSummary] = await Promise.all([
                this.reportingService.getTopMedicinesByRevenue(facilityId, startOfMonthStr, today, organizationId),
                this.reportingService.getCategoryPerformance(facilityId, startOfMonthStr, today, organizationId),
                this.reportingService.getPaymentMethodSummary(facilityId, startOfMonthStr, today, organizationId),
                this.reportingService.getExpiryRiskBuckets(facilityId, organizationId),
                this.reportingService.getSalesTrends(facilityId, thirtyDaysAgoStr, today, organizationId),
                this.reportingService.getInsuranceDashboardSummary(
                    facilityId,
                    startOfMonthStr,
                    today,
                    organizationId,
                ),
            ]);

            ResponseUtil.success(
                res,
                {
                    today: todayKpis,
                    month: monthKpis,
                    top_medicines: topMeds,
                    categories,
                    payments,
                    expiry_risk: expiryRisk,
                    sales_trend: salesTrend,
                    insurance: insuranceSummary,
                },
                'Dashboard summary retrieved successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve dashboard summary', error.message);
        }
    };
}
