import { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { ProcurementOrder } from '../../types/pharmacy';
import toast from 'react-hot-toast';
import { parseLocalDate } from '../../lib/date';
import { Drawer } from '../ui/Drawer';

interface ReceiveOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    order: ProcurementOrder | null;
}

const RECEIVE_WIZARD_STEPS = ['Quantities & backorders', 'Batch, dates & locations', 'Review & confirm'] as const;

export function ReceiveOrderModal({ isOpen, onClose, onSuccess, order }: ReceiveOrderModalProps) {
    const [wizardStep, setWizardStep] = useState(0);
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const detailSectionRef = useRef<HTMLDivElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [receivedItems, setReceivedItems] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [globalLocationId, setGlobalLocationId] = useState<number | null>(null);

    const fetchLocations = async () => {
        if (!order?.facility_id) return;
        try {
            const data = await pharmacyService.getStorageLocations({
                facility_id: order.facility_id,
            });
            setLocations(data.filter((l: any) => l.is_active));
        } catch (error) {
            console.error('Failed to fetch locations:', error);
        }
    };

    useEffect(() => {
        if (isOpen && order) {
            setWizardStep(0);
            fetchLocations();
            setReceivedItems(
                order.items?.map((item) => ({
                    id: item.id,
                    medicine_name: item.medicine?.name,
                    quantity_ordered: item.quantity_ordered,
                    quantity_previously_received: item.quantity_received || 0,
                    quantity_outstanding: Math.max(
                        0,
                        Number(item.quantity_ordered || 0) - Number(item.quantity_received || 0),
                    ),
                    quantity_received: Math.max(
                        0,
                        Number(item.quantity_ordered || 0) - Number(item.quantity_received || 0),
                    ),
                    backorder_qty: 0,
                    batch_number: '',
                    expiry_date: '',
                    manufacturing_date: '',
                    location_id: globalLocationId,
                })) || [],
            );
        }
    }, [isOpen, order]);

    useEffect(() => {
        if (!isOpen) return;
        if (wizardStep === 0) {
            scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (wizardStep === 1) {
            detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [wizardStep, isOpen]);

    const applyGlobalLocation = (locationId: number | null) => {
        setGlobalLocationId(locationId);
        setReceivedItems((prev) => prev.map((item) => ({ ...item, location_id: locationId })));
    };

    const receivingSummary = useMemo(() => {
        const receivingRows = receivedItems.filter(
            (item) => Number(item.quantity_received || 0) > 0,
        );
        const actionRows = receivedItems.filter(
            (item) =>
                Number(item.quantity_received || 0) > 0 || Number(item.backorder_qty || 0) > 0,
        );
        const totalUnits = receivingRows.reduce(
            (sum, item) => sum + Number(item.quantity_received || 0),
            0,
        );
        const backorderUnits = receivedItems.reduce(
            (sum, item) => sum + Number(item.backorder_qty || 0),
            0,
        );
        const missingDetails = receivingRows.filter(
            (item) => !item.batch_number || !item.expiry_date || !item.location_id,
        ).length;
        return {
            actionLines: actionRows.length,
            totalUnits,
            backorderUnits,
            missingDetails,
        };
    }, [receivedItems]);

    const handleItemChange = (index: number, field: string, value: any) => {
        const updated = [...receivedItems];
        updated[index] = { ...updated[index], [field]: value };
        setReceivedItems(updated);
    };

    const handleClearAll = () => {
        setReceivedItems((prev) =>
            prev.map((item) => ({ ...item, quantity_received: 0, backorder_qty: 0 })),
        );
    };

    const handleSubmit = async () => {
        if (!order) return;
        const todayStr = new Date().toISOString().split('T')[0];

        const attemptedItems = receivedItems.filter(
            (i) => Number(i.quantity_received || 0) > 0 || Number(i.backorder_qty || 0) > 0,
        );

        if (attemptedItems.length === 0) {
            toast.error('Please enter a quantity to receive for at least one item.');
            return;
        }

        const duplicateEntryKeys = new Set<string>();
        const duplicateEntries: string[] = [];
        for (const item of attemptedItems.filter(
            (entry) => Number(entry.quantity_received || 0) > 0,
        )) {
            const key = `${String(item.id)}::${String(item.batch_number || '')
                .trim()
                .toLowerCase()}`;
            if (duplicateEntryKeys.has(key)) {
                duplicateEntries.push(`${item.medicine_name} (${item.batch_number || 'NO-BATCH'})`);
            } else {
                duplicateEntryKeys.add(key);
            }
        }
        if (duplicateEntries.length > 0) {
            toast.error(`Duplicate entry detected: ${duplicateEntries.slice(0, 2).join(', ')}`);
            return;
        }

        const validItems: any[] = [];
        const skippedItems: any[] = [];

        for (const item of attemptedItems) {
            const quantityReceived = Number(item.quantity_received || 0);
            const backorderQty = Number(item.backorder_qty || 0);
            const outstandingQty = Math.max(
                0,
                Number(item.quantity_ordered || 0) - Number(item.quantity_previously_received || 0),
            );

            if (quantityReceived < 0 || backorderQty < 0) {
                skippedItems.push({ ...item, reason: 'Negative quantities are not allowed' });
                continue;
            }

            if (quantityReceived + backorderQty > outstandingQty) {
                skippedItems.push({
                    ...item,
                    reason: `Received + backorder cannot exceed outstanding quantity (${outstandingQty})`,
                });
                continue;
            }

            if (quantityReceived > 0) {
                if (!item.location_id) {
                    skippedItems.push({ ...item, reason: 'Storage Location is required' });
                    continue;
                }
                if (!String(item.batch_number || '').trim()) {
                    skippedItems.push({ ...item, reason: 'Batch Number is required' });
                    continue;
                }
                if (!item.expiry_date) {
                    skippedItems.push({ ...item, reason: 'Expiry Date is required' });
                    continue;
                }
                if (item.expiry_date <= todayStr) {
                    skippedItems.push({ ...item, reason: 'Expiry date must be in the future' });
                    continue;
                }
                if (item.manufacturing_date && item.expiry_date <= item.manufacturing_date) {
                    skippedItems.push({ ...item, reason: 'Expiry date must be after Mfg Date' });
                    continue;
                }
            }

            validItems.push(item);
        }

        if (validItems.length === 0) {
            const firstError = skippedItems[0]?.reason || 'Invalid details';
            toast.error(`No valid items to receive. ${firstError}`);
            return;
        }

        if (skippedItems.length > 0) {
            const reasons = [...new Set(skippedItems.map((i) => i.reason))].join(', ');
            toast(`Skipping ${skippedItems.length} invalid item(s). ${reasons}`, {
                icon: '⚠️',
                duration: 5000,
            });
        }

        const nearExpiryCount = validItems.filter((item) => {
            if (Number(item.quantity_received || 0) <= 0) return false;
            const expiry = parseLocalDate(item.expiry_date);
            const now = new Date();
            const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 30;
        }).length;
        if (nearExpiryCount > 0) {
            toast(`Warning: ${nearExpiryCount} item(s) expire in 30 days or less.`, {
                icon: '⚠️',
                duration: 5000,
            });
        }

        setLoading(true);
        try {
            const response = await pharmacyService.receiveProcurementOrder(order.id, {
                received_items: validItems.map((i) => ({
                    item_id: i.id,
                    quantity_received: Number(i.quantity_received),
                    backorder_qty: Number(i.backorder_qty || 0),
                    batch_number: i.batch_number,
                    expiry_date: i.expiry_date,
                    manufacturing_date: i.manufacturing_date || undefined,
                    location_id: i.location_id,
                    selling_price: i.selling_price != null ? Number(i.selling_price) : undefined,
                })),
                received_date: new Date().toISOString().split('T')[0],
            });

            const skippedBackend = response.skippedItems || [];

            if (skippedBackend.length > 0) {
                toast(
                    'Received most items, but skipped ' + skippedBackend.length + ' duplicates.',
                    {
                        icon: 'ℹ️',
                        duration: 5000,
                    },
                );

                const skippedDetails = skippedBackend
                    .map((s: any) => `${s.medicine_name} (${s.batch_number})`)
                    .join(', ');
                toast.error(`Existing Batches Skipped: ${skippedDetails}`, { duration: 6000 });
            } else {
                toast.success(`Successfully received ${validItems.length} item(s)`);
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to receive order:', error);
            toast.error(error?.response?.data?.message || 'Failed to update inventory');
        } finally {
            setLoading(false);
        }
    };

    if (!order) return null;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            title="Receive Inventory"
            subtitle={`Record goods receipt for PO-${order.id}`}
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 w-full max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-b border-amber-100 dark:border-amber-800/30 text-xs px-4 sm:px-6 space-y-2">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6">
                        <span className="font-bold flex items-center gap-2">
                            <CheckCircle2 size={14} />
                            Enter received and/or backorder quantities per item.
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="font-black uppercase text-[10px] text-slate-500">
                                Apply to all:
                            </span>
                            <select
                                value={globalLocationId || ''}
                                onChange={(e) =>
                                    applyGlobalLocation(
                                        e.target.value ? parseInt(e.target.value) : null,
                                    )
                                }
                                className="h-10 px-3 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg text-[10px] font-black outline-none focus:border-amber-500"
                            >
                                <option value="">Select Global Location...</option>
                                {locations.map((loc) => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Preview: {receivingSummary.actionLines} lines •{' '}
                            {receivingSummary.totalUnits} units received •{' '}
                            {receivingSummary.backorderUnits} units backordered
                            {receivingSummary.missingDetails > 0 &&
                                ` • ${receivingSummary.missingDetails} missing details`}
                        </div>
                        <button
                            onClick={handleClearAll}
                            className="h-10 w-full sm:w-auto text-[10px] font-black uppercase bg-white dark:bg-slate-800 px-3 rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors touch-manipulation"
                        >
                            Clear All Quantities
                        </button>
                    </div>
                </div>

                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Receive wizard
                        </p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Step {wizardStep + 1} of {RECEIVE_WIZARD_STEPS.length}:{' '}
                            {RECEIVE_WIZARD_STEPS[wizardStep]}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={wizardStep === 0}
                            onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                            className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-600 disabled:opacity-40"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={wizardStep >= RECEIVE_WIZARD_STEPS.length - 1}
                            onClick={() =>
                                setWizardStep((s) =>
                                    Math.min(RECEIVE_WIZARD_STEPS.length - 1, s + 1),
                                )
                            }
                            className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>

                <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
                    <div className="space-y-3 lg:hidden">
                        {receivedItems.map((item, idx) => {
                            const isReceiving = item.quantity_received > 0;
                            const outstandingQty = Math.max(
                                0,
                                Number(item.quantity_ordered || 0) -
                                    Number(item.quantity_previously_received || 0),
                            );
                            const isMissingInfo =
                                isReceiving &&
                                (!item.batch_number || !item.expiry_date || !item.location_id);

                            return (
                                <div
                                    key={idx}
                                    className={`rounded-xl border p-3 bg-white dark:bg-slate-900 space-y-3 ${isMissingInfo ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-800'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-healthcare-dark dark:text-white">
                                                {item.medicine_name}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-black">
                                                Ordered: {item.quantity_ordered} • Previously
                                                Received: {item.quantity_previously_received || 0} •
                                                Outstanding: {outstandingQty}
                                            </p>
                                            {isMissingInfo && (
                                                <span className="text-[10px] text-red-500 font-bold">
                                                    Missing details
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-[84px]">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">
                                                Receiving
                                            </label>
                                            <input
                                                type="number"
                                                value={item.quantity_received}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'quantity_received',
                                                        Number(e.target.value),
                                                    )
                                                }
                                                className="h-10 w-full px-2 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg text-center font-black text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                        <div className="min-w-[84px]">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">
                                                Sell Price
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.selling_price || ''}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'selling_price',
                                                        e.target.value !== ''
                                                            ? Number(e.target.value)
                                                            : '',
                                                    )
                                                }
                                                className="h-10 w-full px-2 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg text-center font-black text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                                placeholder="optional"
                                            />
                                        </div>
                                        <div className="min-w-[84px]">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">
                                                Backorder
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.backorder_qty || 0}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'backorder_qty',
                                                        Number(e.target.value),
                                                    )
                                                }
                                                className="h-10 w-full px-2 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg text-center font-black text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">
                                                Batch Number
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="Batch Number"
                                                value={item.batch_number}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'batch_number',
                                                        e.target.value,
                                                    )
                                                }
                                                className={`h-10 w-full px-3 bg-white dark:bg-slate-800 border-2 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 ${isMissingInfo && !item.batch_number ? 'border-red-300 dark:border-red-800' : 'border-slate-600 dark:border-slate-600'}`}
                                                required={item.quantity_received > 0}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">
                                                Storage Location
                                            </span>
                                            <select
                                                value={item.location_id || ''}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'location_id',
                                                        e.target.value
                                                            ? parseInt(e.target.value)
                                                            : null,
                                                    )
                                                }
                                                className={`h-10 w-full px-3 bg-white dark:bg-slate-800 border-2 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 ${isMissingInfo && !item.location_id ? 'border-red-300 dark:border-red-800' : 'border-slate-600 dark:border-slate-600'}`}
                                                required={item.quantity_received > 0}
                                            >
                                                <option value="">Select Location...</option>
                                                {locations.map((loc) => (
                                                    <option key={loc.id} value={loc.id}>
                                                        {loc.name} ({loc.code})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">
                                                Expiry Date
                                            </span>
                                            <input
                                                type="date"
                                                value={item.expiry_date}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'expiry_date',
                                                        e.target.value,
                                                    )
                                                }
                                                className={`h-10 w-full px-2 bg-white dark:bg-slate-800 border-2 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 ${isMissingInfo && !item.expiry_date ? 'border-red-300 dark:border-red-800' : 'border-slate-600 dark:border-slate-600'}`}
                                                required={item.quantity_received > 0}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">
                                                Mfg Date (Optional)
                                            </span>
                                            <input
                                                type="date"
                                                value={item.manufacturing_date}
                                                onChange={(e) =>
                                                    handleItemChange(
                                                        idx,
                                                        'manufacturing_date',
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-10 w-full px-2 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div ref={detailSectionRef} className="hidden lg:block overflow-x-auto">
                        <table className="tc-table w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-100 dark:border-slate-800">
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">
                                        Medicine
                                    </th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center px-2">
                                        Ordered
                                    </th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center px-2">
                                        Receiving
                                    </th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">
                                        Batch Details
                                    </th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">
                                        Dates
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {receivedItems.map((item, idx) => {
                                    const isReceiving = item.quantity_received > 0;
                                    const outstandingQty = Math.max(
                                        0,
                                        Number(item.quantity_ordered || 0) -
                                            Number(item.quantity_previously_received || 0),
                                    );
                                    const isMissingInfo =
                                        isReceiving &&
                                        (!item.batch_number ||
                                            !item.expiry_date ||
                                            !item.location_id);

                                    return (
                                        <tr
                                            key={idx}
                                            className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors align-top ${isMissingInfo ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                                        >
                                            <td className="py-4 px-2">
                                                <div className="font-bold text-healthcare-dark dark:text-white text-sm">
                                                    {item.medicine_name}
                                                </div>
                                                {isMissingInfo && (
                                                    <span className="text-[10px] text-red-500 font-bold animate-pulse">
                                                        Missing details
                                                    </span>
                                                )}
                                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1">
                                                    Previously Received:{' '}
                                                    {item.quantity_previously_received || 0} •
                                                    Outstanding: {outstandingQty}
                                                </div>
                                            </td>
                                            <td className="py-4 px-2 text-center text-sm font-black text-slate-400">
                                                {item.quantity_ordered}
                                            </td>
                                            <td className="py-4 px-2">
                                                <div className="space-y-2">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">
                                                            Receive
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.quantity_received}
                                                            onChange={(e) =>
                                                                handleItemChange(
                                                                    idx,
                                                                    'quantity_received',
                                                                    Number(e.target.value),
                                                                )
                                                            }
                                                            className="w-24 px-2 py-1.5 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg text-center font-black text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">
                                                            Backorder
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.backorder_qty || 0}
                                                            onChange={(e) =>
                                                                handleItemChange(
                                                                    idx,
                                                                    'backorder_qty',
                                                                    Number(e.target.value),
                                                                )
                                                            }
                                                            className="w-24 px-2 py-1.5 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg text-center font-black text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-2 space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Batch Number"
                                                    value={item.batch_number}
                                                    onChange={(e) =>
                                                        handleItemChange(
                                                            idx,
                                                            'batch_number',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={`w-full px-3 py-1.5 bg-white dark:bg-slate-800 border-2 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 mb-2 ${isMissingInfo && !item.batch_number ? 'border-red-300 dark:border-red-800' : 'border-slate-600 dark:border-slate-600'}`}
                                                    required={item.quantity_received > 0}
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">
                                                        Storage Location
                                                    </span>
                                                    <select
                                                        value={item.location_id || ''}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'location_id',
                                                                e.target.value
                                                                    ? parseInt(e.target.value)
                                                                    : null,
                                                            )
                                                        }
                                                        className={`w-full px-3 py-1.5 bg-white dark:bg-slate-800 border-2 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 ${isMissingInfo && !item.location_id ? 'border-red-300 dark:border-red-800' : 'border-slate-600 dark:border-slate-600'}`}
                                                        required={item.quantity_received > 0}
                                                    >
                                                        <option value="">Select Location...</option>
                                                        {locations.map((loc) => (
                                                            <option key={loc.id} value={loc.id}>
                                                                {loc.name} ({loc.code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="py-4 px-2 space-y-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">
                                                        Expiry Date
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={item.expiry_date}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'expiry_date',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={`px-2 py-1 bg-white dark:bg-slate-800 border-2 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 ${isMissingInfo ? 'border-red-300 dark:border-red-800' : 'border-slate-600 dark:border-slate-600'}`}
                                                        required={item.quantity_received > 0}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">
                                                        Mfg Date (Optional)
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={item.manufacturing_date}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'manufacturing_date',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="px-2 py-1 bg-white dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-600 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div
                    ref={footerRef}
                    className="sticky bottom-0 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3"
                >
                    <button
                        onClick={onClose}
                        className="h-11 px-6 w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-50 transition-all uppercase tracking-widest touch-manipulation"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="h-11 px-8 w-full sm:w-auto bg-emerald-500 text-white rounded-xl font-black text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest touch-manipulation"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <CheckCircle2 size={16} />
                        )}
                        Confirm Goods Receipt
                    </button>
                </div>
            </div>
        </Drawer>
    );
}
