import { Request, Response } from 'express';
import { ResponseUtil } from '../../utils/response.util';
import { SaleService } from '../../services/pharmacy/sale.service';
import { PrintService } from '../../services/pharmacy/print.service';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';
import { IdempotencyStore } from '../../utils/idempotency.util';
import { PrintInvoiceDto } from '../../dto/print.dto';

export class SaleController {
    private saleService: SaleService;
    private printService: PrintService;

    constructor() {
        this.saleService = new SaleService();
        this.printService = new PrintService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        const user = (req as any).user;
        const facilityId = resolveFacilityId(req);
        const organizationId = resolveOrganizationId(req);
        const cashierId = user?.userId;
        const idemHeader = req.headers['idempotency-key'];
        const idemKey =
            typeof idemHeader === 'string'
                ? IdempotencyStore.buildKey('sale:create', idemHeader, facilityId, cashierId)
                : null;
        let shouldReleaseInFlight = false;

        try {
            if (!facilityId || !cashierId || !organizationId) {
                ResponseUtil.forbidden(res, 'No facility context found. Facility ID is required.');
                return;
            }

            if (idemKey) {
                const cached = await IdempotencyStore.get(idemKey);
                if (cached) {
                    res.status(cached.statusCode).json(cached.body);
                    return;
                }
                if (!(await IdempotencyStore.markInFlight(idemKey, 'sale:create', facilityId, cashierId))) {
                    ResponseUtil.error(res, 'Request with same idempotency key is in progress', 409);
                    return;
                }
                shouldReleaseInFlight = true;
            }

            const { sale, warnings } = await this.saleService.createSale(req.body, cashierId, facilityId, organizationId);
            const responseBody = {
                success: true,
                message: 'Sale created successfully',
                data: sale,
                ...(warnings.length > 0 ? { warnings } : {}),
                timestamp: new Date().toISOString(),
            };
            if (idemKey) {
                await IdempotencyStore.set(idemKey, 201, responseBody);
                shouldReleaseInFlight = false;
            }
            res.status(201).json(responseBody);
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to create sale', error.message);
        } finally {
            if (idemKey && shouldReleaseInFlight) {
                await IdempotencyStore.clearInFlight(idemKey);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            if (!facilityId || !organizationId) {
                ResponseUtil.forbidden(res, 'No facility context found. Facility ID is required.');
                return;
            }

            const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
            const hasPatientFilter = req.query.patient_id !== undefined;
            const patientId = hasPatientFilter ? parseInt(req.query.patient_id as string, 10) : undefined;
            const search = typeof req.query.search === 'string' ? req.query.search : undefined;

            if (hasPatientFilter && (!Number.isInteger(patientId) || (patientId as number) <= 0)) {
                ResponseUtil.badRequest(res, 'patient_id must be a positive integer');
                return;
            }

            const result = await this.saleService.listSales(
                facilityId,
                page,
                limit,
                organizationId,
                req as any,
                patientId,
                search,
            );
            ResponseUtil.success(res, result, 'Sales retrieved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to fetch sales', error.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            if (!facilityId || !organizationId) {
                ResponseUtil.forbidden(res, 'No facility context found. Facility ID is required.');
                return;
            }

            const id = parseInt(req.params.id, 10);
            const sale = await this.saleService.getSale(id, organizationId, facilityId);
            ResponseUtil.success(res, sale, 'Sale retrieved successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to fetch sale', error.message);
        }
    };

    // H-1: Stream a PDF receipt for the specified sale
    getReceipt = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId || !organizationId) {
                ResponseUtil.forbidden(res, 'No facility context found. Facility ID is required.');
                return;
            }

            const id = parseInt(req.params.id, 10);
            const pdfBuffer = await this.saleService.generateReceiptPdf(id, organizationId, facilityId);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="receipt_${id}.pdf"`,
                'Content-Length': pdfBuffer.length,
            });
            res.end(pdfBuffer);
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to generate receipt', error.message);
        }
    };

    // Print invoice directly to printer
    printInvoice = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);
            if (!facilityId || !organizationId) {
                ResponseUtil.forbidden(res, 'No facility context found. Facility ID is required.');
                return;
            }

            const id = parseInt(req.params.id, 10);
            const { printerName, copies = 1, duplex = false, paperSize = 'A4' } = req.body as PrintInvoiceDto;

            await this.printService.printInvoice(id, organizationId, facilityId, {
                printerName,
                copies,
                duplex,
                paperSize
            });

            ResponseUtil.success(res, null, 'Invoice printed successfully');
        } catch (error: any) {
            if (error?.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
                return;
            }
            ResponseUtil.internalError(res, 'Failed to print invoice', error.message);
        }
    };

    // Get available printers
    getPrinters = async (_req: Request, res: Response): Promise<void> => {
        try {
            const printers = await this.printService.getAvailablePrinters();
            ResponseUtil.success(res, { printers }, 'Printers retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to get printers', error.message);
        }
    };

    // Test printer availability
    testPrinter = async (req: Request, res: Response): Promise<void> => {
        try {
            const { printerName } = req.query;
            const isAvailable = await this.printService.testPrinter(printerName as string);
            ResponseUtil.success(res, { isAvailable }, 'Printer test completed');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to test printer', error.message);
        }
    };
}
