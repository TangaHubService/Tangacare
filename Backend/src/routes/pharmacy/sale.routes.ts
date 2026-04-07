import { Router } from 'express';
import { SaleController } from '../../controllers/pharmacy/sale.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateSaleDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const saleController = new SaleController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    validateDto(CreateSaleDto),
    saleController.create,
);

router.get(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    saleController.findAll,
);

router.get(
    '/:id',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    saleController.findOne,
);

// H-1: PDF Receipt endpoint
router.get(
    '/:id/receipt',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
    scopeMiddleware,
    saleController.getReceipt,
);

// Print invoice directly to printer
router.post(
    '/:id/print',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    saleController.printInvoice,
);

// Get available printers
router.get(
    '/printers/available',
    authenticate,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    saleController.getPrinters,
);

// Test printer availability
router.get(
    '/printers/test',
    authenticate,
    authorize(UserRole.PHARMACIST, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    saleController.testPrinter,
);

export default router;
