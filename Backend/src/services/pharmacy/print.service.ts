import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SaleService } from './sale.service';

const execAsync = promisify(exec);

export interface PrintOptions {
    printerName?: string;
    copies?: number;
    duplex?: boolean;
    paperSize?: 'A4' | 'A5' | 'Letter';
}

export class PrintService {
    private saleService: SaleService;

    constructor() {
        this.saleService = new SaleService();
    }

    /**
     * Print invoice directly to printer with cashier name
     */
    async printInvoice(
        saleId: number,
        organizationId: number,
        facilityId: number,
        options: PrintOptions = {},
    ): Promise<void> {
        try {
            // Generate PDF receipt
            const pdfBuffer = await this.saleService.generateReceiptPdf(saleId, organizationId, facilityId);
            
            // Create temporary file
            const tempDir = os.tmpdir();
            const fileName = `invoice_${saleId}_${Date.now()}.pdf`;
            const tempFilePath = path.join(tempDir, fileName);
            
            // Write PDF to temporary file
            fs.writeFileSync(tempFilePath, pdfBuffer);
            
            try {
                // Print command based on OS
                const printCommand = this.buildPrintCommand(tempFilePath, options);
                await execAsync(printCommand);
                
                console.log(`Invoice ${saleId} printed successfully`);
            } finally {
                // Clean up temporary file
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (error) {
                    console.warn('Failed to clean up temporary file:', error);
                }
            }
        } catch (error: any) {
            console.error('Failed to print invoice:', error);
            throw new Error(`Failed to print invoice: ${error.message}`);
        }
    }

    /**
     * Get available printers
     */
    async getAvailablePrinters(): Promise<string[]> {
        try {
            const platform = os.platform();
            let command: string;
            
            if (platform === 'win32') {
                // Windows
                command = 'wmic printer get name';
            } else if (platform === 'darwin') {
                // macOS
                command = 'lpstat -p';
            } else {
                // Linux
                command = 'lpstat -p';
            }
            
            const { stdout } = await execAsync(command);
            return this.parsePrinterList(stdout, platform);
        } catch (error) {
            console.error('Failed to get printers:', error);
            return [];
        }
    }

    /**
     * Build print command based on operating system
     */
    private buildPrintCommand(filePath: string, options: PrintOptions): string {
        const platform = os.platform();
        const { printerName, copies = 1, duplex = false, paperSize = 'A4' } = options;
        
        if (platform === 'win32') {
            // Windows - use powershell
            let command = `powershell -Command "& {Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{P}'); Start-Sleep -Seconds 2; [System.Windows.Forms.SendKeys]::SendWait('${filePath}'); Start-Sleep -Seconds 1; [System.Windows.Forms.SendKeys]::SendWait('~');}"`;
            
            if (printerName) {
                command = `powershell -Command "& {Add-Type -AssemblyName System.Drawing; $printer = New-Object System.Drawing.Printing.PrinterDocument; $printer.PrinterSettings.PrinterName = '${printerName}'; $printer.Print(); Start-Process -FilePath '${filePath}' -ArgumentList '/p' -Wait }"`;
            }
            
            return command;
        } else if (platform === 'darwin') {
            // macOS - use lp command
            let command = `lp "${filePath}"`;
            
            if (printerName) {
                command += ` -d "${printerName}"`;
            }
            
            if (copies > 1) {
                command += ` -n ${copies}`;
            }
            
            if (duplex) {
                command += ' -o sides=two-sided-long-edge';
            }
            
            return command;
        } else {
            // Linux - use lp command
            let command = `lp "${filePath}"`;
            
            if (printerName) {
                command += ` -d "${printerName}"`;
            }
            
            if (copies > 1) {
                command += ` -n ${copies}`;
            }
            
            if (duplex) {
                command += ' -o sides=two-sided-long-edge';
            }
            
            if (paperSize) {
                command += ` -o media=${paperSize.toLowerCase()}`;
            }
            
            return command;
        }
    }

    /**
     * Parse printer list from command output
     */
    private parsePrinterList(output: string, platform: string): string[] {
        const printers: string[] = [];
        const lines = output.split('\n');
        
        if (platform === 'win32') {
            // Windows WMIC output
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && trimmed !== 'Name' && !trimmed.includes('No Instance')) {
                    printers.push(trimmed);
                }
            }
        } else {
            // Unix-like systems (lpstat output)
            for (const line of lines) {
                const match = line.match(/printer (.+) is/i);
                if (match && match[1]) {
                    printers.push(match[1].trim());
                }
            }
        }
        
        return printers;
    }

    /**
     * Test printer availability
     */
    async testPrinter(printerName?: string): Promise<boolean> {
        try {
            const printers = await this.getAvailablePrinters();
            
            if (!printerName) {
                return printers.length > 0;
            }
            
            return printers.includes(printerName);
        } catch (error) {
            return false;
        }
    }
}
