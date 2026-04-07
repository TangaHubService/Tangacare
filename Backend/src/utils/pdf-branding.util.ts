import fs from 'fs';
import path from 'path';

export class PdfBrandingUtil {
    static readonly FOOTER_TEXT = 'Powered by Tanghub services https://www.tangahubservice.com/';

    private static logoBufferCache: Buffer | null | undefined;

    static drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size: number = 26): number {
        const logoBuffer = this.resolveLogoBuffer();
        if (!logoBuffer) {
            return 0;
        }

        try {
            doc.image(logoBuffer, x, y, { fit: [size, size] });
            return size + 8;
        } catch {
            return 0;
        }
    }

    static decorateBufferedPages(doc: PDFKit.PDFDocument, footerText: string = PdfBrandingUtil.FOOTER_TEXT): void {
        const range = doc.bufferedPageRange();
        const totalPages = range.count;

        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(range.start + i);
            this.drawFooter(doc, footerText, i + 1, totalPages);
        }
    }

    private static drawFooter(
        doc: PDFKit.PDFDocument,
        footerText: string,
        pageNo: number,
        totalPages: number,
    ): void {
        const left = doc.page.margins.left;
        const right = doc.page.width - doc.page.margins.right;
        const width = right - left;
        const dividerY = doc.page.height - doc.page.margins.bottom - 14;
        const footerY = dividerY + 4;

        doc.save();
        doc.moveTo(left, dividerY).lineTo(right, dividerY).strokeColor('#dbe5ef').lineWidth(0.7).stroke();
        doc.font('Helvetica')
            .fontSize(7.6)
            .fillColor('#64748b')
            .text(footerText, left, footerY, { width, align: 'center' });
        doc.font('Helvetica')
            .fontSize(7)
            .fillColor('#94a3b8')
            .text(`Page ${pageNo} of ${totalPages}`, left, footerY + 10, { width, align: 'center' });
        doc.restore();
    }

    private static resolveLogoBuffer(): Buffer | null {
        if (this.logoBufferCache !== undefined) {
            return this.logoBufferCache;
        }

        const candidates = this.getLogoCandidates();
        for (const logoPath of candidates) {
            try {
                if (logoPath && fs.existsSync(logoPath)) {
                    this.logoBufferCache = fs.readFileSync(logoPath);
                    return this.logoBufferCache;
                }
            } catch {
                // Ignore unreadable paths and continue trying fallbacks.
            }
        }

        this.logoBufferCache = null;
        return this.logoBufferCache;
    }

    private static getLogoCandidates(): string[] {
        const configuredPath = process.env.PDF_BRAND_LOGO_PATH;

        return [
            configuredPath ? path.resolve(configuredPath) : '',
            path.resolve(process.cwd(), 'public', 'logo.png'),
            path.resolve(process.cwd(), 'assets', 'logo.png'),
            path.resolve(process.cwd(), '..', 'TangaCare-pharuma', 'public', 'logo.png'),
            path.resolve(process.cwd(), '..', 'TangaCare-pharuma', 'src', 'assets', 'tanga-logo.png'),
        ].filter(Boolean);
    }
}
