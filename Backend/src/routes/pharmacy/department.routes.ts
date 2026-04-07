import { Router } from 'express';
import { DepartmentController } from '../../controllers/pharmacy/department.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const departmentController = new DepartmentController();

router.post(
    '/',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    validateDto(CreateDepartmentDto),
    departmentController.create,
);

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, departmentController.findAll);

router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, departmentController.findOne);

router.put(
    '/:id',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    validateDto(UpdateDepartmentDto),
    departmentController.update,
);

router.delete(
    '/:id',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    departmentController.delete,
);

export default router;
