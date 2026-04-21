export type VsdcResultCode = string;

export enum ReceiptTypeCode {
    NORMAL = 'N',
    COPY = 'C',
    TRAINING = 'T',
    PROFORMA = 'P',
}

export enum TransactionTypeCode {
    SALE = 'S',
    REFUND = 'R',
}

export interface VsdcReceiptLineItem {
    itemSeq: number;
    itemCd: string;
    itemClsCd?: string;
    itemNm: string;
    qty: number;
    prc: number;
    splyAmt: number;
    dcRt: number;
    dcAmt: number;
    taxTyCd: string;
    taxblAmt: number;
    taxAmt: number;
    totAmt: number;
}

export interface VsdcSaleRequestInput {
    tin: string;
    bhfId: string;
    invcNo: number;
    orgInvcNo: number;
    custTin?: string;
    custNm?: string;
    prcOrdCd?: string;
    rcptTyCd: TransactionTypeCode;
    pmtTyCd?: string;
    cfmDt: string;
    salesDt: string;
    salesTyCd?: string;
    salesSttsCd?: string;
    rptNo: number;
    trdeNm?: string;
    adrs?: string;
    topMsg?: string;
    btmMsg?: string;
    taxblAmtA: number;
    taxblAmtB: number;
    taxblAmtC: number;
    taxblAmtD: number;
    taxRtA: number;
    taxRtB: number;
    taxRtC: number;
    taxRtD: number;
    taxAmtA: number;
    taxAmtB: number;
    taxAmtC: number;
    taxAmtD: number;
    totTaxblAmt: number;
    totTaxAmt: number;
    totAmt: number;
    itemList: VsdcReceiptLineItem[];
}

export interface VsdcSaleRequest {
    tin: string;
    bhfId: string;
    invcNo: number;
    orgInvcNo: number;
    custTin?: string;
    prcOrdCd?: string;
    custNm?: string;
    salesTyCd: string;
    rcptTyCd: string;
    pmtTyCd?: string;
    salesSttsCd: string;
    cfmDt: string;
    salesDt: string;
    stockRlsDt?: string;
    cnclReqDt?: string | null;
    cnclDt?: string | null;
    rfdDt?: string | null;
    rfdRsnCd?: string | null;
    totItemCnt: number;
    taxblAmtA: number;
    taxblAmtB: number;
    taxblAmtC: number;
    taxblAmtD: number;
    taxRtA: number;
    taxRtB: number;
    taxRtC: number;
    taxRtD: number;
    taxAmtA: number;
    taxAmtB: number;
    taxAmtC: number;
    taxAmtD: number;
    totTaxblAmt: number;
    totTaxAmt: number;
    totAmt: number;
    prchrAcptcYn: string;
    remark?: string | null;
    regrNm: string;
    regrId: string;
    modrNm: string;
    modrId: string;
    receipt: {
        custTin?: string;
        custMblNo?: string | null;
        rptNo: number;
        trdeNm?: string;
        adrs?: string;
        topMsg?: string;
        btmMsg?: string;
        prchrAcptcYn: string;
    };
    itemList: VsdcReceiptLineItem[];
}

export interface VsdcResponseData {
    rcptNo?: number;
    intrlData?: string;
    rcptSign?: string;
    totRcptNo?: number;
    vsdcRcptPbctDate?: string;
    sdcId?: string;
    mrcNo?: string;
}

export interface VsdcApiResponse {
    resultCd?: VsdcResultCode;
    resultMsg?: string;
    resultDt?: string;
    data?: VsdcResponseData;
}

export interface FiscalReceiptMeta {
    receiptNumber: string;
    totalReceiptNumber: number;
    internalData: string;
    receiptSignature: string;
    publishedAt: Date | null;
    sdcId: string;
    mrcNo?: string;
}

export interface VsdcContractResult {
    ok: boolean;
    code: VsdcResultCode;
    message: string;
    retryable: boolean;
    receipt?: FiscalReceiptMeta;
}

const SUCCESS_CODE = '000';
const RETRYABLE_CODES = new Set(['891', '892', '893', '894', '896', '899', '999', '990', '995']);

export const VSDC_CODE_HINTS: Record<string, string> = {
    '000': 'Success',
    '001': 'No search result',
    '881': 'Purchase code is mandatory for business customer',
    '882': 'Purchase code is invalid',
    '883': 'Purchase code already used',
    '884': 'Invalid customer TIN',
    '891': 'Request URL creation error',
    '892': 'Request header creation error',
    '893': 'Request body creation error',
    '894': 'Server communication error',
    '895': 'HTTP method not allowed',
    '896': 'Request status error',
    '899': 'Client error',
    '900': 'Header missing',
    '901': 'Invalid device',
    '902': 'Device already installed',
    '903': 'Only VSDC device can be verified',
    '910': 'Request parameter error',
    '911': 'Missing request body',
    '912': 'Request method error',
    '921': 'Sales/sales-invoice data cannot be received',
    '922': 'Sales invoice must follow sales data',
    '990': 'Maximum views exceeded',
    '991': 'Registration error',
    '992': 'Modification error',
    '993': 'Deletion error',
    '994': 'Duplicate data',
    '995': 'File not found',
    '999': 'Unknown server error',
};

function safeNum(value: number): number {
    return Number.isFinite(value) ? Number(Number(value).toFixed(2)) : 0;
}

function toOptionalString(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text ? text : undefined;
}

function parsePublishedDate(value: string | undefined): Date | null {
    if (!value || value.length !== 14) return null;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const hour = Number(value.slice(8, 10));
    const minute = Number(value.slice(10, 12));
    const second = Number(value.slice(12, 14));
    const parsed = new Date(Date.UTC(year, month, day, hour, minute, second));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildReceiptMeta(data?: VsdcResponseData): FiscalReceiptMeta | undefined {
    if (!data?.rcptNo || !data.intrlData || !data.rcptSign || !data.totRcptNo || !data.sdcId) {
        return undefined;
    }
    return {
        receiptNumber: String(data.rcptNo),
        totalReceiptNumber: Number(data.totRcptNo),
        internalData: data.intrlData,
        receiptSignature: data.rcptSign,
        publishedAt: parsePublishedDate(data.vsdcRcptPbctDate),
        sdcId: data.sdcId,
        mrcNo: data.mrcNo,
    };
}

export function mapToVsdcSaleRequest(input: VsdcSaleRequestInput): VsdcSaleRequest {
    return {
        tin: input.tin,
        bhfId: input.bhfId,
        invcNo: input.invcNo,
        orgInvcNo: input.orgInvcNo,
        custTin: toOptionalString(input.custTin),
        prcOrdCd: toOptionalString(input.prcOrdCd),
        custNm: toOptionalString(input.custNm),
        salesTyCd: input.salesTyCd ?? 'N',
        rcptTyCd: input.rcptTyCd,
        pmtTyCd: toOptionalString(input.pmtTyCd),
        salesSttsCd: input.salesSttsCd ?? '02',
        cfmDt: input.cfmDt,
        salesDt: input.salesDt,
        stockRlsDt: input.cfmDt,
        cnclReqDt: null,
        cnclDt: null,
        rfdDt: input.rcptTyCd === TransactionTypeCode.REFUND ? input.cfmDt : null,
        rfdRsnCd: null,
        totItemCnt: input.itemList.length,
        taxblAmtA: safeNum(input.taxblAmtA),
        taxblAmtB: safeNum(input.taxblAmtB),
        taxblAmtC: safeNum(input.taxblAmtC),
        taxblAmtD: safeNum(input.taxblAmtD),
        taxRtA: safeNum(input.taxRtA),
        taxRtB: safeNum(input.taxRtB),
        taxRtC: safeNum(input.taxRtC),
        taxRtD: safeNum(input.taxRtD),
        taxAmtA: safeNum(input.taxAmtA),
        taxAmtB: safeNum(input.taxAmtB),
        taxAmtC: safeNum(input.taxAmtC),
        taxAmtD: safeNum(input.taxAmtD),
        totTaxblAmt: safeNum(input.totTaxblAmt),
        totTaxAmt: safeNum(input.totTaxAmt),
        totAmt: safeNum(input.totAmt),
        prchrAcptcYn: 'N',
        remark: null,
        regrNm: input.trdeNm || 'Tangacare',
        regrId: input.tin,
        modrNm: input.trdeNm || 'Tangacare',
        modrId: input.tin,
        receipt: {
            custTin: toOptionalString(input.custTin),
            custMblNo: null,
            rptNo: input.rptNo,
            trdeNm: toOptionalString(input.trdeNm),
            adrs: toOptionalString(input.adrs),
            topMsg: toOptionalString(input.topMsg),
            btmMsg: toOptionalString(input.btmMsg),
            prchrAcptcYn: 'N',
        },
        itemList: input.itemList.map((line) => ({
            ...line,
            qty: safeNum(line.qty),
            prc: safeNum(line.prc),
            splyAmt: safeNum(line.splyAmt),
            dcRt: safeNum(line.dcRt),
            dcAmt: safeNum(line.dcAmt),
            taxblAmt: safeNum(line.taxblAmt),
            taxAmt: safeNum(line.taxAmt),
            totAmt: safeNum(line.totAmt),
        })),
    };
}

export function evaluateVsdcResponse(response: VsdcApiResponse): VsdcContractResult {
    const code = String(response.resultCd || '999');
    const hint = VSDC_CODE_HINTS[code];
    const message = response.resultMsg || hint || 'Unknown VSDC error';
    if (code === SUCCESS_CODE) {
        const receipt = buildReceiptMeta(response.data);
        if (!receipt) {
            return {
                ok: false,
                code: '999',
                message: 'VSDC success response missing receipt metadata',
                retryable: true,
            };
        }
        return {
            ok: true,
            code,
            message,
            retryable: false,
            receipt,
        };
    }

    const retryable = RETRYABLE_CODES.has(code) || code.startsWith('89');
    return {
        ok: false,
        code,
        message,
        retryable,
    };
}
