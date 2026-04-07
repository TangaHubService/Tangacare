import { Response, NextFunction } from 'express';
import { DisposalService } from '../../services/pharmacy/disposal.service';
import { CreateDisposalRequestDto, DisposalFiltersDto } from '../../dto/pharmacy.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuthRequest } from '../../middleware/auth.middleware';

export class DisposalController {
    private disposalService: DisposalService;

    constructor() {
        this.disposalService = new DisposalService();
    }

    createDisposal = async (req: AuthRequest, res: Response) => {
        try {
            const createDto = plainToInstance(CreateDisposalRequestDto, req.body);
            const errors = await validate(createDto);
            if (errors.length > 0) {
                return res.status(400).json({ errors: errors.map(e => e.constraints) });
            }

            // Enforce facility_id and organization_id from user context (never trust body)
            if (!createDto.facility_id && req.user?.facilityId) {
                createDto.facility_id = req.user.facilityId;
            }
            createDto.organization_id = req.user!.organizationId;

            const result = await this.disposalService.createDisposalRequest(createDto, req.user!.userId);
            return res.status(201).json(result);
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ message: error.message });
        }
    };

    approveDisposal = async (req: AuthRequest, res: Response, _next: NextFunction) => {
        try {
            const requestId = parseInt(req.params.id);
            const organizationId = req.user!.organizationId;
            if (!organizationId) return res.status(400).json({ message: 'Organization context missing' });
            const result = await this.disposalService.approveDisposalRequest(requestId, organizationId, req.user!.userId);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ message: error.message });
        }
    };

    witnessDisposal = async (req: AuthRequest, res: Response, _next: NextFunction) => {
        try {
            const requestId = parseInt(req.params.id);
            const organizationId = req.user!.organizationId;
            if (!organizationId) return res.status(400).json({ message: 'Organization context missing' });
            const result = await this.disposalService.witnessDisposalRequest(requestId, organizationId, req.user!.userId);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ message: error.message });
        }
    };

    postDisposal = async (req: AuthRequest, res: Response, _next: NextFunction) => {
        try {
            const requestId = parseInt(req.params.id);
            const organizationId = req.user!.organizationId;
            if (!organizationId) return res.status(400).json({ message: 'Organization context missing' });
            const result = await this.disposalService.postDisposalRequest(requestId, organizationId, req.user!.userId);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ message: error.message });
        }
    };

    voidDisposal = async (req: AuthRequest, res: Response, _next: NextFunction) => {
        try {
            const requestId = parseInt(req.params.id);
            const organizationId = req.user!.organizationId;
            if (!organizationId) return res.status(400).json({ message: 'Organization context missing' });
            const result = await this.disposalService.voidDisposalRequest(requestId, organizationId, req.user!.userId);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ message: error.message });
        }
    };

    listDisposals = async (req: AuthRequest, res: Response) => {
        try {
            const filters = plainToInstance(DisposalFiltersDto, req.query);

            // Always enforce org-level isolation; super_admin may still see by org
            filters.organization_id = req.user?.organizationId;
            if (req.user?.role !== 'super_admin') {
                filters.facility_id = req.user?.facilityId;
            }

            const result = await this.disposalService.listDisposals(filters);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    };

    getDisposal = async (req: AuthRequest, res: Response) => {
        try {
            const organizationId = req.user?.organizationId;
            const result = await this.disposalService.getDisposalRequest(parseInt(req.params.id), organizationId);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ message: error.message });
        }
    };
}
