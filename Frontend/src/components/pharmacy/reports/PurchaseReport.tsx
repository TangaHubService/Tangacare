import { useState, useEffect } from 'react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { ShoppingCart, TrendingUp, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '../../../lib/date';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useRuntimeConfig } from '../../../context/RuntimeConfigContext';

interface PurchaseReportProps {
    facilityId?: number;
    startDate?: string;
    endDate?: string;
}

export function PurchaseReport({ facilityId, startDate, endDate }: PurchaseReportProps) {
    const { formatMoney } = useRuntimeConfig();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        if (facilityId && startDate && endDate) {
            loadReport();
        }
    }, [facilityId, startDate, endDate]);

    const loadReport = async () => {
        setLoading(true);
        try {
            const data = await pharmacyService.getPurchaseReport(facilityId!, {
                start_date: startDate,
                end_date: endDate,
            });
            setReportData(data);
        } catch (error) {
            console.error('Failed to load purchase report', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading)
        return (
            <SkeletonTable
                rows={5}
                columns={5}
                headers={null}
                className="border-none shadow-none"
            />
        );
    if (!reportData) return null;

    const COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308'];

    const supplierChartData = reportData.by_supplier.slice(0, 6).map((s: any) => ({
        name: s.supplier_name,
        value: Number(s.total_amount),
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 flex items-center justify-center">
                            <ShoppingCart size={20} />
                        </div>
                        <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-full uppercase">
                            Total Spent
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {formatMoney(reportData.summary.total_amount)}
                    </h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Procurement investment
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                            <Package size={20} />
                        </div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase">
                            Orders
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {reportData.summary.order_count}
                    </h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Total purchase orders
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-full uppercase">
                            Avg Value
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {formatMoney(Math.round(reportData.summary.average_order_value))}
                    </h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Per purchase order
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase">
                            Suppliers
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {reportData.by_supplier.length}
                    </h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Active vendors
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Supplier Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">
                        Supplier Distribution
                    </h4>
                    <div className="h-64 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={supplierChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {supplierChartData.map((_entry: any, index: number) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                    }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Items Table */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                            Top Purchased Items
                        </h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="tc-table w-full">
                            <thead>
                                <tr className="text-left border-b border-slate-50 dark:border-slate-800">
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Medicine
                                    </th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                                        Qty Ordered
                                    </th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                                        Total Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {reportData.by_item.slice(0, 5).map((item: any) => (
                                    <tr
                                        key={item.medicine_id}
                                        className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                    >
                                        <td className="py-4">
                                            <p className="text-sm font-black text-slate-700 dark:text-white group-hover:text-teal-600 transition-colors uppercase">
                                                {item.medicine_name}
                                            </p>
                                        </td>
                                        <td className="py-4 text-center">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                {item.quantity_ordered}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <p className="text-sm font-black text-slate-800 dark:text-white tracking-tighter">
                                                {formatMoney(item.total_amount)}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Order History */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                        Purchase Order History
                    </h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="tc-table w-full">
                        <thead>
                            <tr className="text-left bg-slate-50/50 dark:bg-slate-800/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Order #
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Supplier
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Date
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                                    Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {reportData.orders.slice(0, 10).map((po: any) => (
                                <tr
                                    key={po.id}
                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-black text-teal-600 uppercase tracking-tight">
                                            {po.order_number}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-white uppercase">
                                            {po.supplier_name}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-medium text-slate-500">
                                            {format(parseLocalDate(po.date), 'MMM dd, yyyy')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                po.status === 'received'
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : po.status === 'pending'
                                                      ? 'bg-amber-50 text-amber-600'
                                                      : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {po.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-sm font-black text-slate-800 dark:text-white tracking-tighter">
                                            {formatMoney(po.total_amount)}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
