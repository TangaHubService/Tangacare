import { Router } from 'express';
import { ColdChainController } from '../../controllers/pharmacy/cold-chain.controller';
import {
    AcknowledgeColdChainExcursionDto,
    LogColdChainTelemetryDto,
    ResolveColdChainExcursionDto,
} from '../../dto/pharmacy.dto';
import { UserRole } from '../../entities/User.entity';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { requireFacilityScope } from '../../middleware/facility-scope.middleware';
import { scopeMiddleware } from '../../middleware/scope.middleware';
import { validateDto } from '../../middleware/validation.middleware';

const router = Router();
const controller = new ColdChainController();

router.use(authenticate);
router.use(requireFacilityScope);
router.use(scopeMiddleware);

router.get(
    '/overview',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.AUDITOR),
    controller.getOverview,
);

router.get(
    '/excursions',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.AUDITOR),
    controller.getExcursions,
);

router.post(
    '/locations/:locationId/telemetry',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.PHARMACIST),
    validateDto(LogColdChainTelemetryDto),
    controller.logTelemetry,
);

router.get(
    '/locations/:locationId/telemetry',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER, UserRole.AUDITOR),
    controller.getTelemetryHistory,
);

router.patch(
    '/excursions/:id/acknowledge',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    validateDto(AcknowledgeColdChainExcursionDto),
    controller.acknowledgeExcursion,
);

router.patch(
    '/excursions/:id/resolve',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.FACILITY_ADMIN, UserRole.STORE_MANAGER),
    validateDto(ResolveColdChainExcursionDto),
    controller.resolveExcursion,
);

export default router;
