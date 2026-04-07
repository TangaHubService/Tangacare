import { Router } from 'express';
import { FacilityController } from '../../controllers/pharmacy/facility.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateFacilityDto, UpdateFacilityDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const facilityController = new FacilityController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.OWNER),
    validateDto(CreateFacilityDto),
    facilityController.create,
);

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, facilityController.findAll);

router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, facilityController.findOne);

router.put(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.OWNER),
    validateDto(UpdateFacilityDto),
    facilityController.update,
);

router.delete(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN),
    facilityController.delete,
);

export default router;
