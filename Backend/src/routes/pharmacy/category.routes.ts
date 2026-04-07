import { Router } from 'express';
import { CategoryController } from '../../controllers/pharmacy/category.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { validateDto } from '../../middleware/validation.middleware';
import { CreateMedicineCategoryDto, UpdateMedicineCategoryDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const categoryController = new CategoryController();

router.get(
    '/',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(
        UserRole.SUPER_ADMIN,
        UserRole.FACILITY_ADMIN,
        UserRole.OWNER,
        UserRole.STORE_MANAGER,
        UserRole.PHARMACIST,
        UserRole.AUDITOR,
        UserRole.ADMIN,
    ),
    categoryController.list,
);
router.post(
    '/',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    validateDto(CreateMedicineCategoryDto),
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.OWNER, UserRole.STORE_MANAGER, UserRole.ADMIN),
    categoryController.create,
);
router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, categoryController.getOne);
router.patch(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    validateDto(UpdateMedicineCategoryDto),
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.OWNER, UserRole.STORE_MANAGER, UserRole.ADMIN),
    categoryController.update,
);
router.delete(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.OWNER, UserRole.ADMIN),
    categoryController.delete,
);

export default router;
