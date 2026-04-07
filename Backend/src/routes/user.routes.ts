import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';
import { validateDto } from '../middleware/validation.middleware';
import { CreateStaffDto, AdminUpdateUserDto } from '../dto/auth.dto';

const router = Router();
const userController = new UserController();

router.post(
    '/',
    authenticate,
    requirePermission(PERMISSIONS.USERS_MANAGE),
    validateDto(CreateStaffDto),
    userController.create,
);

router.get(
    '/',
    authenticate,
    requirePermission(PERMISSIONS.USERS_READ, PERMISSIONS.USERS_MANAGE),
    userController.findAll,
);

router.get(
    '/:id',
    authenticate,
    requirePermission(PERMISSIONS.USERS_READ, PERMISSIONS.USERS_MANAGE),
    userController.findOne,
);

router.put(
    '/:id',
    authenticate,
    requirePermission(PERMISSIONS.USERS_MANAGE),
    validateDto(AdminUpdateUserDto),
    userController.update,
);

router.delete('/:id', authenticate, requirePermission(PERMISSIONS.USERS_MANAGE), userController.delete);

export default router;
