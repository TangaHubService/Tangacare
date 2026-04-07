import { Router } from 'express';
import { StockTransferController } from '../../controllers/pharmacy/stock-transfer.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateStockTransferDto, UpdateStockTransferDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';

const router = Router();
const transferController = new StockTransferController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(CreateStockTransferDto),
    transferController.create,
);

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, transferController.findAll);

router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, transferController.findOne);

router.put(
    '/:id',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(UpdateStockTransferDto),
    transferController.update,
);

router.post(
    '/:id/complete',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    transferController.complete,
);

router.post(
    '/:id/cancel',
    authenticate,
    requireFacilityScope,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    transferController.cancel,
);

export default router;
