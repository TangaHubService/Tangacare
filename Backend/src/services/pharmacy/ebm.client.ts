import { AppDataSource } from '../../config/database';
import { SettingsService } from './settings.service';
import { SETTINGS_KEYS } from './settings.constants';
import { logger } from '../../middleware/logger.middleware';
import {
    evaluateVsdcResponse,
    mapToVsdcSaleRequest,
    ReceiptTypeCode,
    TransactionTypeCode,
    VsdcApiResponse,
    VsdcReceiptLineItem,
    VsdcSaleRequestInput,
} from './vsdc.contract';
import crypto from 'crypto';

export interface EBMSubmitPayload {
    sale_number: string;
    sale_id?: number;
    facility_id: number;
    organization_id?: number;
    branch_id: string;
    invoice_number: number;
    /** Facility TIN — mandatory for every EBM submission */
    facility_tin: string;
    /** EBM device serial registered with RRA */
    device_serial: string;
    sdc_id?: string;
    mrc_no?: string;
    receipt_type?: ReceiptTypeCode;
    transaction_type?: TransactionTypeCode;
    payment_type_code?: string;
    customer_name?: string;
    total_amount: number;
    vat_amount: number;
    taxable_amount_a?: number;
    taxable_amount_b?: number;
    taxable_amount_c?: number;
    taxable_amount_d?: number;
    /** Customer TIN (required for B2B sales) */
    customer_tin?: string;
    purchase_order_code?: string;
    /** 'normal' | 'credit' | 'debit' */
    invoice_type: string;
    sale_datetime: Date;
    report_number?: number;
    trade_name?: string;
    address?: string;
    top_message?: string;
    bottom_message?: string;
    initiated_by: string;
    items: Array<{
        description: string;
        item_code: string;
        item_class_code?: string;
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
    totalReceiptNumber?: number;
    internalData?: string;
    receiptSignature?: string;
    publishedAt?: Date | null;
    sdcId?: string;
    mrcNo?: string;
    errorCode?: string;
    retryable?: boolean;
    error?: string;
}

type QueueDocumentType = 'sale' | 'credit_note' | 'debit_note';
type QueueStatus = 'pending' | 'processing' | 'retryable' | 'success' | 'dead_letter';
type RetryPolicy = {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    claimTtlSeconds: number;
    batchSize: number;
};

type QueueRow = {
    id: number;
    sale_id: number | null;
    payload: EBMSubmitPayload;
    document_type: QueueDocumentType;
    document_id: number;
    attempt_count: number;
};

type QueueStats = {
    pending: number;
    retryable: number;
    processing: number;
    deadLetter: number;
};

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
    private readonly workerId: string;
    readonly enabled: boolean;

    constructor() {
        this.baseUrl = process.env.RRA_EBM_BASE_URL || 'https://ebm.rra.gov.rw';
        this.apiKey = process.env.RRA_EBM_API_KEY || '';
        this.deviceSerial = process.env.RRA_EBM_DEVICE_SERIAL || '';
        this.enabled = process.env.RRA_EBM_ENABLED === 'true';
        this.workerId = `pid-${process.pid}`;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    async submitFiscalInvoice(payload: EBMSubmitPayload): Promise<EBMSubmitResult> {
        if (!this.enabled) {
            return { success: true, reference: `STUB-${Date.now()}` };
        }

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
        const providerAllowsSubmit = !fiscalProvider || ['rra_ebm', 'rra_vsdc'].includes(fiscalProvider);

        if (!this.enabled || !branchEnabled || !providerAllowsSubmit) {
            logger.info('[VSDC] Submission skipped by configuration', {
                globalEnabled: this.enabled,
                branchEnabled,
                provider: fiscalProvider || 'default',
                saleNumber: payload.sale_number,
            });
            return { success: true, reference: `STUB-${Date.now()}` };
        }
        const retryPolicy = this.resolveRetryPolicy(
            await settingsService
                .getEffectiveValue<any>(SETTINGS_KEYS.INTEGRATIONS_EBM_RETRY_POLICY, {
                    branchId: payload.facility_id,
                })
                .catch(() => undefined),
        );
        const request = this.toVsdcSaleRequest(payload);
        return this.postVsdcWithRetry('/trnsSales/saveSales', request, retryPolicy, configuredEndpoint);
    }

    async submitCreditNote(payload: EBMSubmitPayload): Promise<EBMSubmitResult> {
        if (!this.enabled) return { success: true, reference: `CN-STUB-${Date.now()}` };
        const request = this.toVsdcSaleRequest({
            ...payload,
            invoice_type: 'credit',
            transaction_type: TransactionTypeCode.REFUND,
            receipt_type: ReceiptTypeCode.NORMAL,
        });
        return this.postVsdcWithRetry('/trnsSales/saveSales', request, this.defaultRetryPolicy());
    }

    async submitDebitNote(payload: EBMSubmitPayload): Promise<EBMSubmitResult> {
        if (!this.enabled) return { success: true, reference: `DN-STUB-${Date.now()}` };
        const request = this.toVsdcSaleRequest({
            ...payload,
            invoice_type: 'debit',
            transaction_type: TransactionTypeCode.SALE,
            receipt_type: ReceiptTypeCode.NORMAL,
        });
        return this.postVsdcWithRetry('/trnsSales/saveSales', request, this.defaultRetryPolicy());
    }

    // ── Retry Queue ─────────────────────────────────────────────────────────

    async enqueueRetry(
        documentType: QueueDocumentType,
        documentId: number,
        saleId: number | null,
        payload: EBMSubmitPayload,
    ): Promise<void> {
        const dedupeKey = this.computeDedupeKey(documentType, documentId, payload);
        try {
            await AppDataSource.query(
                `INSERT INTO ebm_submission_queue
                    (sale_id, payload, status, document_type, document_id, dedupe_key, next_attempt_at)
                 VALUES ($1, $2, 'pending', $3, $4, $5, NOW())
                 ON CONFLICT (dedupe_key) DO UPDATE
                 SET payload = EXCLUDED.payload, status = 'pending', next_attempt_at = NOW(), updated_at = NOW()`,
                [saleId, payload, documentType, documentId, dedupeKey],
            );
            logger.info('[VSDC] queued fiscal retry', { documentType, documentId, saleId, dedupeKey });
        } catch (err) {
            logger.error('[VSDC] failed to enqueue retry', { documentType, documentId, saleId, err });
        }
    }

    async processRetryQueue(): Promise<void> {
        const policy = this.defaultRetryPolicy();
        const rows = await this.claimRetryRows(policy);

        if (rows.length === 0) {
            return;
        }

        logger.info('[VSDC] retry queue batch claimed', { count: rows.length, workerId: this.workerId });

        for (const row of rows) {
            const request = this.toVsdcSaleRequest(row.payload);
            const result = await this.postVsdcWithRetry('/trnsSales/saveSales', request, {
                ...policy,
                maxAttempts: 1,
            });

            if (result.success) {
                await this.markQueueSuccess(row.id, result);
                await this.markFiscalSuccess(row.document_type, row.document_id, row.sale_id, result);
                continue;
            }

            await this.markQueueFailure(row, result, policy);
            await this.markFiscalFailure(row.document_type, row.document_id, row.sale_id);
        }
    }

    async getQueueStats(): Promise<QueueStats> {
        const rows = await AppDataSource.query<Array<{ status: QueueStatus; count: string }>>(
            `SELECT status, COUNT(*)::text AS count
             FROM ebm_submission_queue
             GROUP BY status`,
        );
        const counter: Record<string, number> = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
        return {
            pending: counter.pending || 0,
            retryable: counter.retryable || 0,
            processing: counter.processing || 0,
            deadLetter: counter.dead_letter || 0,
        };
    }

    // ── Private HTTP helper ─────────────────────────────────────────────────

    private async postVsdcWithRetry(
        path: string,
        body: object,
        policy: RetryPolicy,
        baseUrlOverride?: string,
    ): Promise<EBMSubmitResult> {
        let lastError = '';
        let lastCode = '999';
        let lastRetryable = true;
        const targetBaseUrl = baseUrlOverride && baseUrlOverride.trim() ? baseUrlOverride.trim() : this.baseUrl;

        for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
            try {
                const response = await fetch(`${targetBaseUrl}${path}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                        'X-Device-Serial': this.deviceSerial,
                    },
                    signal: AbortSignal.timeout(10_000),
                    body: JSON.stringify(body),
                });

                const responseData = (await response.json()) as VsdcApiResponse;
                if (!response.ok && !responseData.resultCd) {
                    responseData.resultCd = String(response.status);
                    responseData.resultMsg = responseData.resultMsg || `HTTP ${response.status}`;
                }
                const evaluation = evaluateVsdcResponse(responseData);
                if (evaluation.ok && evaluation.receipt) {
                    return {
                        success: true,
                        reference: evaluation.receipt.receiptNumber,
                        totalReceiptNumber: evaluation.receipt.totalReceiptNumber,
                        internalData: evaluation.receipt.internalData,
                        receiptSignature: evaluation.receipt.receiptSignature,
                        publishedAt: evaluation.receipt.publishedAt,
                        sdcId: evaluation.receipt.sdcId,
                        mrcNo: evaluation.receipt.mrcNo,
                    };
                }

                lastError = evaluation.message;
                lastCode = evaluation.code;
                lastRetryable = evaluation.retryable;
                logger.warn('[VSDC] submit attempt failed', {
                    attempt,
                    maxAttempts: policy.maxAttempts,
                    code: evaluation.code,
                    retryable: evaluation.retryable,
                    message: evaluation.message,
                });

                if (!evaluation.retryable || attempt >= policy.maxAttempts) break;
                await this.delay(this.computeAttemptDelayMs(attempt, policy));
            } catch (err: any) {
                lastError = err?.message ?? 'Network error';
                lastCode = '894';
                lastRetryable = true;
                logger.warn('[VSDC] submit attempt errored', {
                    attempt,
                    maxAttempts: policy.maxAttempts,
                    error: lastError,
                });
                if (attempt < policy.maxAttempts) await this.delay(this.computeAttemptDelayMs(attempt, policy));
            }
        }

        return { success: false, error: lastError, errorCode: lastCode, retryable: lastRetryable };
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private toVsdcSaleRequest(payload: EBMSubmitPayload) {
        const lineItems: VsdcReceiptLineItem[] = payload.items.map((item, index) => ({
            itemSeq: index + 1,
            itemCd: item.item_code,
            itemClsCd: item.item_class_code,
            itemNm: item.description,
            qty: item.quantity,
            prc: item.unit_price,
            splyAmt: item.taxable_amount,
            dcRt: 0,
            dcAmt: 0,
            taxTyCd: item.tax_category || 'B',
            taxblAmt: item.taxable_amount,
            taxAmt: item.vat_amount,
            totAmt: item.total,
        }));

        const input: VsdcSaleRequestInput = {
            tin: payload.facility_tin,
            bhfId: payload.branch_id,
            invcNo: payload.invoice_number,
            orgInvcNo: 0,
            custTin: payload.customer_tin,
            custNm: payload.customer_name,
            prcOrdCd: payload.purchase_order_code,
            rcptTyCd: payload.transaction_type || TransactionTypeCode.SALE,
            pmtTyCd: payload.payment_type_code,
            cfmDt: this.formatDate(payload.sale_datetime, true),
            salesDt: this.formatDate(payload.sale_datetime, false),
            rptNo: payload.report_number || payload.invoice_number,
            trdeNm: payload.trade_name,
            adrs: payload.address,
            topMsg: payload.top_message,
            btmMsg: payload.bottom_message,
            taxblAmtA: payload.taxable_amount_a ?? 0,
            taxblAmtB: payload.taxable_amount_b ?? payload.total_amount,
            taxblAmtC: payload.taxable_amount_c ?? 0,
            taxblAmtD: payload.taxable_amount_d ?? 0,
            taxRtA: 0,
            taxRtB: 18,
            taxRtC: 0,
            taxRtD: 0,
            taxAmtA: 0,
            taxAmtB: payload.vat_amount,
            taxAmtC: 0,
            taxAmtD: 0,
            totTaxblAmt: payload.total_amount,
            totTaxAmt: payload.vat_amount,
            totAmt: payload.total_amount,
            itemList: lineItems,
        };

        return mapToVsdcSaleRequest(input);
    }

    private formatDate(value: Date, withTime: boolean): string {
        const source = new Date(value);
        const yyyy = source.getUTCFullYear();
        const mm = String(source.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(source.getUTCDate()).padStart(2, '0');
        if (!withTime) return `${yyyy}${mm}${dd}`;
        const hh = String(source.getUTCHours()).padStart(2, '0');
        const min = String(source.getUTCMinutes()).padStart(2, '0');
        const ss = String(source.getUTCSeconds()).padStart(2, '0');
        return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
    }

    private defaultRetryPolicy(): RetryPolicy {
        return {
            maxAttempts: Number(process.env.RRA_EBM_MAX_ATTEMPTS || 5),
            baseDelayMs: Number(process.env.RRA_EBM_RETRY_BASE_MS || 1_500),
            maxDelayMs: Number(process.env.RRA_EBM_RETRY_MAX_MS || 120_000),
            claimTtlSeconds: Number(process.env.RRA_EBM_QUEUE_CLAIM_TTL_SECONDS || 300),
            batchSize: Number(process.env.RRA_EBM_QUEUE_BATCH_SIZE || 50),
        };
    }

    private resolveRetryPolicy(rawPolicy: unknown): RetryPolicy {
        const defaults = this.defaultRetryPolicy();
        if (!rawPolicy || typeof rawPolicy !== 'object') return defaults;
        const candidate = rawPolicy as Partial<RetryPolicy>;
        return {
            maxAttempts: Number(candidate.maxAttempts || defaults.maxAttempts),
            baseDelayMs: Number(candidate.baseDelayMs || defaults.baseDelayMs),
            maxDelayMs: Number(candidate.maxDelayMs || defaults.maxDelayMs),
            claimTtlSeconds: Number(candidate.claimTtlSeconds || defaults.claimTtlSeconds),
            batchSize: Number(candidate.batchSize || defaults.batchSize),
        };
    }

    private computeAttemptDelayMs(attempt: number, policy: RetryPolicy): number {
        const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)));
        const jitter = Math.floor(Math.random() * 500);
        return exponential + jitter;
    }

    private computeDedupeKey(
        documentType: QueueDocumentType,
        documentId: number,
        payload: EBMSubmitPayload,
    ): string {
        return crypto
            .createHash('sha256')
            .update(`${documentType}:${documentId}:${payload.sale_number}:${payload.invoice_type}:${payload.total_amount}`)
            .digest('hex');
    }

    private async claimRetryRows(policy: RetryPolicy): Promise<QueueRow[]> {
        const rows = await AppDataSource.query<Array<QueueRow>>(
            `WITH candidate AS (
                SELECT id
                FROM ebm_submission_queue
                WHERE status IN ('pending', 'retryable')
                  AND attempt_count < $1
                  AND COALESCE(next_attempt_at, NOW()) <= NOW()
                  AND (locked_at IS NULL OR locked_at < NOW() - ($2::text || ' seconds')::interval)
                ORDER BY created_at ASC
                LIMIT $3
                FOR UPDATE SKIP LOCKED
            )
            UPDATE ebm_submission_queue q
            SET status = 'processing',
                locked_at = NOW(),
                locked_by = $4,
                last_attempt_at = NOW(),
                attempt_count = q.attempt_count + 1,
                updated_at = NOW()
            FROM candidate c
            WHERE q.id = c.id
            RETURNING q.id, q.sale_id, q.payload, q.document_type, q.document_id, q.attempt_count`,
            [policy.maxAttempts, policy.claimTtlSeconds, policy.batchSize, this.workerId],
        );
        return rows || [];
    }

    private async markQueueSuccess(queueId: number, result: EBMSubmitResult): Promise<void> {
        await AppDataSource.query(
            `UPDATE ebm_submission_queue
             SET status = 'success',
                 error_message = NULL,
                 last_error_code = NULL,
                 last_response = $1,
                 locked_at = NULL,
                 locked_by = NULL,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(result), queueId],
        );
    }

    private async markQueueFailure(row: QueueRow, result: EBMSubmitResult, policy: RetryPolicy): Promise<void> {
        const reachedMax = row.attempt_count >= policy.maxAttempts;
        const retryable = !!result.retryable && !reachedMax;
        const nextDelayMs = this.computeAttemptDelayMs(row.attempt_count, policy);
        const nextStatus: QueueStatus = retryable ? 'retryable' : 'dead_letter';

        await AppDataSource.query(
            `UPDATE ebm_submission_queue
             SET status = $1,
                 error_message = $2,
                 last_error_code = $3,
                 last_response = $4,
                 next_attempt_at = CASE
                    WHEN $1 = 'retryable' THEN NOW() + ($5::text || ' milliseconds')::interval
                    ELSE next_attempt_at
                 END,
                 locked_at = NULL,
                 locked_by = NULL,
                 updated_at = NOW()
             WHERE id = $6`,
            [
                nextStatus,
                result.error || 'Unknown VSDC error',
                result.errorCode || null,
                JSON.stringify(result),
                nextDelayMs,
                row.id,
            ],
        );
    }

    private async markFiscalSuccess(
        documentType: QueueDocumentType,
        documentId: number,
        saleId: number | null,
        result: EBMSubmitResult,
    ): Promise<void> {
        if (documentType === 'sale' && saleId) {
            await AppDataSource.query(
                `UPDATE sales
                 SET fiscal_status = 'sent',
                     ebm_submitted_at = NOW(),
                     ebm_reference = $1,
                     ebm_receipt_number = $1,
                     vsdc_internal_data = $2,
                     vsdc_receipt_signature = $3,
                     vsdc_receipt_published_at = $4,
                     vsdc_sdc_id = $5,
                     receipt_global_counter = $6
                 WHERE id = $7`,
                [
                    result.reference || null,
                    result.internalData || null,
                    result.receiptSignature || null,
                    result.publishedAt || null,
                    result.sdcId || null,
                    result.totalReceiptNumber || null,
                    saleId,
                ],
            );
            return;
        }

        const table = documentType === 'credit_note' ? 'credit_notes' : 'debit_notes';
        await AppDataSource.query(
            `UPDATE ${table}
             SET fiscal_status = 'sent',
                 ebm_reference = $1
             WHERE id = $2`,
            [result.reference || null, documentId],
        );
    }

    private async markFiscalFailure(
        documentType: QueueDocumentType,
        documentId: number,
        saleId: number | null,
    ): Promise<void> {
        if (documentType === 'sale' && saleId) {
            await AppDataSource.query(
                `UPDATE sales
                 SET fiscal_status = CASE WHEN fiscal_status = 'sent' THEN fiscal_status ELSE 'failed' END
                 WHERE id = $1`,
                [saleId],
            );
            return;
        }
        const table = documentType === 'credit_note' ? 'credit_notes' : 'debit_notes';
        await AppDataSource.query(`UPDATE ${table} SET fiscal_status = 'failed' WHERE id = $1`, [documentId]);
    }
}
