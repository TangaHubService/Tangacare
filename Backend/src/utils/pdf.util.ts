import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { logger } from '../middleware/logger.middleware';
import { PdfBrandingUtil } from './pdf-branding.util';

export interface PdfColumn {
    header: string;
    key: string;
    width?: number;
}

export class PdfUtil {
    /**
     * Generates a professional Batch Recall Notice PDF
     */
    static async generateRecallNotice(
        res: Response,
        recallData: any,
        fileName: string = 'recall_notice',
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });

                // Set headers for download
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);

                doc.pipe(res);

                // --- Header ---
                const logoSize = 28;
                const logoX = (doc.page.width - logoSize) / 2;
                PdfBrandingUtil.drawLogo(doc, logoX, doc.y, logoSize);
                doc.y += 34;
                doc.fillColor('#e11d48') // Rose-600
                    .fontSize(24)
                    .font('Helvetica-Bold')
                    .text('URGENT: BATCH RECALL NOTICE', { align: 'center' });

                doc.moveDown();
                doc.fillColor('#444444')
                    .fontSize(10)
                    .font('Helvetica')
                    .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
                doc.text(`Reference: RECALL-${recallData.id}`, { align: 'right' });

                doc.moveDown(2);

                // --- Facility Info ---
                doc.fontSize(12).font('Helvetica-Bold').text('ISSUED BY:');
                doc.fontSize(10)
                    .font('Helvetica')
                    .text(recallData.facility?.name || 'TangaCare Pharmacy');
                doc.text(recallData.facility?.address || '');
                doc.text(recallData.facility?.contact_phone || '');

                doc.moveDown();

                // --- Recalled Item Details ---
                doc.rect(50, doc.y, 500, 100).fill('#f8fafc');
                const startY = doc.y + 10;
                doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('MEDICATION DETAILS', 60, startY);

                doc.fontSize(10)
                    .font('Helvetica-Bold')
                    .text('Medicine Name:', 60, startY + 25);
                doc.font('Helvetica').text(recallData.medicine?.name || 'Unknown', 160, startY + 25);

                doc.font('Helvetica-Bold').text('Batch Number:', 60, startY + 40);
                doc.font('Helvetica').text(recallData.batch?.batch_number || 'N/A', 160, startY + 40);

                doc.font('Helvetica-Bold').text('Expiry Date:', 60, startY + 55);
                doc.font('Helvetica').text(
                    recallData.batch?.expiry_date ? new Date(recallData.batch.expiry_date).toLocaleDateString() : 'N/A',
                    160,
                    startY + 55,
                );

                doc.font('Helvetica-Bold').text('Recall Reason:', 60, startY + 70);
                doc.font('Helvetica').text(recallData.reason || 'Safety Precaution', 160, startY + 70, { width: 380 });

                doc.moveDown(7);

                // --- Instructions ---
                doc.fillColor('#e11d48').fontSize(12).font('Helvetica-Bold').text('IMMEDIATE ACTIONS REQUIRED:', 50);
                doc.moveDown(0.5);
                doc.fillColor('#444444').fontSize(10).font('Helvetica');
                doc.text('1. Immediately stop dispensing the specified batch of medication.');
                doc.text('2. Quarantine all remaining stock in a secure, designated area.');
                doc.text('3. Contact all patients who received this batch (see attached list).');
                doc.text('4. Return unused stock to the main warehouse or supplier for disposal.');

                doc.moveDown(2);

                // --- Signature ---
                doc.fontSize(10).text('Authorized By:', 50);
                doc.moveDown(2);
                doc.text('__________________________', 50);
                doc.text('Pharmacist / Store Manager', 50);

                PdfBrandingUtil.decorateBufferedPages(doc);
                doc.end();
                resolve();
            } catch (error) {
                logger.error('PDF Generation Error:', error);
                reject(error);
            }
        });
    }

    /**
     * Generic table generator for inventory reports
     */
    static async generateTableReport(
        res: Response,
        columns: PdfColumn[],
        data: any[],
        title: string,
        fileName: string = 'report',
    ): Promise<void> {
        // Simple placeholder for generic table PDF
        // In a real app, we'd use a lib like pdf-table or manually draw rows
        // For now, let's keep it simple as recall notice is the priority
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);
                doc.pipe(res);

                const logoOffset = PdfBrandingUtil.drawLogo(doc, 50, doc.y - 2, 24);
                doc.fontSize(20).text(title, 50 + logoOffset, doc.y, { align: 'left' });
                doc.moveDown();
                doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
                doc.moveDown(2);

                // Simple table-like output
                let y = doc.y;
                columns.forEach((col, i) => {
                    doc.font('Helvetica-Bold').text(col.header, 50 + i * 100, y);
                });

                doc.moveDown();
                doc.font('Helvetica');

                data.forEach((row) => {
                    y = doc.y;
                    if (y > 700) {
                        doc.addPage();
                        y = 50;
                    }
                    columns.forEach((col, i) => {
                        doc.text(String(row[col.key] || ''), 50 + i * 100, y);
                    });
                    doc.moveDown(0.5);
                });

                PdfBrandingUtil.decorateBufferedPages(doc);
                doc.end();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
}
