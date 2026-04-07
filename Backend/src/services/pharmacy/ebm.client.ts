import { AppDataSource } from '../../config/database';
import { SettingsService } from './settings.service';
import { SETTINGS_KEYS } from './settings.constants';

export interface EBMSubmitPayload {
    sale_number: string;
    facility_id: number;
    /** Facility TIN — mandatory for every EBM submission */
    facility_tin: string;
    /** EBM device serial registered with RRA */
    device_serial: string;
    total_amount: number;
    vat_amount: number;
    /** Customer TIN (required for B2B sales) */
    customer_tin?: string;
    /** 'normal' | 'credit' | 'debit' */
    invoice_type: string;
    items: Array<{
        description: string;
        /** RRA tax category: A=18%VAT, B=0%VAT, C=Exempt, D=Non-VAT, E=Export */
        tax_category: string;
        quantity: number;
        unit_price: number;
        taxable_amount: number;
        vat_amount: number;
        total: number;
    }>;
}

export interface EBMSubmitResult {
    success: boolean;
    /** RRA-issued receipt number on success */
    reference?: string;
    error?: string;
}

/**
 * C-3b: Real RRA EBM HTTP client.
 *
 * When RRA_EBM_ENABLED=false (or not set) the client returns a STUB reference
 * so development and staging flows are not broken.
 *
 * When RRA_EBM_ENABLED=true it makes actual HTTP requests to the RRA EBM API.
 * Failed submissions are enqueued in `ebm_submission_queue` for automatic retry.
 */
export class EBMClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly deviceSerial: string;
    readonly enabled: boolean;

    constructor() {
        this.baseUrl = process.env.RRA_EBM_BASE_URL || 'https://ebm.rra.gov.rw/api';
        this.apiKey = process.env.RRA_EBM_API_KEY || '';
        this.deviceSerial = process.env.RRA_EBM_DEVICE_SERIAL || '';
        this.enabled = process.env.RRA_EBM_ENABLED === 'true';
    }

    // ── Public API ──────────────────────────────────────────────────────────

    async submitFiscalInvoice(payload: EBMSubmitPayload): Promise<EBMSubmitResult> {
        // H-11: Check effective tenant/branch EBM toggle before submission
        const settingsService = new SettingsService();
        const [configuredEbmEnabled, fiscalProvider, configuredEndpoint] = await Promise.all([
            settingsService
                .getEffectiveValue<boolean>(SETTINGS_KEYS.FISCAL_EBM_ENABLED, { branchId: payload.facility_id })
                .catch(() => undefined),
            settingsService
                .getEffectiveValue<string>(SETTINGS_KEYS.FISCAL_PROVIDER, { branchId: payload.facility_id })
                .catch(() => undefined),
            settingsService
                .getEffectiveValue<string>(SETTINGS_KEYS.INTEGRATIONS_EBM_ENDPOINT, { branchId: payload.facility_id })
                .catch(() => undefined),
        ]);

        const facility = await AppDataSource.query('SELECT ebm_enabled FROM facilities WHERE id = $1', [payload.facility_id]);
        const branchEnabled = configuredEbmEnabled ?? !!facility[0]?.ebm_enabled;
        const providerAllowsSubmit = !fiscalProvider || fiscalProvider === 'rra_ebm';

        if (!this.enabled || !branchEnabled || !providerAllowsSubmit) {
            console.info(
                `[EBM] Skipped: Global=${this.enabled}, Branch=${branchEnabled}, Provider=${fiscalProvider || 'default'}`,
            );
            return { success: true, reference: `STUB-${Date.now()}` };
        }
        return this.postWithRetry('/invoices/fiscal', payload, 3, configuredEndpoint);
    }

    async submitCreditNote(
        saleReference: string,
        amount: number,
        reason: string,
    ): Promise<EBMSubmitResult> {
        if (!this.enabled) return { success: true, reference: `CN-STUB-${Date.now()}` };
        return this.postWithRetry('/invoices/credit-note', { saleReference, amount, reason }, 3);
    }

    async submitDebitNote(
        saleReference: string,
        amount: number,
        reason: string,
    ): Promise<EBMSubmitResult> {
        if (!this.enabled) return { success: true, reference: `DN-STUB-${Date.now()}` };
        return this.postWithRetry('/invoices/debit-note', { saleReference, amount, reason }, 3);
    }

    // ── Retry Queue ─────────────────────────────────────────────────────────

    /**
     * Enqueue a failed submission for background retry.
     * Called by the sale service when the initial submitFiscalInvoice fails.
     */
    async enqueueRetry(saleId: number, payload: EBMSubmitPayload): Promise<void> {
        try {
            await AppDataSource.query(
                `INSERT INTO ebm_submission_queue (sale_id, payload, status)
                 VALUES ($1, $2, 'pending')
                 ON CONFLICT DO NOTHING`,
                [saleId, payload],
            );
        } catch (err) {
            console.error('[EBM] Failed to enqueue retry:', err);
        }
    }

    /**
     * Process pending retries — called by the scheduler every 15 minutes.
     * Attempts up to MAX_ATTEMPTS per item. Updates sales.fiscal_status on success.
     */
    async processRetryQueue(): Promise<void> {
        const MAX_ATTEMPTS = 3;
        const rows = await AppDataSource.query<Array<{ id: number; sale_id: number; payload: EBMSubmitPayload }>>(
            `SELECT id, sale_id, payload FROM ebm_submission_queue
             WHERE status = 'pending' AND attempt_count < $1
             ORDER BY created_at ASC LIMIT 50`,
            [MAX_ATTEMPTS],
        );

        for (const row of rows) {
            // Mark as in-progress to avoid duplicate processing
            await AppDataSource.query(
                `UPDATE ebm_submission_queue
                 SET attempt_count = attempt_count + 1, last_attempt_at = NOW()
                 WHERE id = $1`,
                [row.id],
            );

            const result = await this.postWithRetry('/invoices/fiscal', row.payload, 1);

            if (result.success) {
                await AppDataSource.query(
                    `UPDATE ebm_submission_queue SET status = 'success' WHERE id = $1`,
                    [row.id],
                );
                await AppDataSource.query(
                    `UPDATE sales
                     SET fiscal_status = 'sent',
                         ebm_submitted_at = NOW(),
                         ebm_reference = $1,
                         ebm_receipt_number = $1
                     WHERE id = $2`,
                    [result.reference, row.sale_id],
                );
            } else {
                // If max attempts reached, mark permanently failed
                const queueRow = await AppDataSource.query<Array<{ attempt_count: number }>>(
                    `SELECT attempt_count FROM ebm_submission_queue WHERE id = $1`,
                    [row.id],
                );
                const attempts = queueRow[0]?.attempt_count ?? 0;
                if (attempts >= MAX_ATTEMPTS) {
                    await AppDataSource.query(
                        `UPDATE ebm_submission_queue SET status = 'failed', error_message = $1 WHERE id = $2`,
                        [result.error, row.id],
                    );
                    await AppDataSource.query(
                        `UPDATE sales SET fiscal_status = 'failed' WHERE id = $1`,
                        [row.sale_id],
                    );
                }
            }
        }
    }

    // ── Private HTTP helper ─────────────────────────────────────────────────

    private async postWithRetry(path: string, body: object, maxAttempts: number, baseUrlOverride?: string): Promise<EBMSubmitResult> {
        let lastError = '';
        const targetBaseUrl = baseUrlOverride && baseUrlOverride.trim() ? baseUrlOverride.trim() : this.baseUrl;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(`${targetBaseUrl}${path}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                        'X-Device-Serial': this.deviceSerial,
                    },
                    signal: AbortSignal.timeout(10_000), // 10 s timeout
                    body: JSON.stringify(body),
                });

                const data = (await response.json()) as { rcptNo?: string; message?: string };

                if (!response.ok) {
                    lastError = data.message ?? `HTTP ${response.status}`;
                    console.warn(`[EBM] Attempt ${attempt}/${maxAttempts} failed: ${lastError}`);
                    if (attempt < maxAttempts) await this.delay(attempt * 500);
                    continue;
                }

                return { success: true, reference: data.rcptNo };
            } catch (err: any) {
                lastError = err?.message ?? 'Network error';
                console.warn(`[EBM] Attempt ${attempt}/${maxAttempts} error: ${lastError}`);
                if (attempt < maxAttempts) await this.delay(attempt * 500);
            }
        }

        return { success: false, error: lastError };
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
