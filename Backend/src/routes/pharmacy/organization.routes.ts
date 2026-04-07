import { Router } from 'express';
import { OrganizationController } from '../../controllers/pharmacy/organization.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';

const router = Router();
const organizationController = new OrganizationController();

router.post(
    '/',
    authenticate,
    authorize(UserRole.SUPER_ADMIN),
    validateDto(CreateOrganizationDto),
    organizationController.create,
);

router.get('/', authenticate, scopeMiddleware, organizationController.findAll);
router.get('/:id', authenticate, scopeMiddleware, organizationController.findOne);
router.put(
    '/:id',
    authenticate,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.FACILITY_ADMIN),
    validateDto(UpdateOrganizationDto),
    organizationController.update,
);
router.delete('/:id', authenticate, authorize(UserRole.SUPER_ADMIN), organizationController.delete);

export default router;
