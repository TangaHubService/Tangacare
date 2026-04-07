import { Router } from 'express';
import { SupplierController } from '../../controllers/pharmacy/supplier.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateSupplierDto, UpdateSupplierDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const supplierController = new SupplierController();

router.post(
    '/',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    validateDto(CreateSupplierDto),
    supplierController.create,
);

router.get('/', authenticate, scopeMiddleware, supplierController.findAll);

router.get('/:id', authenticate, scopeMiddleware, supplierController.findOne);

router.put(
    '/:id',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    validateDto(UpdateSupplierDto),
    supplierController.update,
);

router.delete(
    '/:id',
    authenticate,
    authorize(UserRole.FACILITY_ADMIN, UserRole.SUPER_ADMIN),
    scopeMiddleware,
    supplierController.delete,
);

export default router;
