import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { Truck } from 'lucide-react';

export function SupplierPerformanceReport() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [suppliers, setSuppliers] = useState<
        import('../../../types/pharmacy').SupplierPerformanceItem[]
    >([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (effectiveFacilityId) {
            loadPerformance();
        }
    }, [effectiveFacilityId]);

    const loadPerformance = async () => {
        if (!effectiveFacilityId) return;
        setLoading(true);
        try {
            const data = await pharmacyService.getSupplierPerformance();
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to load supplier performance', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={6}
                headers={[
                    'Supplier',
                    'Total Orders',
                    'Avg Lead Time',
                    'Fulfillment Rate',
                    'On-Time Rate',
                    'Rating',
                ]}
                columnAligns={['left', 'center', 'center', 'right', 'right', 'center']}
                className="border-none shadow-none"
            />
        );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Summary cards could go here */}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <table className="tc-table w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-500">Supplier</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-center">
                                Total Orders
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-center">
                                Avg Lead Time
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                Fulfillment Rate
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">
                                On-Time Rate
                            </th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-center">
                                Rating
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {suppliers.map((item) => (
                            <tr
                                key={item.supplier_id}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Truck size={16} className="text-slate-400" />
                                        {item.supplier_name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center font-medium whitespace-nowrap">
                                    {item.total_orders}
                                </td>
                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {Number(item.avg_lead_time_days).toFixed(2)} days
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full rounded-full"
                                                style={{ width: `${item.fulfillment_rate}%` }}
                                            />
                                        </div>
                                        <span className="font-bold text-xs">
                                            {item.fulfillment_rate}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span
                                        className={`font-bold ${
                                            item.on_time_delivery_rate > 90
                                                ? 'text-emerald-600'
                                                : item.on_time_delivery_rate > 75
                                                  ? 'text-amber-600'
                                                  : 'text-rose-600'
                                        }`}
                                    >
                                        {item.on_time_delivery_rate}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {item.on_time_delivery_rate > 95 ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                            Excellent
                                        </span>
                                    ) : item.on_time_delivery_rate > 80 ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                            Good
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                            Average
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
