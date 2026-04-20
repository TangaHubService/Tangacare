import { useEffect, useState } from 'react';
import { Building2, Layers, Package, Tag, Hash, Barcode, Coins, AlertCircle } from 'lucide-react';
import type { Batch, Medicine } from '../../types/pharmacy';
import { pharmacyService } from '../../services/pharmacy.service';
import { Drawer } from '../ui/Drawer';
import { formatLocalDate, parseLocalDate } from '../../lib/date';
import {
    formatPharmacistStock,
    getExpiryRiskLevel,
    expiryRiskPresentation,
    strengthFormLabel,
} from '../../lib/medicine-display';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';

interface MedicineInventoryDetailDrawerProps {
    medicine: Medicine | null;
    isOpen: boolean;
    onClose: () => void;
    facilityId: number | null | undefined;
}

export function MedicineInventoryDetailDrawer({
    medicine,
    isOpen,
    onClose,
    facilityId,
    onOpenFullRecord,
}: MedicineInventoryDetailDrawerProps) {
    const { formatMoney } = useRuntimeConfig();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !medicine?.id) {
            setBatches([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        pharmacyService
            .getBatches({
                medicine_id: medicine.id,
                facility_id: facilityId || undefined,
            })
            .then((rows) => {
                if (!cancelled) setBatches(Array.isArray(rows) ? rows : []);
            })
            .catch(() => {
                if (!cancelled) setBatches([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, medicine?.id, facilityId]);

    if (!medicine) return null;

    const category =
        String((medicine as any).category?.name || (medicine as any).category_name || '').trim() ||
        'Uncategorized';
    const supplier = String(
        (medicine as any).supplier_name || (medicine as any).supplier?.name || '',
    ).trim();
    const reorderPoint = Number(medicine.reorder_point ?? medicine.min_stock_level ?? 0);
    const minLevel = Number(medicine.min_stock_level || 0);
    const stockLine = formatPharmacistStock(medicine);
    const formStrength = strengthFormLabel(medicine);
    const expiryDate = medicine.expiry_date ? parseLocalDate(medicine.expiry_date) : null;
    const { level, daysUntil } = getExpiryRiskLevel(expiryDate);
    const expiryPres = expiryRiskPresentation(level, daysUntil);

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={medicine.name}
            subtitle={medicine.brand_name ? String(medicine.brand_name) : undefined}
            showOverlay
        >
            <div className="space-y-5 p-1">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Quick shelf read
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 text-xs font-medium">Stock</span>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{stockLine}</p>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs font-medium">Form / strength</span>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{formStrength}</p>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs font-medium">Sell price</span>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {formatMoney(medicine.selling_price)}
                                {medicine.unit ? (
                                    <span className="text-xs font-normal text-slate-500">
                                        {' '}
                                        / {medicine.unit}
                                    </span>
                                ) : null}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <span className={`text-sm font-medium ${expiryPres.textClass}`}>
                            {expiryPres.label}
                            {expiryPres.sub ? ` · ${expiryPres.sub}` : ''}
                        </span>
                        {medicine.expiry_date && (
                            <span className="text-xs text-slate-500 font-medium ml-auto">
                                FEFO nearest: {formatLocalDate(medicine.expiry_date)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <Tag className="text-slate-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-xs font-medium uppercase text-slate-500">Category</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{category}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <Building2 className="text-slate-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-xs font-medium uppercase text-slate-500">Supplier</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {supplier || '—'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <AlertCircle className="text-slate-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-xs font-medium uppercase text-slate-500">Min / reorder</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                Min {minLevel.toLocaleString()} · Reorder {reorderPoint.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <Coins className="text-slate-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-xs font-medium uppercase text-slate-500">Cost (purchase)</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {medicine.cost_price != null && Number(medicine.cost_price) > 0
                                    ? formatMoney(medicine.cost_price)
                                    : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-slate-500 flex items-center gap-2">
                        <Hash size={12} /> Identifiers
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                            Code {medicine.code}
                        </span>
                        {medicine.barcode ? (
                            <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                                <Barcode size={12} /> {medicine.barcode}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-slate-500 flex items-center gap-2">
                        <Layers size={12} /> Batches (this branch)
                    </p>
                    {loading ? (
                        <p className="text-sm text-slate-500 font-medium">Loading batches…</p>
                    ) : batches.length === 0 ? (
                        <p className="text-sm text-slate-500 font-medium">No batch rows loaded.</p>
                    ) : (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-56 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0">
                                    <tr className="text-[10px] uppercase text-slate-500 font-medium">
                                        <th className="px-3 py-2">Batch</th>
                                        <th className="px-3 py-2 text-right">Qty</th>
                                        <th className="px-3 py-2">Expiry</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {batches.slice(0, 40).map((b) => (
                                        <tr key={b.id}>
                                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                                                {b.batch_number}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                                                {Number(b.current_quantity || 0).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                                {b.expiry_date
                                                    ? formatLocalDate(parseLocalDate(b.expiry_date))
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                    <Package size={16} className="shrink-0 text-slate-400 mt-0.5" />
                    <p>
                        Procurement fields and movement history live in reports and batch screens. Use{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">Edit</span> from
                        the list to change pricing and reorder settings.
                    </p>
                </div>
            </div>
        </Drawer>
    );
}
