import { Request, Response } from 'express';
import { OnboardingService } from '../../services/pharmacy/onboarding.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateOnboardingSetupDto, CreateOnboardingOrganizationDto } from '../../dto/pharmacy.dto';

export class OnboardingController {
    private onboardingService: OnboardingService;

    constructor() {
        this.onboardingService = new OnboardingService();
    }

    createOrganization = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            if (!user?.userId) {
                ResponseUtil.unauthorized(res, 'Authentication required');
                return;
            }
            const result = await this.onboardingService.createOrganizationOnly(
                user.userId,
                req.body as CreateOnboardingOrganizationDto,
            );
            ResponseUtil.created(res, result, 'Organization created. Add your first branch next.');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Create organization failed', error.message);
            }
        }
    };

    setup = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            if (!user?.userId) {
                ResponseUtil.unauthorized(res, 'Authentication required');
                return;
            }
            const result = await this.onboardingService.setupOrganizationWithFirstFacility(
                user.userId,
                req.body as CreateOnboardingSetupDto,
            );
            ResponseUtil.created(
                res,
                result,
                'Organization and facility created successfully. You can now use the app.',
            );
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Setup failed', error.message);
            }
        }
    };
}
