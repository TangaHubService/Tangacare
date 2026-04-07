export interface PrintInvoiceDto {
    printerName?: string;
    copies?: number;
    duplex?: boolean;
    paperSize?: 'A4' | 'A5' | 'Letter';
}

export interface TestPrinterDto {
    printerName?: string;
}
