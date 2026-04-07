import { Router } from 'express';
import { MedicineController } from '../../controllers/pharmacy/medicine.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { CreateMedicineDto, UpdateMedicineDto } from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();
const medicineController = new MedicineController();

router.post(
    '/',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    validateDto(CreateMedicineDto),
    medicineController.create,
);

router.get('/', authenticate, requireFacilityScope, scopeMiddleware, medicineController.findAll);

router.get(
    '/template/download',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    medicineController.downloadTemplate,
);

router.get(
    '/statistics',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.AUDITOR),
    medicineController.getStatistics,
);

router.get(
    '/export',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.AUDITOR),
    medicineController.exportExcel,
);

router.post(
    '/import',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    upload.single('file') as any,
    medicineController.importExcel,
);

router.post(
    '/import/validate',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    upload.single('file') as any,
    medicineController.validateImport,
);

router.get('/code/:code', authenticate, requireFacilityScope, scopeMiddleware, medicineController.findByCode);
router.get('/barcode/:barcode', authenticate, requireFacilityScope, scopeMiddleware, medicineController.findByBarcode);

router.get('/:id', authenticate, requireFacilityScope, scopeMiddleware, medicineController.findOne);

router.put(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    validateDto(UpdateMedicineDto),
    medicineController.update,
);

router.delete(
    '/:id',
    authenticate,
    requireFacilityScope,
    scopeMiddleware,
    authorize(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN),
    medicineController.delete,
);

export default router;
