import { Request, Response } from 'express';
import { AppError } from '../../middleware/error.middleware';
import { ReportingService } from '../../services/pharmacy/reporting.service';
import { ReportingExportDatasetService } from '../../services/pharmacy/reporting-export-dataset.service';
import { ExportService } from '../../services/pharmacy/export.service';
import { IntelligenceService } from '../../services/pharmacy/intelligence.service';
import { ParService } from '../../services/pharmacy/par.service';
import { AuditService } from '../../services/pharmacy/audit.service';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

export class ReportingController {
    private reportingService: ReportingService;
    private exportService: ExportService;
    private intelligenceService: IntelligenceService;
    private parService: ParService;
    private auditService: AuditService;
    private exportDatasetService: ReportingExportDatasetService;

    constructor() {
        this.reportingService = new ReportingService();
        this.exportService = new ExportService();
        this.intelligenceService = new IntelligenceService();
        this.parService = new ParService();
        this.auditService = new AuditService();
        this.exportDatasetService = new ReportingExportDatasetService(
            this.reportingService,
            this.intelligenceService,
            this.parService,
            this.auditService,
        );
    }

    private requireOrganizationId(req: Request, res: Response): number | null {
        const organizationId = resolveOrganizationId(req);
        if (!organizationId) {
            ResponseUtil.badRequest(res, 'Organization context is required');
            return null;
        }

        return organizationId;
    }

    getSalesSummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = resolveOrganizationId(req);
            const summaryOnly =
                req.query.summary_only === 'true' || req.query.include_transactions === 'false';
            const result = await this.reportingService.getSalesSummaryReport(
                facilityId,
                startDate,
                endDate,
                organizationId,
                { includeTransactions: !summaryOnly },
            );
            ResponseUtil.success(res, result, 'Sales summary report retrieved successfully');
        } catch (error: any) {
            if (error instanceof AppError) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to generate sales summary report', error.message);
        }
    };

    getLowStock = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getLowStockReport(facilityId, organizationId);
            ResponseUtil.success(res, result, 'Low stock report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate low stock report', error.message);
        }
    };

    getExpiryReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const requestedDays = req.query.days ? Number(req.query.days) : 30;
            const allowedDays = [30, 60, 90];
            const days = allowedDays.includes(requestedDays) ? requestedDays : 30;
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getExpiryReport(facilityId, days, organizationId);
            ResponseUtil.success(res, result, 'Expiry report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate expiry report', error.message);
        }
    };

    getBatchStockReconciliation = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getBatchStockReconciliation(
                facilityId,
                organizationId ?? undefined,
            );
            ResponseUtil.success(res, result, 'Batch vs stock reconciliation retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to build batch stock reconciliation', error.message);
        }
    };

    getDailyCash = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { date } = req.query;
            if (!date) {
                ResponseUtil.badRequest(res, 'Date is required');
                return;
            }

            const reportDate = new Date(date as string);
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getDailyCashReport(facilityId, reportDate, organizationId);
            ResponseUtil.success(res, result, 'Daily cash report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate daily cash report', error.message);
        }
    };

    getControlledDrugsPeriodReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = this.requireOrganizationId(req, res);
            if (organizationId === null) {
                return;
            }

            let startDate: Date;
            let endDate: Date;
            const { start_date, end_date } = req.query;
            if (start_date && end_date) {
                startDate = new Date(start_date as string);
                endDate = new Date(end_date as string);
                endDate.setHours(23, 59, 59, 999);
            } else {
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 29);
                startDate.setHours(0, 0, 0, 0);
            }

            const result = await this.reportingService.getControlledDrugsRegisterReport(
                facilityId,
                startDate,
                endDate,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Controlled drugs period report retrieved successfully');
        } catch (error: any) {
            if (error instanceof AppError) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to generate controlled drugs period report', error.message);
        }
    };

    getControlledDrugRegister = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { medicineId } = req.params;
            if (!medicineId) {
                ResponseUtil.badRequest(res, 'Medicine ID is required');
                return;
            }

            const organizationId = this.requireOrganizationId(req, res);
            if (organizationId === null) {
                return;
            }

            const result = await this.reportingService.getControlledDrugRegister(
                facilityId,
                Number(medicineId),
                organizationId,
            );
            ResponseUtil.success(res, result, 'Controlled drug register retrieved successfully');
        } catch (error: any) {
            if (error instanceof AppError) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to generate controlled drug register', error.message);
        }
    };

    getTaxSummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getTaxSummary(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, result, 'Tax summary report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate tax summary report', error.message);
        }
    };

    getCustomerLoyaltyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getCustomerLoyaltyReport(facilityId, organizationId);
            ResponseUtil.success(res, result, 'Customer loyalty report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate customer loyalty report', error.message);
        }
    };

    getEmployeePerformanceReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const startDate = new Date(
                (req.query.start_date as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            );
            const endDate = new Date((req.query.end_date as string) || new Date().toISOString());
            if (req.query.end_date) {
                endDate.setHours(23, 59, 59, 999);
            }

            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getEmployeePerformanceReport(
                facilityId,
                startDate,
                endDate,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Employee performance report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate employee performance report', error.message);
        }
    };

    getVendorReturnsReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getVendorReturnsReport(facilityId, organizationId);
            ResponseUtil.success(res, result, 'Vendor returns report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate vendor returns report', error.message);
        }
    };

    getBatchTraceability = async (req: Request, res: Response): Promise<void> => {
        try {
            const batchId = parseInt(req.params.batchId, 10);
            if (isNaN(batchId)) {
                ResponseUtil.badRequest(res, 'Batch ID is required and must be a number');
                return;
            }
            const organizationId = resolveOrganizationId(req);
            const facilityId = resolveFacilityId(req);
            const result = await this.reportingService.getBatchTraceability(batchId, organizationId, facilityId);
            ResponseUtil.success(res, result, 'Batch traceability report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate batch traceability report', error.message);
        }
    };

    getDailySalesReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getDailySalesReport(facilityId, date, organizationId);
            ResponseUtil.success(res, result, 'Daily sales report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate daily sales report', error.message);
        }
    };

    getMonthlySalesReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const year = parseInt(req.query.year as string) || new Date().getFullYear();
            const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getMonthlySalesReport(facilityId, year, month, organizationId);
            ResponseUtil.success(res, result, 'Monthly sales report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate monthly sales report', error.message);
        }
    };

    getSalesByMedicine = async (req: Request, res: Response): Promise<void> => {
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
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getSalesByMedicine(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, result, 'Sales by medicine report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate sales by medicine report', error.message);
        }
    };

    getSalesByCategory = async (req: Request, res: Response): Promise<void> => {
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
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getSalesByCategory(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, result, 'Sales by category report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate sales by category report', error.message);
        }
    };

    getSalesByCashier = async (req: Request, res: Response): Promise<void> => {
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
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getSalesByCashier(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, result, 'Sales by cashier report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate sales by cashier report', error.message);
        }
    };

    getPaymentMethodSummary = async (req: Request, res: Response): Promise<void> => {
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
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getPaymentMethodSummary(
                facilityId,
                startDate,
                endDate,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Payment method summary retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate payment method summary', error.message);
        }
    };

    getGrossVsNetSales = async (req: Request, res: Response): Promise<void> => {
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
            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getGrossVsNetSales(facilityId, startDate, endDate, organizationId);
            ResponseUtil.success(res, result, 'Gross vs net sales report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate gross vs net sales report', error.message);
        }
    };

    getStockRegister = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date, page, limit } = req.query;

            const startDate = start_date ? new Date(start_date as string) : undefined;
            const endDate = end_date ? new Date(end_date as string) : undefined;
            if (endDate) {
                endDate.setHours(23, 59, 59, 999);
            }
            const pageNum = page ? Number(page) : 1;
            const limitNum = limit ? Number(limit) : 100;

            const result = await this.reportingService.getStockRegisterReport(
                facilityId,
                startDate,
                endDate,
                pageNum,
                limitNum,
            );
            ResponseUtil.success(res, result, 'Stock register retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate stock register', error.message);
        }
    };

    getPurchaseHistory = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = resolveOrganizationId(req);
            const result = await this.reportingService.getPurchaseHistoryReport(
                facilityId,
                startDate,
                endDate,
                organizationId,
            );
            ResponseUtil.success(res, result, 'Purchase history report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate purchase history report', error.message);
        }
    };

    getProfitReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getProfitReport(facilityId, organizationId, startDate, endDate);
            ResponseUtil.success(res, result, 'Profit report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate profit report', error.message);
        }
    };

    getPurchaseReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getPurchaseReport(
                facilityId,
                organizationId,
                startDate,
                endDate,
            );
            ResponseUtil.success(res, result, 'Purchase report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate purchase report', error.message);
        }
    };

    getDeadStockReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const days = req.query.days ? Number(req.query.days) : 90;
            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getDeadStockReport(facilityId, organizationId, days);
            ResponseUtil.success(res, result, 'Dead stock report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate dead stock report', error.message);
        }
    };

    getInventoryAgingReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const asOfDate = req.query.as_of_date ? new Date(req.query.as_of_date as string) : undefined;
            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getInventoryAgingReport(facilityId, organizationId, asOfDate);
            ResponseUtil.success(res, result, 'Inventory aging report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate inventory aging report', error.message);
        }
    };

    getPurchaseVsSalesReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getPurchaseVsSalesReport(
                facilityId,
                organizationId,
                startDate,
                endDate,
            );
            ResponseUtil.success(res, result, 'Purchase vs sales report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate purchase vs sales report', error.message);
        }
    };

    getMedicineMarginReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const { start_date, end_date } = req.query;
            if (!start_date || !end_date) {
                ResponseUtil.badRequest(res, 'Start date and end date are required');
                return;
            }

            const startDate = new Date(start_date as string);
            const endDate = new Date(end_date as string);
            endDate.setHours(23, 59, 59, 999);

            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getMedicineMarginReport(
                facilityId,
                organizationId,
                startDate,
                endDate,
            );
            ResponseUtil.success(res, result, 'Medicine margin report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate medicine margin report', error.message);
        }
    };

    getStockReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }
            const result = await this.reportingService.getStockReport(facilityId, organizationId);
            ResponseUtil.success(res, result, 'Stock report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate stock report', error.message);
        }
    };

    exportReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }

            const { type, format } = req.params;
            const { data, columns, title, fileName } = await this.exportDatasetService.build(
                type,
                facilityId,
                organizationId,
                req.query,
            );

            if (format === 'excel') {
                await this.exportService.exportToExcel(res, columns, data, fileName, title);
            } else if (format === 'pdf') {
                await this.exportService.exportToPdf(res, columns, data, fileName, title);
            } else {
                ResponseUtil.badRequest(res, 'Invalid export format');
            }
        } catch (error: any) {
            console.error('Export Error:', error);
            if (error instanceof AppError) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to export report', error.message);
        }
    };

    /** CSV export of controlled-medicine register lines (inspectors expect tabular register, not raw audit JSON). */
    exportControlledMedicineRegisterCsv = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }
            const organizationId = this.requireOrganizationId(req, res);
            if (!organizationId) {
                return;
            }

            let startDate: Date;
            let endDate: Date;
            const { start_date, end_date } = req.query;
            if (start_date && end_date) {
                startDate = new Date(start_date as string);
                endDate = new Date(end_date as string);
                endDate.setHours(23, 59, 59, 999);
            } else {
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 29);
                startDate.setHours(0, 0, 0, 0);
            }

            const result = await this.reportingService.getControlledDrugsRegisterReport(
                facilityId,
                startDate,
                endDate,
                organizationId,
            );

            const headers = [
                'sale_id',
                'sale_number',
                'date',
                'medicine_name',
                'drug_schedule',
                'batch_number',
                'quantity',
                'prescription_id',
                'patient_id_number',
                'patient_name',
                'cashier_name',
            ];
            const escape = (v: unknown) => {
                const s = v === null || v === undefined ? '' : String(v);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            };
            const lines = [headers.join(',')];
            for (const row of result.transactions) {
                lines.push(
                    [
                        escape(row.sale_id),
                        escape(row.sale_number),
                        escape(row.date),
                        escape(row.medicine_name),
                        escape((row as any).drug_schedule),
                        escape(row.batch_number),
                        escape(row.quantity),
                        escape((row as any).prescription_id),
                        escape((row as any).patient_id_number),
                        escape(row.patient_name),
                        escape(row.cashier_name),
                    ].join(','),
                );
            }

            const fname = `controlled_medicine_register_${facilityId}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
            res.status(200).send(lines.join('\n'));
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to export controlled medicine register', error.message);
        }
    };
}
