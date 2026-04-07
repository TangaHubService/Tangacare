import { Request, Response } from 'express';
import { StockController } from '../../controllers/pharmacy/stock.controller';

jest.mock('../../services/pharmacy/stock.service');
jest.mock('../../services/pharmacy/audit.service');
jest.mock('../../services/pharmacy/stock-transfer.service');

describe('StockController Wave1 Compatibility', () => {
    let controller: StockController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new StockController();
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn(),
            send: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('transferStockCompat should support Shape A (source_stock_id)', async () => {
        req = {
            body: {
                source_stock_id: 10,
                target_location_id: 22,
                quantity: 5,
                notes: 'compat route',
            },
            user: { userId: 7, facilityId: 1 },
        } as any;

        const transferSpy = jest
            .spyOn((controller as any).stockService, 'transferStockBetweenLocations')
            .mockResolvedValue(undefined);

        await controller.transferStockCompat(req as Request, res as Response);

        expect(transferSpy).toHaveBeenCalledWith(1, 10, 22, 5, 7, 'compat route');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('transferStockCompat should support Shape B cross-department transfer', async () => {
        req = {
            body: {
                medicine_id: 9,
                batch_id: 21,
                source_department_id: null,
                target_department_id: 3,
                quantity: 4,
                notes: 'legacy payload',
            },
            user: { userId: 11, facilityId: 1, organizationId: 1 },
        } as any;

        const createSpy = jest.spyOn((controller as any).stockTransferService, 'create').mockResolvedValue({ id: 99 });
        const completeSpy = jest
            .spyOn((controller as any).stockTransferService, 'completeTransfer')
            .mockResolvedValue({ id: 99, status: 'completed' });

        await controller.transferStockCompat(req as Request, res as Response);

        expect(createSpy).toHaveBeenCalled();
        expect(completeSpy).toHaveBeenCalledWith(99, 11, 1, 1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('transferStockCompat should reject invalid payload', async () => {
        req = {
            body: { quantity: 1 },
            user: { userId: 7, facilityId: 1 },
        } as any;

        await controller.transferStockCompat(req as Request, res as Response);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('downloadTemplate should return xlsx buffer', async () => {
        const templateBuffer = Buffer.from('xlsx-data');
        const templateSpy = jest
            .spyOn((controller as any).stockService, 'downloadTemplate')
            .mockResolvedValue(templateBuffer);

        await controller.downloadTemplate(req as Request, res as Response);

        expect(templateSpy).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        expect(res.send).toHaveBeenCalledWith(templateBuffer);
    });

    it('importStock should return imported/errors payload', async () => {
        req = {
            file: { buffer: Buffer.from('xlsx') },
            user: { userId: 5, facilityId: 2, organizationId: 1 },
        } as any;

        const importSpy = jest
            .spyOn((controller as any).stockService, 'importBatchesFromExcel')
            .mockResolvedValue({ imported: 2, errors: ['Row 3: invalid quantity'] });

        await controller.importStock(req as Request, res as Response);

        expect(importSpy).toHaveBeenCalledWith(Buffer.from('xlsx'), 2, 1, 5);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
