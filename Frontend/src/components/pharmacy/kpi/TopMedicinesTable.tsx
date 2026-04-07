import { Trophy, ArrowUpRight } from 'lucide-react';
import type { TopRevenueMedicine } from '../../../types/pharmacy';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

export const TopMedicinesTable = ({ data }: { data: TopRevenueMedicine[] }) => {
    const { formatMoney } = useRuntimeConfig();
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Trophy size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            Top Revenue Items
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Highest Value Products
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="tc-table w-full">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="text-left py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Medicine
                            </th>
                            <th className="text-right py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Revenue
                            </th>
                            <th className="text-right py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Profit
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {data.map((item) => (
                            <tr
                                key={item.medicine_id}
                                className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <td className="py-3">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                        {item.medicine_name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                                        {item.quantity} units sold
                                    </p>
                                </td>
                                <td className="py-3 text-right">
                                    <p className="text-xs font-black text-slate-900 dark:text-white">
                                        {formatMoney(item.revenue)}
                                    </p>
                                </td>
                                <td className="py-3 text-right">
                                    <div className="flex items-center justify-end gap-1 text-emerald-600">
                                        <p className="text-xs font-black">
                                            {formatMoney(item.profit)}
                                        </p>
                                        <ArrowUpRight size={10} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button className="mt-6 w-full py-2.5 bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-500 hover:text-healthcare-primary uppercase tracking-widest rounded-xl transition-colors border border-transparent hover:border-healthcare-primary/20">
                View Detailed Sales Report
            </button>
        </div>
    );
};
