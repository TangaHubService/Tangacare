import { Router } from 'express';
import { ProcurementController } from '../../controllers/pharmacy/procurement.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, ReceivePurchaseOrderDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();
const procurementController = new ProcurementController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(CreatePurchaseOrderDto),
    procurementController.create,
);

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, procurementController.findAll);

router.get(
    '/goods-receipts',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    procurementController.findGoodsReceipts,
);

router.get(
    '/price-suggestions',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    procurementController.getPriceSuggestions,
);

router.get(
    '/goods-receipts/:receiptId',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    procurementController.findGoodsReceiptById,
);

router.get(
    '/template',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    procurementController.downloadTemplate,
);

(router as any).post(
    '/import',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    upload.single('file'),
    procurementController.importExcel,
);

(router as any).post(
    '/import/validate',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    upload.single('file'),
    procurementController.validateImport,
);

router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, procurementController.findOne);

router.put(
    '/:id',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(UpdatePurchaseOrderDto),
    procurementController.update,
);

router.post(
    '/:id/receive',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(ReceivePurchaseOrderDto),
    procurementController.receive,
);

router.post(
    '/:id/submit',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    procurementController.submit,
);

router.post(
    '/:id/approve',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    procurementController.approve,
);

router.post(
    '/:id/cancel',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    procurementController.cancel,
);

router.patch(
    '/:id/quote',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    procurementController.quote,
);

router.patch(
    '/:id/review',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    procurementController.review,
);

router.post(
    '/auto-draft-pos',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    procurementController.autoDraft,
);

router.get('/:id/export', authenticate, requireFacilityScope, (req, res) =>
    procurementController.export(req as any, res),
);

export default router;
