import { Router } from 'express';
import { StockController } from '../../controllers/pharmacy/stock.controller';
import { authenticate, authorize, requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { validateDto } from '../../middleware/validation.middleware';
import { StockAdjustmentDto, ReleaseStockQcDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';
import multer from 'multer';

const router = Router();
const stockController = new StockController();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, stockController.getStock);

router.post(
    '/release-qc',
    authenticate,
    requireFacilityScope,
    requirePermission(PERMISSIONS.INVENTORY_WRITE),
    scopeMiddleware,
    validateDto(ReleaseStockQcDto),
    stockController.releaseStockFromQc,
);

router.post(
    '/adjust',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    validateDto(StockAdjustmentDto),
    stockController.adjustStock,
);

router.post(
    '/transfer',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    stockController.transferStockCompat,
);

router.post(
    '/transfer-between-locations',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    stockController.transferBetweenLocations,
);

router.post(
    '/add-batches',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    stockController.addBatches,
);

router.get(
    '/template/download',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    stockController.downloadTemplate,
);

router.post(
    '/import',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    upload.single('file') as any,
    stockController.importStock,
);

export default router;
