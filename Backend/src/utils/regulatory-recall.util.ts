import { RecallClass } from '../entities/BatchRecall.entity';

/** Calendar-day approximation for regulatory recall response (Rwanda: 3 / 10 / 30 working days). */
export function computeRecallRegulatoryDueAt(initiatedAt: Date, recallClass?: RecallClass | null): Date | null {
    if (!recallClass) return null;
    const d = new Date(initiatedAt.getTime());
    const days = recallClass === RecallClass.CLASS_I ? 3 : recallClass === RecallClass.CLASS_II ? 10 : 30;
    d.setDate(d.getDate() + days);
    return d;
}
