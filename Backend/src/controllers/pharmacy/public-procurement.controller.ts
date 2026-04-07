import { Request, Response } from 'express';
import { ProcurementService } from '../../services/pharmacy/procurement.service';
import { ResponseUtil } from '../../utils/response.util';

export class PublicProcurementController {
    private procurementService: ProcurementService;

    constructor() {
        this.procurementService = new ProcurementService();
    }

    getOrderByToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.params;
            if (!token) {
                ResponseUtil.error(res, 'Token is required', 400);
                return;
            }

            const result = await this.procurementService.getOrderByToken(token);
            ResponseUtil.success(res, result, 'Purchase order retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve purchase order', error.message);
            }
        }
    };

    supplierAction = async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.params;
            const { action, data } = req.body;

            if (!token) {
                ResponseUtil.error(res, 'Token is required', 400);
                return;
            }

            if (!action || !['approve', 'confirm', 'clarification', 'quote', 'reject'].includes(action)) {
                ResponseUtil.error(res, 'Valid action is required', 400);
                return;
            }

            let result;
            if (action === 'quote') {
                if (!data.items || !Array.isArray(data.items)) {
                    ResponseUtil.error(res, 'Quotation items are required', 400);
                    return;
                }
                result = await this.procurementService.supplierQuoteByToken(token, data.items);
            } else {
                result = await this.procurementService.supplierAction(token, action, data);
            }
            ResponseUtil.success(res, result, 'Action processed successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to process action', error.message);
            }
        }
    };
}
