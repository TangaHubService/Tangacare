import { Router } from 'express';
import { BatchController } from '../../controllers/pharmacy/batch.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateBatchDto, UpdateBatchDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const batchController = new BatchController();

router.post(
    '/',
    authenticate,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(CreateBatchDto),
    batchController.create,
);

router.get('/', authenticate, scopeMiddleware, batchController.findAll);

router.get('/expiring', authenticate, scopeMiddleware, batchController.getExpiring);

router.get('/operational', authenticate, scopeMiddleware, batchController.findOperational);

router.get('/:id', authenticate, scopeMiddleware, batchController.findOne);

router.put(
    '/:id',
    authenticate,
    authorize(UserRole.STORE_MANAGER, UserRole.FACILITY_ADMIN),
    scopeMiddleware,
    validateDto(UpdateBatchDto),
    batchController.update,
);

export default router;
