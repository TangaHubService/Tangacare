import { Router } from 'express';
import { StorageLocationController } from '../../controllers/pharmacy/storage-location.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../entities/User.entity';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';

const router = Router();
const controller = new StorageLocationController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

router.post('/', authorize(UserRole.ADMIN, UserRole.OWNER, UserRole.STORE_MANAGER), controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getOne);
router.put('/:id', authorize(UserRole.ADMIN, UserRole.OWNER, UserRole.STORE_MANAGER), controller.update);
router.delete('/:id', authorize(UserRole.ADMIN, UserRole.OWNER), controller.delete);

export default router;
