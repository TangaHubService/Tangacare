import { Request, Response } from 'express';
import { WalkInPrescriptionService } from '../../services/pharmacy/walkin-prescription.service';
import { ResponseUtil } from '../../utils/response.util';
import { CreateWalkInPrescriptionDto } from '../../dto/pharmacy.dto';
import { resolveOrganizationId } from '../../utils/request.util';

export class WalkInPrescriptionController {
    private service = new WalkInPrescriptionService();

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization context missing');
                return;
            }
            const dto = req.body as CreateWalkInPrescriptionDto;
            if (dto.organization_id !== organizationId) {
                ResponseUtil.forbidden(res, 'Organization mismatch');
                return;
            }
            const saved = await this.service.createWalkIn(dto, user?.userId);
            ResponseUtil.success(res, saved, 'Walk-in prescription recorded', 201);
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create prescription', error.message);
        }
    };
}
