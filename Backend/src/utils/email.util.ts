import nodemailer from 'nodemailer';
import { logger } from '../middleware/logger.middleware';

type StockAlertSeverity = 'out_of_stock' | 'critical' | 'warning' | 'info';
type ExpiryAlertSeverity = 'critical' | 'warning' | 'info';

interface LowStockAlertEmailPayload {
    facilityName: string;
    medicineName: string;
    currentStock: number;
    minLevel: number;
    severity: StockAlertSeverity;
}

interface ExpiryAlertEmailPayload {
    facilityName: string;
    medicineName: string;
    batchNumber: string;
    expiryDate: Date;
    daysUntilExpiry: number;
    severity: ExpiryAlertSeverity;
}

interface AlertTheme {
    label: string;
    color: string;
    background: string;
    border: string;
}

export class EmailUtil {
    private static transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    static async sendPurchaseOrderToSupplier(supplierEmail: string, po: any): Promise<boolean> {
        const subject = `Purchase Order ${po.order_number} from ${po.facility?.name}`;

        const items = Array.isArray(po.items) ? po.items : [];
        const itemsRows = items
            .map(
                (item: any) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.medicine?.name || '(unknown)'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity_ordered || 0} msre</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.unit_price || 0}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.total_price || 0}</td>
            </tr>
        `,
            )
            .join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
                <div style="background-color: #f8f9fa; padding: 20px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #2c3e50;">Purchase Order: ${po.order_number}</h2>
                    <p style="margin: 5px 0 0; color: #7f8c8d;">Date: ${new Date(po.created_at).toLocaleDateString()}</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 2px solid #0d9488; padding-bottom: 10px; color: #0d9488;">Facility Details</h3>
                    <p><strong>${po.facility?.name}</strong><br>
                    ${po.facility?.address || ''}<br>
                    ${po.facility?.contact_phone || ''}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Item / Medicine</th>
                            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Quantity</th>
                            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Unit Price</th>
                            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold;">
                            <td colspan="3" style="padding: 10px; text-align: right; border-top: 2px solid #e2e8f0;">Total Amount:</td>
                            <td style="padding: 10px; border-top: 2px solid #e2e8f0;">${po.total_amount}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/public/po/${po.token}" 
                       style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        View Purchase Order
                    </a>
                </div>

                <div style="background-color: #fff7ed; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <p style="margin: 0; color: #c2410c;"><strong>Note:</strong> Please confirm receipt of this order and provide estimated delivery date.</p>
                </div>
            </div>
        `;

        return this.sendEmail(supplierEmail, subject, html);
    }

    static async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        try {
            if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                logger.warn('SMTP credentials not found. Email sending skipped.');

                if (process.env.NODE_ENV === 'production') {
                    return false;
                }

                console.log('\n--- [MOCK EMAIL START] ---');
                console.log(`To: ${to}`);
                console.log(`Subject: ${subject}`);
                console.log('--- Content ---');
                console.log(html);
                console.log('--- [MOCK EMAIL END] ---\n');

                logger.info(`[MOCK EMAIL LOGGED] To: ${to}, Subject: ${subject}`);
                return true;
            }

            const info = await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"Tangacare" <noreply@tangacare.com>',
                to,
                subject,
                html,
            });

            logger.info(`Email sent: ${info.messageId}`);
            return true;
        } catch (error) {
            logger.error('Error sending email:', error);
            return false;
        }
    }

    static async sendLowStockAlertEmail(to: string, payload: LowStockAlertEmailPayload): Promise<boolean> {
        const medicineName = this.escapeHtml(payload.medicineName);
        const facilityName = this.escapeHtml(payload.facilityName);
        const shortfall = Math.max(0, payload.minLevel - payload.currentStock);
        const severityTheme = this.getAlertTheme(payload.severity);

        const subjectPrefix =
            payload.severity === 'out_of_stock'
                ? 'OUT OF STOCK'
                : payload.severity === 'critical'
                    ? 'CRITICAL LOW STOCK'
                    : payload.severity === 'warning'
                        ? 'LOW STOCK WARNING'
                        : 'LOW STOCK NOTICE';
        const subject = `${subjectPrefix}: ${medicineName} (${facilityName})`;

        const html = this.renderAlertLayout({
            title: 'Low Stock Alert',
            subtitle: `${medicineName} has reached its reorder threshold at ${facilityName}.`,
            theme: severityTheme,
            summaryTableRows: [
                ['Medicine', medicineName],
                ['Current Stock', String(payload.currentStock)],
                ['Minimum Level', String(payload.minLevel)],
                ['Suggested Reorder Qty', String(shortfall)],
            ],
            actionItems: [
                'Create or update a purchase order for this medicine.',
                'Validate pending receipts and transfers for delayed stock.',
                'Review dispensing velocity to avoid stockouts.',
            ],
        });

        return this.sendEmail(to, subject, html);
    }

    static async sendExpiryAlertEmail(to: string, payload: ExpiryAlertEmailPayload): Promise<boolean> {
        const medicineName = this.escapeHtml(payload.medicineName);
        const facilityName = this.escapeHtml(payload.facilityName);
        const batchNumber = this.escapeHtml(payload.batchNumber);
        const expiryDateFormatted = this.formatDate(payload.expiryDate);
        const severityTheme = this.getAlertTheme(payload.severity);
        const statusLabel = payload.daysUntilExpiry < 0 ? 'Expired' : 'Expiring Soon';

        const subjectPrefix =
            payload.severity === 'critical'
                ? 'CRITICAL EXPIRY ALERT'
                : payload.severity === 'warning'
                    ? 'EXPIRY WARNING'
                    : 'EXPIRY NOTICE';
        const subject = `${subjectPrefix}: ${medicineName} / Batch ${batchNumber} (${facilityName})`;

        const remainingText =
            payload.daysUntilExpiry < 0
                ? `${Math.abs(payload.daysUntilExpiry)} day(s) past expiry`
                : `${payload.daysUntilExpiry} day(s) remaining`;

        const html = this.renderAlertLayout({
            title: 'Medicine Expiry Alert',
            subtitle: `${medicineName} batch monitoring requires attention at ${facilityName}.`,
            theme: severityTheme,
            summaryTableRows: [
                ['Medicine', medicineName],
                ['Batch Number', batchNumber],
                ['Expiry Date', expiryDateFormatted],
                ['Status', statusLabel],
                ['Time To Expiry', remainingText],
            ],
            actionItems:
                payload.daysUntilExpiry < 0
                    ? [
                        'Quarantine and remove the expired batch from active stock immediately.',
                        'Record an expiry adjustment and update stock movement logs.',
                        'Check for any open dispensing tasks that reference this batch.',
                    ]
                    : [
                        'Prioritize this batch in FEFO dispensing.',
                        'Plan redistribution or supplier return if overstock risk exists.',
                        'Confirm near-expiry dashboard items with the pharmacy team.',
                    ],
        });

        return this.sendEmail(to, subject, html);
    }

    private static renderAlertLayout(params: {
        title: string;
        subtitle: string;
        theme: AlertTheme;
        summaryTableRows: Array<[string, string]>;
        actionItems: string[];
    }): string {
        const rows = params.summaryTableRows
            .map(
                ([label, value]) => `
                    <tr>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #334155; font-weight: 700; width: 42%;">${label}</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #0f172a;">${value}</td>
                    </tr>
                `,
            )
            .join('');

        const actions = params.actionItems
            .map((item) => `<li style="margin: 0 0 8px 0;">${this.escapeHtml(item)}</li>`)
            .join('');

        return `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #ffffff;">
                <div style="background: #0f766e; padding: 16px 20px;">
                    <h2 style="margin: 0; color: #ffffff; font-size: 20px;">${this.escapeHtml(params.title)}</h2>
                </div>

                <div style="padding: 18px 20px;">
                    <p style="margin: 0 0 12px 0; color: #334155;">${this.escapeHtml(params.subtitle)}</p>

                    <div style="display: inline-block; margin-bottom: 14px; background: ${params.theme.background}; color: ${params.theme.color}; border: 1px solid ${params.theme.border}; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700;">
                        ${params.theme.label}
                    </div>

                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <tbody>${rows}</tbody>
                    </table>

                    <div style="margin-top: 16px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <p style="margin: 0 0 8px 0; color: #0f172a; font-weight: 700;">Recommended Actions</p>
                        <ul style="margin: 0 0 0 20px; color: #334155; padding: 0;">${actions}</ul>
                    </div>

                    <p style="margin: 16px 0 0 0; font-size: 12px; color: #64748b;">
                        Generated on ${this.formatDateTime(new Date())}
                    </p>
                </div>

                <div style="padding: 12px 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #64748b; font-size: 12px;">
                    Powered by Tanghub services - https://www.tangahubservice.com/
                </div>
            </div>
        `;
    }

    private static getAlertTheme(severity: StockAlertSeverity | ExpiryAlertSeverity): AlertTheme {
        if (severity === 'out_of_stock' || severity === 'critical') {
            return {
                label: severity === 'out_of_stock' ? 'Out Of Stock' : 'Critical',
                color: '#b91c1c',
                background: '#fee2e2',
                border: '#fecaca',
            };
        }
        if (severity === 'warning') {
            return {
                label: 'Warning',
                color: '#92400e',
                background: '#fef3c7',
                border: '#fde68a',
            };
        }
        return {
            label: 'Info',
            color: '#1e40af',
            background: '#dbeafe',
            border: '#bfdbfe',
        };
    }

    private static formatDate(value: Date): string {
        return new Date(value).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        });
    }

    private static formatDateTime(value: Date): string {
        return new Date(value).toLocaleString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    private static escapeHtml(value: string): string {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    static async sendVerificationEmail(to: string, name: string, otp: string): Promise<boolean> {
        const subject = 'Verify Your Tangacare Account';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #2c3e50; text-align: center;">Welcome to Tangacare!</h2>
                <p>Hello <strong>${name}</strong>,</p>
                <p>Thank you for registering with Tangacare. To complete your account setup, please verify your email address using the code below:</p>
                <div style="background-color: #f0f7ff; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; border: 1px solid #d0e3ff;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0066cc;">${otp}</span>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not create an account, please ignore this email.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c8d; text-align: center;">
                    &copy; ${new Date().getFullYear()} Tangacare Telemedicine. All rights reserved.
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    }

    static async sendStaffWelcomeEmail(
        to: string,
        name: string,
        otp: string,
        roleLabel: string,
        orgName: string,
        verificationLink: string,
        facilityName?: string,
    ): Promise<boolean> {
        const whereJoining = facilityName ? `${orgName} – ${facilityName}` : orgName;
        const subject = 'Welcome to Tangacare – Verify and set up your account';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #2c3e50; text-align: center;">Welcome to Tangacare!</h2>
                <p>Hello <strong>${name}</strong>,</p>
                <p>You have been added as staff with the following details:</p>
                <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 8px 0;"><strong>Email (login):</strong> ${to}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${roleLabel}</p>
                    <p style="margin: 0;"><strong>Where you're joining:</strong> ${whereJoining}</p>
                </div>
                <p>To activate your account and set your password, click the link below to verify your email:</p>
                <p style="text-align: center; margin: 24px 0;">
                    <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify and set up account</a>
                </p>
                <p style="font-size: 13px; color: #64748b;">Or copy this link into your browser:</p>
                <p style="font-size: 12px; word-break: break-all; color: #64748b;">${verificationLink}</p>
                <p>When prompted, enter this verification code:</p>
                <div style="background-color: #f0f7ff; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; border: 1px solid #d0e3ff;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0066cc;">${otp}</span>
                </div>
                <p style="font-size: 12px; color: #64748b;">This code expires in 10 minutes. After verification you will set your own password.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c8d; text-align: center;">
                    &copy; ${new Date().getFullYear()} Tangacare. All rights reserved.
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    }

    static async sendPasswordResetEmail(to: string, name: string, otp: string): Promise<boolean> {
        const subject = 'Reset Your Password - Tangacare';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; border-top: 4px solid #e74c3c;">
                <h2 style="color: #c0392b; text-align: center;">Password Reset Request</h2>
                <p>Hello <strong>${name}</strong>,</p>
                <p>We received a request to reset your Tangacare password. If this was you, please use the following code to reset it:</p>
                <div style="background-color: #fff5f5; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; border: 1px solid #ffe0e0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #c0392b;">${otp}</span>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c8d; text-align: center;">
                    &copy; ${new Date().getFullYear()} Tangacare Telemedicine. All rights reserved.
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    }
}
