import { AppError } from '../../middleware/error.middleware';
import { ExportColumn } from './export.service';
import { ReportingService } from './reporting.service';
import { IntelligenceService } from './intelligence.service';
import { ParService } from './par.service';
import { AuditService } from './audit.service';
import { ParReplenishmentTaskStatus } from '../../entities/ParLevel.entity';
import type { ParsedQs } from 'qs';

export interface ReportingExportDataset {
    data: Record<string, unknown>[];
    columns: ExportColumn[];
    title: string;
    fileName: string;
}

export class ReportingExportDatasetService {
    constructor(
        private readonly reportingService: ReportingService,
        private readonly intelligenceService: IntelligenceService,
        private readonly parService: ParService,
        private readonly auditService: AuditService,
    ) {}

    async build(
        type: string,
        facilityId: number,
        organizationId: number,
        query: ParsedQs,
    ): Promise<ReportingExportDataset> {
        const { start_date, end_date, as_of_date, days, horizon_days, history_days, status } = query;

        let data: any[] = [];
        let columns: ExportColumn[] = [];
        let title = '';
        let fileName = '';

        switch (type) {
            case 'sales': {
                const startDate = new Date(start_date as string);
                const endDate = new Date(end_date as string);
                endDate.setHours(23, 59, 59, 999);
                const result = await this.reportingService.getSalesSummaryReport(
                    facilityId,
                    startDate,
                    endDate,
                    organizationId,
                );
                data = result.transactions || [];
                title = 'Sales Summary Report';
                fileName = `sales_report_${start_date}_${end_date}`;
                columns = [
                    { header: 'Date', key: 'sale_date' },
                    { header: 'Receipt #', key: 'receipt_number' },
                    { header: 'Item', key: 'medicine_name' },
                    { header: 'Qty', key: 'quantity_sold' },
                    { header: 'Total', key: 'total_price' },
                ];
                break;
            }
            case 'stock': {
                data = await this.reportingService.getDetailedStockReport(facilityId, organizationId);
                title = 'Pharmacy Stock Report';
                fileName = `stock_report_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Brand', key: 'brand_name' },
                    { header: 'Category', key: 'category' },
                    { header: 'In Stock', key: 'current_quantity' },
                    { header: 'Min Level', key: 'min_stock_level' },
                ];
                break;
            }
            case 'expiry': {
                const expiryDays = days ? Number(days) : 30;
                const result = await this.reportingService.getExpiryReport(facilityId, expiryDays, organizationId);
                data = [
                    ...(result.expiring_soon || []).map((item) => ({
                        ...item,
                        batch_status: 'Expiring Soon',
                    })),
                    ...(result.expired || []).map((item) => ({
                        ...item,
                        days_until_expiry: 0,
                        batch_status: 'Expired',
                    })),
                ];
                title = `Expiry Analysis Report (${expiryDays} Days)`;
                fileName = `expiry_report_${expiryDays}d`;
                columns = [
                    { header: 'Status', key: 'batch_status' },
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Batch #', key: 'batch_number' },
                    { header: 'Expiry Date', key: 'expiry_date' },
                    { header: 'Qty', key: 'quantity' },
                    { header: 'Days Left', key: 'days_until_expiry' },
                    { header: 'Risk Level', key: 'risk_level' },
                    { header: 'Recommended Action', key: 'recommended_action' },
                ];
                break;
            }
            case 'low-stock': {
                const result = await this.reportingService.getLowStockReport(facilityId, organizationId);
                data = result.items || [];
                title = 'Low Stock & Reorder Report';
                fileName = 'low_stock_report';
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Status', key: 'status' },
                    { header: 'Current Qty', key: 'current_quantity' },
                    { header: 'Min Level', key: 'min_stock_level' },
                    { header: 'Reorder Point', key: 'reorder_point' },
                    { header: 'Daily Consumption', key: 'avg_daily_consumption' },
                    { header: 'Days Of Cover', key: 'days_of_cover' },
                    { header: 'Deficit Qty', key: 'deficit_quantity' },
                    { header: 'Recommended Action', key: 'recommended_action' },
                ];
                break;
            }
            case 'purchase': {
                const startDate = new Date(start_date as string);
                const endDate = new Date(end_date as string);
                endDate.setHours(23, 59, 59, 999);
                const result = await this.reportingService.getPurchaseReport(
                    facilityId,
                    organizationId,
                    startDate,
                    endDate,
                );
                data = result.orders || [];
                title = 'Purchase Report';
                fileName = `purchase_report_${start_date}_${end_date}`;
                columns = [
                    { header: 'Order #', key: 'order_number' },
                    { header: 'Supplier', key: 'supplier_name' },
                    { header: 'Date', key: 'date' },
                    { header: 'Status', key: 'status' },
                    { header: 'Total Amount', key: 'total_amount' },
                ];
                break;
            }
            case 'inventory-aging': {
                const asOfDate = as_of_date ? new Date(as_of_date as string) : undefined;
                const result = await this.reportingService.getInventoryAgingReport(
                    facilityId,
                    organizationId,
                    asOfDate,
                );
                data = result.items || [];
                title = 'Inventory Aging Report';
                fileName = `inventory_aging_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Batch #', key: 'batch_number' },
                    { header: 'Age (days)', key: 'age_days' },
                    { header: 'Quantity', key: 'quantity' },
                    { header: 'Inventory Value', key: 'inventory_value' },
                    { header: 'Bucket', key: 'bucket' },
                ];
                break;
            }
            case 'purchase-vs-sales': {
                const startDate = new Date(start_date as string);
                const endDate = new Date(end_date as string);
                endDate.setHours(23, 59, 59, 999);
                const result = await this.reportingService.getPurchaseVsSalesReport(
                    facilityId,
                    organizationId,
                    startDate,
                    endDate,
                );
                data = result.timeline || [];
                title = 'Purchase vs Sales Report';
                fileName = `purchase_vs_sales_${start_date}_${end_date}`;
                columns = [
                    { header: 'Date', key: 'date' },
                    { header: 'Purchase Amount', key: 'purchase_amount' },
                    { header: 'Sales Amount', key: 'sales_amount' },
                    { header: 'Variance', key: 'variance_amount' },
                ];
                break;
            }
            case 'medicine-margin': {
                const startDate = new Date(start_date as string);
                const endDate = new Date(end_date as string);
                endDate.setHours(23, 59, 59, 999);
                const result = await this.reportingService.getMedicineMarginReport(
                    facilityId,
                    organizationId,
                    startDate,
                    endDate,
                );
                data = result.items || [];
                title = 'Medicine Margin Report';
                fileName = `medicine_margin_${start_date}_${end_date}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Quantity Sold', key: 'quantity_sold' },
                    { header: 'Revenue', key: 'revenue' },
                    { header: 'COGS', key: 'cogs' },
                    { header: 'Profit', key: 'profit' },
                    { header: 'Margin (%)', key: 'profit_margin_percent' },
                ];
                break;
            }
            case 'movement': {
                const startDate = start_date ? new Date(start_date as string) : undefined;
                const endDate = end_date ? new Date(end_date as string) : undefined;
                if (endDate) {
                    endDate.setHours(23, 59, 59, 999);
                }
                const result = await this.reportingService.getStockRegisterReport(
                    facilityId,
                    startDate,
                    endDate,
                    1,
                    5000,
                );
                data = (result.data || []).map((row: any) => ({
                    date: row.created_at ? new Date(row.created_at).toISOString() : '',
                    movement_type: row.movement_type,
                    medicine_name: row.entity_name || '',
                    reference: row.reference || '',
                    performed_by: row.user_name || '',
                    quantity_change: Number(row.quantity_delta || 0),
                    quantity_before: Number(row.old_values?.quantity || 0),
                    quantity_after: Number(row.new_values?.quantity || 0),
                    description: row.description || '',
                }));
                title = 'Stock Movement Report';
                fileName = `stock_movement_report_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Date', key: 'date', width: 18 },
                    { header: 'Movement Type', key: 'movement_type', width: 16 },
                    { header: 'Medicine', key: 'medicine_name', width: 22 },
                    { header: 'Reference', key: 'reference', width: 16 },
                    { header: 'Performed By', key: 'performed_by', width: 16 },
                    { header: 'Quantity Change', key: 'quantity_change', width: 14 },
                    { header: 'Quantity Before', key: 'quantity_before', width: 14 },
                    { header: 'Quantity After', key: 'quantity_after', width: 14 },
                    { header: 'Description', key: 'description', width: 30 },
                ];
                break;
            }
            case 'fast-moving': {
                const lookbackDays = days ? Number(days) : 90;
                const result = await this.intelligenceService.getVelocitySegmentation(facilityId, lookbackDays);
                data = result.items || [];
                title = 'Fast/Slow Moving Medicines Report';
                fileName = `fast_slow_report_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Segment', key: 'segment' },
                    { header: 'Total Demand', key: 'total_demand' },
                    { header: 'Daily Velocity', key: 'daily_velocity' },
                    { header: 'Current Stock', key: 'current_stock' },
                    { header: 'Days Of Cover', key: 'days_of_cover' },
                    { header: 'Suggested Action', key: 'suggested_action' },
                ];
                break;
            }
            case 'demand-forecast': {
                const horizon = horizon_days ? Number(horizon_days) : 30;
                const history = history_days ? Number(history_days) : 180;
                const result = await this.intelligenceService.getDemandForecast(facilityId, horizon, history);
                data = result.medicines || [];
                title = 'Demand Forecast Report';
                fileName = `demand_forecast_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Current Stock', key: 'current_stock' },
                    { header: 'Historical Daily Avg', key: 'historical_daily_average' },
                    { header: 'Forecast Total', key: 'forecast_total' },
                    { header: 'Trend', key: 'trend_direction' },
                    { header: 'Peak Weekday', key: 'peak_weekday' },
                    { header: 'Trough Weekday', key: 'trough_weekday' },
                    { header: 'Confidence Score', key: 'confidence_score' },
                    { header: 'MAPE Estimate', key: 'mape_estimate' },
                ];
                break;
            }
            case 'forecast-reorder': {
                const horizon = horizon_days ? Number(horizon_days) : 30;
                const result = await this.intelligenceService.getSmartReorderPlan(facilityId, horizon);
                data = result.items || [];
                title = 'Forecast Reorder Report';
                fileName = `forecast_reorder_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Usable Stock', key: 'usable_stock' },
                    { header: 'Forecast Demand', key: 'forecast_horizon_demand' },
                    { header: 'Safety Stock', key: 'safety_stock' },
                    { header: 'Target Stock', key: 'target_stock' },
                    { header: 'Recommended Order Qty', key: 'recommended_order_qty' },
                    { header: 'Lead Time Days', key: 'lead_time_days' },
                    { header: 'Days Of Cover', key: 'days_of_cover' },
                    { header: 'Projected Stockout Date', key: 'projected_stockout_date' },
                    { header: 'JIT Reorder By', key: 'jit_reorder_by_date' },
                    { header: 'Priority', key: 'priority' },
                    { header: 'Reason', key: 'reason' },
                ];
                break;
            }
            case 'near-expiry-actions': {
                const horizon = horizon_days ? Number(horizon_days) : days ? Number(days) : 90;
                const result = await this.intelligenceService.getNearExpiryActionPlan(facilityId, horizon);
                data = result.items || [];
                title = 'Near-Expiry Actions Report';
                fileName = `near_expiry_actions_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Batch Number', key: 'batch_number' },
                    { header: 'Days To Expiry', key: 'days_to_expiry' },
                    { header: 'Quantity', key: 'quantity' },
                    { header: 'Projected Waste Qty', key: 'projected_waste_qty' },
                    { header: 'Risk Level', key: 'risk_level' },
                    { header: 'Recommended Action', key: 'recommended_action' },
                    { header: 'Action Reason', key: 'action_reason' },
                    { header: 'Risk Value', key: 'risk_value' },
                ];
                break;
            }
            case 'par': {
                const allowedStatuses = Object.values(ParReplenishmentTaskStatus);
                const statusFilter =
                    status && allowedStatuses.includes(status as ParReplenishmentTaskStatus)
                        ? (status as ParReplenishmentTaskStatus)
                        : undefined;

                const result = await this.parService.getTasks(facilityId, { status: statusFilter });
                data = (result || []).map((task: any) => ({
                    id: task.id,
                    medicine_name: task.medicine?.name || `Medicine #${task.medicine_id}`,
                    department_name: task.department?.name || `Department #${task.department_id}`,
                    current_quantity: Number(task.current_quantity || 0),
                    target_quantity: Number(task.target_quantity || 0),
                    suggested_quantity: Number(task.suggested_quantity || 0),
                    priority: task.priority,
                    status: task.status,
                    due_at: task.due_at ? new Date(task.due_at).toISOString() : '',
                    notes: task.notes || '',
                }));
                title = 'PAR Replenishment Tasks Report';
                fileName = `par_tasks_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Task ID', key: 'id' },
                    { header: 'Medicine', key: 'medicine_name' },
                    { header: 'Department', key: 'department_name' },
                    { header: 'Current Quantity', key: 'current_quantity' },
                    { header: 'Target Quantity', key: 'target_quantity' },
                    { header: 'Suggested Quantity', key: 'suggested_quantity' },
                    { header: 'Priority', key: 'priority' },
                    { header: 'Status', key: 'status' },
                    { header: 'Due At', key: 'due_at' },
                    { header: 'Notes', key: 'notes' },
                ];
                break;
            }
            case 'performance': {
                const startDate = start_date
                    ? new Date(start_date as string)
                    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const endDate = end_date ? new Date(end_date as string) : new Date();
                endDate.setHours(23, 59, 59, 999);
                const result = await this.reportingService.getEmployeePerformanceReport(
                    facilityId,
                    startDate,
                    endDate,
                    organizationId,
                );
                data = result.performers || [];
                title = 'Employee Performance Report';
                fileName = `employee_performance_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Employee', key: 'employee_name' },
                    { header: 'Transactions', key: 'transaction_count' },
                    { header: 'Total Sales', key: 'total_sales' },
                    { header: 'Average Transaction Value', key: 'average_transaction_value' },
                ];
                break;
            }
            case 'customer': {
                const result = await this.reportingService.getCustomerLoyaltyReport(facilityId, organizationId);
                data = result.top_patients || [];
                title = 'Customer Loyalty Report';
                fileName = `customer_loyalty_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Patient', key: 'patient_name' },
                    { header: 'Visit Count', key: 'visit_count' },
                    { header: 'Total Spent', key: 'total_spent' },
                    { header: 'Last Visit', key: 'last_visit' },
                ];
                break;
            }
            case 'tax': {
                const startDate = start_date
                    ? new Date(start_date as string)
                    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const endDate = end_date ? new Date(end_date as string) : new Date();
                endDate.setHours(23, 59, 59, 999);
                const result = await this.reportingService.getTaxSummary(
                    facilityId,
                    startDate,
                    endDate,
                    organizationId,
                );
                data = result.tax_details || [];
                title = 'Tax Summary Report';
                fileName = `tax_summary_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Tax Rate', key: 'tax_rate' },
                    { header: 'Taxable Amount', key: 'taxable_amount' },
                    { header: 'Tax Amount', key: 'tax_amount' },
                ];
                break;
            }
            case 'audit-logs': {
                const result = await this.auditService.findAll(facilityId, undefined, undefined, undefined, 1, 5000);
                data = (result.data || []).map((log: any) => ({
                    date: log.created_at ? new Date(log.created_at).toISOString() : '',
                    action: log.action || '',
                    entity_type: log.entity_type || '',
                    entity_name: log.entity_name || '',
                    user_name: log.user ? `${log.user.first_name || ''} ${log.user.last_name || ''}`.trim() || log.user.email : '',
                    description: log.description || '',
                }));
                title = 'Audit Logs Report';
                fileName = `audit_logs_${new Date().toISOString().split('T')[0]}`;
                columns = [
                    { header: 'Date', key: 'date' },
                    { header: 'Action', key: 'action' },
                    { header: 'Entity Type', key: 'entity_type' },
                    { header: 'Entity', key: 'entity_name' },
                    { header: 'User', key: 'user_name' },
                    { header: 'Description', key: 'description' },
                ];
                break;
            }
            default:
                throw new AppError('Invalid report type', 400);
        }

        return { data, columns, title, fileName };
    }
}
