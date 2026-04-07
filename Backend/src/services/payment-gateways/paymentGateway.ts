export type CashInParams = {
    amount_rwf: number;
    phone_number: string;
    idempotency_key?: string;
};

export type CashInResult = {
    ref: string;
    status: string;
    amount?: number;
    kind?: string;
    // Some Paypack responses include an instruction/message for the end-user
    // (e.g. USSD instructions). This is optional and depends on payment mode.
    message?: string;
    provider?: string | null;
};

export interface PaymentGateway {
    createCashIn(params: CashInParams): Promise<CashInResult>;
}

