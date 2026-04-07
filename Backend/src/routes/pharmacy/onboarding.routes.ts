import { Router } from 'express';
import { OnboardingController } from '../../controllers/pharmacy/onboarding.controller';
import { validateDto } from '../../middleware/validation.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { CreateOnboardingSetupDto, CreateOnboardingOrganizationDto } from '../../dto/pharmacy.dto';

const router = Router();
const onboardingController = new OnboardingController();

router.post(
    '/organization',
    authenticate,
    validateDto(CreateOnboardingOrganizationDto),
    onboardingController.createOrganization,
);

router.post('/setup', authenticate, validateDto(CreateOnboardingSetupDto), onboardingController.setup);

export default router;
