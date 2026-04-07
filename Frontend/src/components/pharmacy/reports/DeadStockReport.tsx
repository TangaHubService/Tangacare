import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { PackageX, Archive, DollarSign } from 'lucide-react';

export function DeadStockReport() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [overstock, setOverstock] = useState<
        import('../../../types/pharmacy').OverstockData | null
    >(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (effectiveFacilityId) {
            loadDeadStock();
        }
    }, [effectiveFacilityId]);

    const loadDeadStock = async () => {
        if (!effectiveFacilityId) return;
        setLoading(true);
        try {
            const data = await pharmacyService.getOverstockReport();
            setOverstock(data);
        } catch (error) {
            console.error('Failed to load dead stock report', error);
        } finally {
            setLoading(false);
        }
    };

    const items = overstock?.items || [];
    const totalValue = items.reduce((sum, item) => sum + Number(item.excess_value), 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg">
                        <PackageX size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Dead Stock Items</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {loading ? '...' : items.length}
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">
                            Total Value Tied Up
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {loading
                                ? '...'
                                : new Intl.NumberFormat('sw-TZ', {
                                      style: 'currency',
                                      currency: 'TZS',
                                  }).format(totalValue)}
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <SkeletonTable
                    rows={5}
                    columns={5}
                    headers={['Medicine', 'Last Dispensed', 'Current Qty', 'Stock Value', 'Status']}
                    columnAligns={['left', 'right', 'right', 'right', 'center']}
                    className="border-none shadow-none"
                />
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 text-center">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
                        <Archive className="text-blue-500" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Active Inventory
                    </h3>
                    <p className="text-slate-500 mt-1 max-w-sm">
                        No dead stock identified. All items have moved within the last 180 days.
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="tc-table w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-slate-500">Medicine</th>
                                <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                    Last Dispensed
                                </th>
                                <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                    Current Qty
                                </th>
                                <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                    Stock Value
                                </th>
                                <th className="px-6 py-3 font-semibold text-slate-500 text-center">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {items.map((item) => (
                                <tr
                                    key={item.medicine_id}
                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-bold text-slate-900 dark:text-white">
                                            {item.medicine_name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        N/A
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium whitespace-nowrap">
                                        {item.current_quantity}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-900 dark:text-white font-mono whitespace-nowrap">
                                        {new Intl.NumberFormat('sw-TZ', {
                                            style: 'currency',
                                            currency: 'TZS',
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        }).format(Number(item.excess_value))}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 px-2 py-0.5 rounded-full">
                                            No Movement
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
