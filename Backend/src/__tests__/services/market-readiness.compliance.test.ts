import { computeRecallRegulatoryDueAt } from '../../utils/regulatory-recall.util';
import { RecallClass } from '../../entities/BatchRecall.entity';

describe('market readiness compliance utils', () => {
    it('computes regulatory due date from recall class', () => {
        const t = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
        const d1 = computeRecallRegulatoryDueAt(t, RecallClass.CLASS_I)!;
        const d2 = computeRecallRegulatoryDueAt(t, RecallClass.CLASS_II)!;
        const d3 = computeRecallRegulatoryDueAt(t, RecallClass.CLASS_III)!;
        expect(d1.getUTCDate()).toBe(4);
        expect(d2.getUTCDate()).toBe(11);
        expect(d3.getUTCDate()).toBe(31);
        expect(computeRecallRegulatoryDueAt(t, null)).toBeNull();
    });
});
