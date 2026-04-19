import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer } from '../ui/Drawer';
import { pharmacyService } from '../../services/pharmacy.service';
import type { QualityCaseType } from '../../types/pharmacy';

const CASE_TYPES: { value: QualityCaseType; label: string }[] = [
    { value: 'complaint', label: 'Complaint' },
    { value: 'capa', label: 'CAPA' },
    { value: 'adr', label: 'ADR (pharmacovigilance)' },
];

interface QualityCaseCreateDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    facilityId: number | null;
}

export function QualityCaseCreateDrawer({
    isOpen,
    onClose,
    onSuccess,
    facilityId,
}: QualityCaseCreateDrawerProps) {
    const [type, setType] = useState<QualityCaseType>('complaint');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [medicineId, setMedicineId] = useState('');
    const [batchId, setBatchId] = useState('');
    const [capaActions, setCapaActions] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setType('complaint');
        setTitle('');
        setDescription('');
        setMedicineId('');
        setBatchId('');
        setCapaActions('');
        setSubmitting(false);
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!facilityId) {
            toast.error('Select a facility in the header before creating a case.');
            return;
        }
        const t = title.trim();
        const d = description.trim();
        if (t.length < 3 || d.length < 3) {
            toast.error('Title and description must be at least 3 characters.');
            return;
        }
        const med = medicineId.trim();
        const bat = batchId.trim();
        const capa = capaActions.trim();

        setSubmitting(true);
        try {
            await pharmacyService.createQualityCase({
                facility_id: facilityId,
                type,
                title: t,
                description: d,
                ...(med !== '' && !Number.isNaN(Number(med)) ? { medicine_id: parseInt(med, 10) } : {}),
                ...(bat !== '' && !Number.isNaN(Number(bat)) ? { batch_id: parseInt(bat, 10) } : {}),
                ...(capa !== '' ? { capa_actions: capa } : {}),
            });
            toast.success('Quality case created.');
            onSuccess();
            onClose();
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Failed to create quality case.';
            toast.error(typeof msg === 'string' ? msg : 'Failed to create quality case.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title="New quality case"
            subtitle="Complaint · CAPA · ADR"
            showOverlay
            footer={
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="quality-case-create-form"
                        disabled={submitting || !facilityId}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-healthcare-primary text-white hover:bg-teal-700 shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                Create case
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <div className="bg-white dark:bg-slate-900 w-full overflow-hidden">
                <form id="quality-case-create-form" onSubmit={handleSubmit} className="p-6 space-y-4">
                    {!facilityId && (
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                            Choose a facility in the header—receipts are recorded per facility.
                        </p>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            Type
                        </label>
                        <select
                            value={type}
                            onChange={(ev) => setType(ev.target.value as QualityCaseType)}
                            className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-teal-500"
                        >
                            {CASE_TYPES.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(ev) => setTitle(ev.target.value)}
                            minLength={3}
                            required
                            placeholder="Short summary"
                            className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-teal-500"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(ev) => setDescription(ev.target.value)}
                            minLength={3}
                            required
                            rows={5}
                            placeholder="What happened, initial assessment, references…"
                            className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-teal-500 resize-y min-h-[120px]"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                Medicine ID (optional)
                            </label>
                            <input
                                type="number"
                                value={medicineId}
                                onChange={(ev) => setMedicineId(ev.target.value)}
                                min={1}
                                placeholder="e.g. 12"
                                className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-teal-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                Batch ID (optional)
                            </label>
                            <input
                                type="number"
                                value={batchId}
                                onChange={(ev) => setBatchId(ev.target.value)}
                                min={1}
                                placeholder="e.g. 34"
                                className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            CAPA actions (optional)
                        </label>
                        <textarea
                            value={capaActions}
                            onChange={(ev) => setCapaActions(ev.target.value)}
                            rows={3}
                            placeholder="Corrective / preventive steps"
                            className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-teal-500 resize-y"
                        />
                    </div>
                </form>
            </div>
        </Drawer>
    );
}
