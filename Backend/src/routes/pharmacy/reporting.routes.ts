import { Router } from 'express';
import { ReportingController } from '../../controllers/pharmacy/reporting.controller';
import { ReportExportJobController } from '../../controllers/pharmacy/report-export-job.controller';
import { authenticate, authorize, requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const reportingController = new ReportingController();
const reportExportJobController = new ReportExportJobController();

router.get('/sales-summary/:facilityId?', authenticate, scopeMiddleware, reportingController.getSalesSummary);

router.get('/low-stock/:facilityId?', authenticate, scopeMiddleware, reportingController.getLowStock);

router.get('/expiry/:facilityId?', authenticate, scopeMiddleware, reportingController.getExpiryReport);

router.get(
    '/batch-stock-reconciliation/:facilityId?',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.INVENTORY_READ, PERMISSIONS.REPORTS_READ),
    scopeMiddleware,
    reportingController.getBatchStockReconciliation,
);

router.get('/daily-cash/:facilityId?', authenticate, scopeMiddleware, reportingController.getDailyCash);

router.get(
    '/controlled-drugs/:facilityId?',
    authenticate,
    requireFacilityScope,
    authorize(
        UserRole.FACILITY_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.AUDITOR,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
    ),
    scopeMiddleware,
    reportingController.getControlledDrugsPeriodReport,
);

router.get(
    '/controlled-medicine-register/export',
    authenticate,
    requireFacilityScope,
    authorize(
        UserRole.FACILITY_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.AUDITOR,
        UserRole.PHARMACIST,
        UserRole.STORE_MANAGER,
    ),
    scopeMiddleware,
    reportingController.exportControlledMedicineRegisterCsv,
);

router.get('/stock-register/:facilityId?', authenticate, scopeMiddleware, reportingController.getStockRegister);

router.get('/purchase-history/:facilityId?', authenticate, scopeMiddleware, reportingController.getPurchaseHistory);

router.get('/tax-summary/:facilityId?', authenticate, scopeMiddleware, reportingController.getTaxSummary);

router.get(
    '/customer-loyalty/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getCustomerLoyaltyReport,
);

router.get(
    '/employee-performance/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getEmployeePerformanceReport,
);

router.get(
    '/vendor-returns/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getVendorReturnsReport,
);

router.get(
    '/batch-traceability/:batchId',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.PHARMACIST),
    scopeMiddleware,
    reportingController.getBatchTraceability,
);

router.get(
    '/controlled-drug-register/:facilityId/:medicineId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.PHARMACIST),
    scopeMiddleware,
    reportingController.getControlledDrugRegister,
);

router.get(
    '/profit/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getProfitReport,
);

router.get(
    '/dead-stock/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getDeadStockReport,
);

router.get(
    '/inventory-aging/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getInventoryAgingReport,
);

router.get(
    '/purchase-vs-sales/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getPurchaseVsSalesReport,
);

router.get(
    '/medicine-margin/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getMedicineMarginReport,
);

router.get(
    '/stock/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getStockReport,
);

router.get(
    '/purchase/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getPurchaseReport,
);

router.get(
    '/sales/daily/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.CASHIER),
    scopeMiddleware,
    reportingController.getDailySalesReport,
);

router.get(
    '/sales/monthly/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getMonthlySalesReport,
);

router.get(
    '/sales/by-medicine/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getSalesByMedicine,
);

router.get(
    '/sales/by-category/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getSalesByCategory,
);

router.get(
    '/sales/by-cashier/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getSalesByCashier,
);

router.get(
    '/sales/payment-methods/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getPaymentMethodSummary,
);

router.get(
    '/sales/gross-vs-net/:facilityId',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    reportingController.getGrossVsNetSales,
);

router.post(
    '/export-jobs',
    authenticate,
    scopeMiddleware,
    reportExportJobController.createJob,
);

router.get(
    '/export-jobs/:jobId',
    authenticate,
    scopeMiddleware,
    reportExportJobController.getJob,
);

router.get(
    '/export-jobs/:jobId/download',
    authenticate,
    scopeMiddleware,
    reportExportJobController.download,
);

router.get('/export/:type/:format', authenticate, scopeMiddleware, reportingController.exportReport);

export default router;
