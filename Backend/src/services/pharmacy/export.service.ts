/**
 * Excel/PDF exports: sync streaming to `Response`, or `exportToExcelBuffer` for async jobs.
 */
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { PdfBrandingUtil } from '../../utils/pdf-branding.util';

export interface ExportColumn {
    header: string;
    key: string;
    width?: number;
}

type PrintableRow = Record<string, string>;

export class ExportService {
    /**
     * Generates an Excel file and streams it to the response
     */
    async exportToExcel(
        res: Response,
        columns: ExportColumn[],
        data: any[],
        fileName: string,
        reportTitle: string,
    ): Promise<void> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(reportTitle);

        // Styling the header
        worksheet.columns = columns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width || 20,
            style: { font: { name: 'Arial', size: 10 } },
        }));

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        // Add data
        worksheet.addRows(data);

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    }

    /** Build Excel workbook in memory (for background export jobs). */
    async exportToExcelBuffer(
        columns: ExportColumn[],
        data: any[],
        _fileName: string,
        reportTitle: string,
    ): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(reportTitle);

        worksheet.columns = columns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width || 20,
            style: { font: { name: 'Arial', size: 10 } },
        }));

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        worksheet.addRows(data);

        const buf = await workbook.xlsx.writeBuffer();
        return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    }

    /**
     * Generates a PDF file and streams it to the response
     */
    async exportToPdf(
        res: Response,
        columns: ExportColumn[],
        data: any[],
        fileName: string,
        reportTitle: string,
    ): Promise<void> {
        const layout = columns.length > 7 ? 'landscape' : 'portrait';
        const doc = new PDFDocument({ margin: 32, size: 'A4', layout, bufferPages: true });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);

        doc.pipe(res);

        const generatedOn = new Date().toLocaleString();
        const left = doc.page.margins.left;
        const right = doc.page.width - doc.page.margins.right;
        const tableWidth = right - left;
        const contentBottom = doc.page.height - doc.page.margins.bottom - 30;
        const preparedRows = data.map((row) => this.prepareRow(row, columns));
        const columnWidths = this.calculateColumnWidths(columns, tableWidth);

        let cursorY = doc.page.margins.top;
        const drawHeader = (continued: boolean) => {
            const logoOffset = PdfBrandingUtil.drawLogo(doc, left, cursorY - 2, 24);
            const headerX = left + logoOffset;
            const headerWidth = right - headerX;
            const suffix = continued ? ' (continued)' : '';

            doc.font('Helvetica-Bold')
                .fontSize(15)
                .fillColor('#0f172a')
                .text(reportTitle, headerX, cursorY, { width: headerWidth });
            doc.font('Helvetica')
                .fontSize(9)
                .fillColor('#64748b')
                .text(`Generated on: ${generatedOn}${suffix}`, headerX, cursorY + 18, { width: headerWidth });
            cursorY += 38;
        };

        const drawHeaderRow = () => {
            cursorY = this.drawTableHeader(doc, columns, columnWidths, left, cursorY);
        };

        const startNewPage = () => {
            doc.addPage();
            cursorY = doc.page.margins.top;
            drawHeader(true);
            drawHeaderRow();
        };

        drawHeader(false);
        drawHeaderRow();

        if (preparedRows.length === 0) {
            const emptyHeight = 26;
            if (cursorY + emptyHeight > contentBottom) {
                startNewPage();
            }

            doc.rect(left, cursorY, tableWidth, emptyHeight).strokeColor('#dbe5ef').lineWidth(0.7).stroke();
            doc.font('Helvetica')
                .fontSize(9)
                .fillColor('#64748b')
                .text('No data found for the selected filters.', left + 6, cursorY + 8, {
                    width: tableWidth - 12,
                    align: 'center',
                });
            cursorY += emptyHeight;
        } else {
            for (const row of preparedRows) {
                const rowHeight = this.measureRowHeight(doc, columns, columnWidths, row);
                if (cursorY + rowHeight > contentBottom) {
                    startNewPage();
                }
                cursorY = this.drawTableRow(doc, columns, columnWidths, row, left, cursorY, rowHeight);
            }
        }

        PdfBrandingUtil.decorateBufferedPages(doc);

        doc.end();
    }

    private prepareRow(row: any, columns: ExportColumn[]): PrintableRow {
        const prepared: PrintableRow = {};
        for (const column of columns) {
            prepared[column.key] = this.sanitizeCellValue(row?.[column.key]);
        }
        return prepared;
    }

    private sanitizeCellValue(value: unknown): string {
        if (value === null || value === undefined) {
            return '';
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }

        const compact = String(value).replace(/\s+/g, ' ').trim();
        if (compact.length > 220) {
            return `${compact.slice(0, 217)}...`;
        }
        return compact;
    }

    private calculateColumnWidths(columns: ExportColumn[], tableWidth: number): number[] {
        const weights = columns.map((column) => {
            if (typeof column.width === 'number' && Number.isFinite(column.width) && column.width > 0) {
                return column.width;
            }
            return this.inferColumnWeight(column.key);
        });

        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
        return weights.map((weight) => (weight / totalWeight) * tableWidth);
    }

    private inferColumnWeight(key: string): number {
        const normalized = key.toLowerCase();
        if (
            normalized.includes('description') ||
            normalized.includes('action') ||
            normalized.includes('reason') ||
            normalized.includes('notes')
        ) {
            return 2.6;
        }
        if (
            normalized.includes('medicine') ||
            normalized.includes('supplier') ||
            normalized.includes('reference') ||
            normalized.includes('name')
        ) {
            return 1.8;
        }
        if (normalized.includes('date')) {
            return 1.45;
        }
        if (
            normalized.includes('amount') ||
            normalized.includes('price') ||
            normalized.includes('total') ||
            normalized.includes('value') ||
            normalized.includes('qty') ||
            normalized.includes('quantity')
        ) {
            return 1.25;
        }
        return 1.35;
    }

    private drawTableHeader(
        doc: PDFKit.PDFDocument,
        columns: ExportColumn[],
        columnWidths: number[],
        startX: number,
        startY: number,
    ): number {
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const cellPaddingX = 4;
        const cellPaddingY = 4;
        const headerHeight = this.measureHeaderHeight(doc, columns, columnWidths, cellPaddingX, cellPaddingY);
        let currentX = startX;

        doc.save();
        doc.rect(startX, startY, totalWidth, headerHeight).fill('#e6f4f1');
        doc.rect(startX, startY, totalWidth, headerHeight).strokeColor('#c7d6e6').lineWidth(0.8).stroke();

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
        columns.forEach((column, index) => {
            const cellWidth = columnWidths[index];
            if (index > 0) {
                doc.moveTo(currentX, startY)
                    .lineTo(currentX, startY + headerHeight)
                    .strokeColor('#dbe5ef')
                    .lineWidth(0.6)
                    .stroke();
            }
            doc.text(column.header, currentX + cellPaddingX, startY + cellPaddingY, {
                width: Math.max(cellWidth - cellPaddingX * 2, 10),
                align: 'left',
            });
            currentX += cellWidth;
        });
        doc.restore();

        return startY + headerHeight;
    }

    private drawTableRow(
        doc: PDFKit.PDFDocument,
        columns: ExportColumn[],
        columnWidths: number[],
        row: PrintableRow,
        startX: number,
        startY: number,
        rowHeight: number,
    ): number {
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const cellPaddingX = 4;
        const cellPaddingY = 4;
        let currentX = startX;

        doc.save();
        doc.rect(startX, startY, totalWidth, rowHeight).strokeColor('#dbe5ef').lineWidth(0.6).stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#111827');
        columns.forEach((column, index) => {
            const cellWidth = columnWidths[index];
            const cellValue = row[column.key] || '';
            const align = this.isNumericColumn(column.key) ? 'right' : 'left';

            if (index > 0) {
                doc.moveTo(currentX, startY)
                    .lineTo(currentX, startY + rowHeight)
                    .strokeColor('#eef2f7')
                    .lineWidth(0.5)
                    .stroke();
            }

            doc.text(cellValue, currentX + cellPaddingX, startY + cellPaddingY, {
                width: Math.max(cellWidth - cellPaddingX * 2, 10),
                height: Math.max(rowHeight - cellPaddingY * 2, 10),
                align,
                ellipsis: true,
            });

            currentX += cellWidth;
        });
        doc.restore();

        return startY + rowHeight;
    }

    private measureHeaderHeight(
        doc: PDFKit.PDFDocument,
        columns: ExportColumn[],
        columnWidths: number[],
        paddingX: number,
        paddingY: number,
    ): number {
        doc.font('Helvetica-Bold').fontSize(8);
        let contentHeight = 0;
        columns.forEach((column, index) => {
            const height = doc.heightOfString(column.header, {
                width: Math.max(columnWidths[index] - paddingX * 2, 10),
                align: 'left',
            });
            if (height > contentHeight) {
                contentHeight = height;
            }
        });

        return Math.max(20, contentHeight + paddingY * 2);
    }

    private measureRowHeight(
        doc: PDFKit.PDFDocument,
        columns: ExportColumn[],
        columnWidths: number[],
        row: PrintableRow,
    ): number {
        const paddingX = 4;
        const paddingY = 4;
        const minHeight = 20;
        const maxHeight = 94;

        doc.font('Helvetica').fontSize(8);
        let contentHeight = 0;

        columns.forEach((column, index) => {
            const value = row[column.key] || '';
            const align = this.isNumericColumn(column.key) ? 'right' : 'left';
            const height = doc.heightOfString(value, {
                width: Math.max(columnWidths[index] - paddingX * 2, 10),
                align,
            });
            if (height > contentHeight) {
                contentHeight = height;
            }
        });

        return Math.min(maxHeight, Math.max(minHeight, contentHeight + paddingY * 2));
    }

    private isNumericColumn(key: string): boolean {
        const normalized = key.toLowerCase();
        return (
            normalized.includes('qty') ||
            normalized.includes('quantity') ||
            normalized.includes('amount') ||
            normalized.includes('price') ||
            normalized.includes('total') ||
            normalized.includes('cost') ||
            normalized.includes('value') ||
            normalized.includes('rate') ||
            normalized.includes('margin')
        );
    }
}
