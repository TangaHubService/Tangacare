import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, ShieldAlert, Package, Clock, Receipt } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Sale } from '../../types/pharmacy';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';

interface PatientSummaryPanelProps {
    /** Patient user object as returned by the patient search */
    patient: {
        id: number;
        name: string;
        id_type?: string;
        id_number?: string;
        phone?: string;
        insurance_provider?: string;
    };
    /** Optional: called when the Download Receipt button is clicked with a past sale */
    onDownloadReceipt?: (saleId: number) => void;
}

/**
 * H-6: Patient Summary Panel.
 * Displays patient demographics, insurance, and last 3 purchases while
 * the pharmacist is preparing a dispensing/sale transaction.
 */
export const PatientSummaryPanel: React.FC<PatientSummaryPanelProps> = ({
    patient,
    onDownloadReceipt,
}) => {
    const { formatMoney } = useRuntimeConfig();
    const [expanded, setExpanded] = useState(true);

    // Fetch the last 5 sales for this patient to show recent history
    const { data: recentSales, isLoading } = useQuery({
        queryKey: ['patient-sales', patient.id],
        queryFn: () => pharmacyService.getPatientSales(patient.id, 3),
        staleTime: 60_000,
    });

    const sales: Sale[] = Array.isArray(recentSales) ? recentSales : [];

    // Check if patient has any controlled-drug purchases in recent history
    const hasControlledDrug = sales.some((s) =>
        (s.items ?? []).some((i: any) => i.medicine?.is_controlled_drug),
    );

    return (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-healthcare-primary/5 dark:bg-slate-700/50 hover:bg-healthcare-primary/10 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-healthcare-primary/10 flex items-center justify-center">
                        <User size={16} className="text-healthcare-primary" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                            {patient.name}
                        </p>
                        {patient.id_type && patient.id_number && (
                            <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-medium tracking-wide">
                                {patient.id_type}: {patient.id_number}
                            </p>
                        )}
                    </div>
                </div>
                <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="px-4 pb-4 pt-3 space-y-4">
                    {/* Insurance */}
                    {patient.insurance_provider && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <Receipt size={14} className="text-blue-500 shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">
                                    Insurance
                                </p>
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                    {patient.insurance_provider}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Controlled drug warning */}
                    {hasControlledDrug && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
                            <ShieldAlert size={14} className="text-orange-500 shrink-0" />
                            <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                                Controlled substance in recent history
                            </p>
                        </div>
                    )}

                    {/* Recent purchases */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Clock size={10} />
                            Recent Purchases
                        </p>

                        {isLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="h-8 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"
                                    />
                                ))}
                            </div>
                        ) : sales.length === 0 ? (
                            <div className="flex flex-col items-center py-4 text-slate-300 dark:text-slate-600">
                                <Package size={24} className="mb-1" />
                                <p className="text-xs">No previous purchases</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {sales.map((sale) => (
                                    <li
                                        key={sale.id}
                                        className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                                                    {sale.sale_number}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {sale.items?.length ?? 0} item(s) &bull; {formatMoney(sale.total_amount)}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <p className="text-[10px] text-slate-400">
                                                    {sale.created_at
                                                        ? new Date(
                                                              sale.created_at,
                                                          ).toLocaleDateString('en-GB', {
                                                              day: '2-digit',
                                                              month: 'short',
                                                          })
                                                        : '–'}
                                                </p>
                                                {onDownloadReceipt && (
                                                    <button
                                                        onClick={() => onDownloadReceipt(sale.id)}
                                                        className="text-[9px] text-healthcare-primary hover:underline font-bold mt-0.5"
                                                    >
                                                        Receipt
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* medicine names */}
                                        {sale.items && sale.items.length > 0 && (
                                            <p className="text-[9px] text-slate-400 mt-1 truncate">
                                                {sale.items
                                                    .map((i: any) => i.medicine?.name ?? '–')
                                                    .join(', ')}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
