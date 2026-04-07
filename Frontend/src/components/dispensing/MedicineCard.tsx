import React from 'react';
import type { Medicine } from '../../types/pharmacy';
import { Calendar, AlertTriangle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useMedicineStock } from '../../hooks/useMedicineStock';
import { toSentenceCase } from '../../lib/text';
import { parseLocalDate, formatLocalDate } from '../../lib/date';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';

interface MedicineCardProps {
    medicine: Medicine;
    onAddToCart: (medicine: Medicine) => void;
    onFindAlternatives?: (medicine: Medicine) => void;
    isFindingAlternatives?: boolean;
    readOnly?: boolean;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({
    medicine,
    onAddToCart,
    onFindAlternatives,
    isFindingAlternatives = false,
    readOnly = false,
}) => {
    const { formatMoney } = useRuntimeConfig();
    const { nearestExpiry, isLoading } = useMedicineStock(medicine.id);
    const sellingPrice = Number(medicine.selling_price || 0);
    const displayStrength = String(medicine.strength || '').toLowerCase();
    const displayDosageForm = toSentenceCase(medicine.dosage_form);
    const displayUnit = toSentenceCase(medicine.unit);

    const isLowStock = (medicine.stock_quantity || 0) < 10;
    const expiryDate = nearestExpiry ? parseLocalDate(nearestExpiry) : null;
    const isExpired = !!expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate <= new Date();
    const isNearExpiry =
        !!expiryDate &&
        !isExpired &&
        expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return (
        <div className="relative group flex flex-col bg-white dark:bg-slate-800 rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden shadow-sm">
            {/* Top Status Bar */}
            {(isLowStock || isNearExpiry || isExpired) && (
                <div
                    className={clsx(
                        'absolute top-0 inset-x-0 h-1',
                        isExpired ? 'bg-red-500' : isNearExpiry ? 'bg-amber-500' : 'bg-rose-500',
                    )}
                />
            )}

            <div className="p-4 flex-1 flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-start gap-2">
                    <div>
                        <h3
                            className="font-bold text-slate-800 dark:text-white line-clamp-1"
                            title={medicine.name}
                        >
                            {medicine.name}
                        </h3>
                        <div className="flex gap-1 mt-0.5">
                            {medicine.is_controlled_drug && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-[9px] font-black uppercase ring-1 ring-red-200 dark:ring-red-900/50">
                                    Controlled
                                </span>
                            )}
                            {medicine.drug_schedule &&
                                medicine.drug_schedule !== 'unclassified' && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[9px] font-black uppercase ring-1 ring-blue-200 dark:ring-blue-900/50">
                                        {medicine.drug_schedule.replace(/_/g, ' ')}
                                    </span>
                                )}
                        </div>
                        <p className="text-xs font-medium text-slate-500 tracking-wide mt-1">
                            {displayStrength} • {displayDosageForm}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-sm font-black text-healthcare-primary">
                                {formatMoney(sellingPrice)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                                / {displayUnit}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 gap-2 mt-1">
                    {/* Stock */}
                    <div
                        className={clsx(
                            'flex items-center gap-2 p-2 rounded-lg',
                            isLowStock
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                        )}
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-bold leading-none">
                                {medicine.stock_quantity || 0} Left
                            </span>
                        </div>
                    </div>
                </div>

                {/* Expiry Warning */}
                <div
                    className={clsx(
                        'flex items-center gap-2 p-2 rounded-lg mt-auto',
                        isExpired
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            : isNearExpiry
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
                    )}
                >
                    {isExpired || isNearExpiry ? (
                        <AlertTriangle size={14} className="shrink-0" />
                    ) : (
                        <Calendar size={14} className="shrink-0" />
                    )}
                    <div className="flex flex-col">
                        <span className="text-[10px] opacity-70 font-semibold leading-none">
                            {isExpired
                                ? 'Expired'
                                : isNearExpiry
                                  ? 'Expiring Soon'
                                  : 'Nearest Expiry'}
                        </span>
                        <span className="text-xs font-bold leading-none">
                            {isLoading
                                ? '...'
                                : nearestExpiry
                                  ? formatLocalDate(nearestExpiry)
                                  : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Footer */}
            <div className="p-3 bg-slate-50/50 dark:bg-slate-800/50">
                <button
                    onClick={() => onAddToCart(medicine)}
                    disabled={
                        readOnly ||
                        !medicine.stock_quantity ||
                        medicine.stock_quantity <= 0 ||
                        isExpired
                    }
                    className={clsx(
                        'w-full py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2',
                        readOnly ||
                            !medicine.stock_quantity ||
                            medicine.stock_quantity <= 0 ||
                            isExpired
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                            : 'bg-healthcare-primary text-white hover:bg-healthcare-primary/90 dark:bg-healthcare-primary dark:text-white',
                    )}
                >
                    {isExpired ? (
                        <>
                            <AlertCircle size={16} />
                            Expired
                        </>
                    ) : !medicine.stock_quantity || medicine.stock_quantity <= 0 ? (
                        'Out of Stock'
                    ) : (
                        <>Add to Cart</>
                    )}
                </button>
                {onFindAlternatives && (
                    <button
                        onClick={() => onFindAlternatives(medicine)}
                        disabled={readOnly || isFindingAlternatives}
                        className="mt-2 w-full py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isFindingAlternatives ? 'Checking alternatives...' : 'Find Alternatives'}
                    </button>
                )}
            </div>
        </div>
    );
};
