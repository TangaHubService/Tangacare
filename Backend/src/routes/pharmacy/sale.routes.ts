import { Router } from 'express';
import { SaleController } from '../../controllers/pharmacy/sale.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateSaleDto } from '../../dto/pharmacy.dto';
import { PERMISSIONS } from '../../config/permissions';

const router = Router();
const saleController = new SaleController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_WRITE),
    scopeMiddleware,
    validateDto(CreateSaleDto),
    saleController.create,
);

router.get(
    '/',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_READ),
    scopeMiddleware,
    saleController.findAll,
);

/** Static paths must be registered before `/:id` so "printers" is not captured as an id. */
router.get(
    '/printers/available',
    authenticate,
    requirePermission(PERMISSIONS.DISPENSING_WRITE),
    saleController.getPrinters,
);

router.get(
    '/printers/test',
    authenticate,
    requirePermission(PERMISSIONS.DISPENSING_WRITE),
    saleController.testPrinter,
);

router.get(
    '/:id/receipt',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_READ),
    scopeMiddleware,
    saleController.getReceipt,
);

router.post(
    '/:id/print',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_WRITE),
    scopeMiddleware,
    saleController.printInvoice,
);

router.get(
    '/:id',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.DISPENSING_READ),
    scopeMiddleware,
    saleController.findOne,
);

export default router;
