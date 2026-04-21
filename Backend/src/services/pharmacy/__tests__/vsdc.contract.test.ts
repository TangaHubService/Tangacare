import {
    evaluateVsdcResponse,
    mapToVsdcSaleRequest,
    TransactionTypeCode,
    VsdcSaleRequestInput,
} from '../vsdc.contract';

describe('vsdc.contract', () => {
    it('maps internal sale payload to VSDC request contract', () => {
        const input: VsdcSaleRequestInput = {
            tin: '999991130',
            bhfId: '00',
            invcNo: 10,
            orgInvcNo: 0,
            custTin: '100110263',
            rcptTyCd: TransactionTypeCode.SALE,
            pmtTyCd: '01',
            cfmDt: '20260420113045',
            salesDt: '20260420',
            rptNo: 1,
            taxblAmtA: 0,
            taxblAmtB: 1000,
            taxblAmtC: 0,
            taxblAmtD: 0,
            taxRtA: 0,
            taxRtB: 18,
            taxRtC: 0,
            taxRtD: 0,
            taxAmtA: 0,
            taxAmtB: 152.54,
            taxAmtC: 0,
            taxAmtD: 0,
            totTaxblAmt: 1000,
            totTaxAmt: 152.54,
            totAmt: 1000,
            itemList: [
                {
                    itemSeq: 1,
                    itemCd: 'MED-1',
                    itemNm: 'Paracetamol',
                    qty: 2,
                    prc: 500,
                    splyAmt: 1000,
                    dcRt: 0,
                    dcAmt: 0,
                    taxTyCd: 'B',
                    taxblAmt: 1000,
                    taxAmt: 152.54,
                    totAmt: 1000,
                },
            ],
        };

        const mapped = mapToVsdcSaleRequest(input);
        expect(mapped.tin).toBe('999991130');
        expect(mapped.rcptTyCd).toBe('S');
        expect(mapped.itemList).toHaveLength(1);
        expect(mapped.totItemCnt).toBe(1);
        expect(mapped.taxAmtB).toBe(152.54);
    });

    it('parses successful VSDC response with receipt metadata', () => {
        const result = evaluateVsdcResponse({
            resultCd: '000',
            resultMsg: 'It is succeeded',
            data: {
                rcptNo: 27,
                intrlData: 'GZGGIZLYTJSSD7YLYLGIIG6FCY',
                rcptSign: 'TQZMKL57AGBMSTPO',
                totRcptNo: 32,
                vsdcRcptPbctDate: '20211027162114',
                sdcId: 'SDC010000005',
                mrcNo: 'WIS01006230',
            },
        });

        expect(result.ok).toBe(true);
        expect(result.receipt?.receiptNumber).toBe('27');
        expect(result.receipt?.totalReceiptNumber).toBe(32);
        expect(result.receipt?.sdcId).toBe('SDC010000005');
    });

    it('marks transport/server errors as retryable', () => {
        const result = evaluateVsdcResponse({
            resultCd: '894',
            resultMsg: 'server communication error',
        });

        expect(result.ok).toBe(false);
        expect(result.retryable).toBe(true);
        expect(result.code).toBe('894');
    });
});
