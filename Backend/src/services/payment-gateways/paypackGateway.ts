import crypto from 'crypto';
import type { CashInParams, CashInResult, PaymentGateway } from './paymentGateway';

export class PaypackGateway implements PaymentGateway {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private accessTokenExpiresAtMs: number | null = null;
    private clientId: string;
    private clientSecret: string;
    private webhookMode: string;
    private readonly apiBaseUrl: string;
    private readonly primaryInitiatePath: string;

    constructor() {
        const clientId = process.env.PAYPACK_CLIENT_ID;
        const clientSecret = process.env.PAYPACK_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Missing PAYPACK_CLIENT_ID or PAYPACK_CLIENT_SECRET');
        }

        this.clientId = clientId;
        this.clientSecret = clientSecret;
        const envModeDefault = process.env.NODE_ENV === 'production' ? 'production' : 'development';
        this.webhookMode = (process.env.PAYPACK_WEBHOOK_MODE || envModeDefault).toString();
        this.apiBaseUrl = (process.env.PAYPACK_API_BASE_URL || 'https://payments.paypack.rw/api')
            .toString()
            .replace(/\/+$/, '');
        this.primaryInitiatePath = (process.env.PAYPACK_INITIATE_PATH || '/checkouts/initiate').toString();
    }

    private generateIdempotencyKey(): string {
        // Paypack requires <= 32 chars
        return crypto.randomBytes(16).toString('hex').slice(0, 32);
    }

    private parseExpiresToMs(expiresRaw: unknown): number | null {
        if (expiresRaw == null) return null;
        const num = Number(expiresRaw);
        if (!Number.isFinite(num) || num <= 0) return null;

        // Support both absolute unix timestamps and "seconds from now".
        // Values above 1e12 are treated as ms timestamps, above 1e9 as seconds timestamps.
        if (num > 1e12) return num;
        if (num > 1e9) return num * 1000;
        return Date.now() + num * 1000;
    }

    private async authorize(): Promise<void> {
        const res = await fetch(`${this.apiBaseUrl}/auth/agents/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
            }),
        });

        const text = await res.text();
        let body: any = null;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = null;
        }

        if (!res.ok) {
            const message =
                body?.message || body?.error || `Paypack authorize failed (${res.status})`;
            throw new Error(message);
        }

        this.accessToken = body?.access ?? null;
        this.refreshToken = body?.refresh ?? null;
        this.accessTokenExpiresAtMs = this.parseExpiresToMs(body?.expires);

        if (!this.accessToken) {
            throw new Error('Paypack authorize response missing access token');
        }
    }

    private async refreshAccessToken(): Promise<boolean> {
        if (!this.refreshToken) return false;

        const res = await fetch(`${this.apiBaseUrl}/auth/agents/refresh/${this.refreshToken}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        const text = await res.text();
        let body: any = null;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = null;
        }

        if (!res.ok) return false;

        this.accessToken = body?.access ?? null;
        this.refreshToken = body?.refresh ?? this.refreshToken;
        this.accessTokenExpiresAtMs = this.parseExpiresToMs(body?.expires);

        return !!this.accessToken;
    }

    private isAccessTokenValid(): boolean {
        if (!this.accessToken) return false;
        if (!this.accessTokenExpiresAtMs) return true;

        // 30s safety buffer before expiry
        return Date.now() + 30000 < this.accessTokenExpiresAtMs;
    }

    private async getAccessToken(): Promise<string> {
        if (this.isAccessTokenValid()) {
            return this.accessToken as string;
        }

        const refreshed = await this.refreshAccessToken();
        if (refreshed && this.accessToken) {
            return this.accessToken;
        }

        await this.authorize();
        return this.accessToken as string;
    }

    async createCashIn(params: CashInParams): Promise<CashInResult> {
        const { amount_rwf, phone_number, idempotency_key } = params;

        if (!phone_number) throw new Error('phone_number is required');
        if (!Number.isFinite(amount_rwf) || amount_rwf <= 0) throw new Error('amount_rwf must be > 0');

        const idempotencyKey = (idempotency_key || this.generateIdempotencyKey()).toString();

        if (idempotencyKey.length > 32) {
            throw new Error('Paypack Idempotency-Key must be maxLength 32');
        }

        const accessToken = await this.getAccessToken();
        const toPaypackLocalPhone = (raw: string): string => {
            const cleaned = raw.replace(/\s+/g, '').replace(/-/g, '');
            if (cleaned.startsWith('+2507') && cleaned.length === 13) return `0${cleaned.slice(4)}`;
            if (cleaned.startsWith('2507') && cleaned.length === 12) return `0${cleaned.slice(3)}`;
            return cleaned;
        };
        const paypackPhoneNumber = toPaypackLocalPhone(phone_number);
        const pathCandidates = Array.from(
            new Set([
                this.primaryInitiatePath,
                '/transactions/cashin', // legacy/commonly available fallback
            ]),
        );
        let body: any = null;
        let lastErrorMessage = '';

        for (const path of pathCandidates) {
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
            const res = await fetch(`${this.apiBaseUrl}${normalizedPath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                    'X-Webhook-Mode': this.webhookMode,
                    'Idempotency-Key': idempotencyKey,
                },
                body: JSON.stringify({
                    amount: amount_rwf,
                    number: paypackPhoneNumber,
                }),
            });

            const text = await res.text();
            try {
                body = text ? JSON.parse(text) : null;
            } catch {
                body = null;
            }

            if (res.ok) {
                break;
            }

            lastErrorMessage =
                body?.message || body?.error || `Paypack cashin failed on ${normalizedPath} (${res.status})`;
            body = null;
        }

        if (!body) {
            throw new Error(lastErrorMessage || 'Paypack cashin failed');
        }

        const normalizedRef = body?.ref ?? body?.id ?? body?.checkout_id ?? body?.data?.ref ?? body?.data?.id;
        if (!normalizedRef) {
            throw new Error('Paypack response missing transaction reference');
        }

        return {
            ref: String(normalizedRef),
            status: body?.status ?? body?.state ?? body?.payment_status ?? 'pending',
            amount: body?.amount ?? body?.total ?? body?.data?.amount,
            kind: body?.kind ?? body?.type ?? body?.data?.kind,
            provider: body?.provider ?? body?.network ?? body?.data?.provider ?? null,
            message:
                body?.message ??
                body?.instruction ??
                body?.instructions ??
                body?.ussd ??
                body?.data?.message ??
                undefined,
        };
    }
}

