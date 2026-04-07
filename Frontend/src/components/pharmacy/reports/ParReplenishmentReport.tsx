import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, RefreshCcw } from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy.service';
import { SkeletonTable } from '../../ui/SkeletonTable';
import { toast } from 'react-hot-toast';

interface ParReplenishmentReportProps {
    facilityId?: number;
}

type ParTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export function ParReplenishmentReport({ facilityId }: ParReplenishmentReportProps) {
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [statusFilter, setStatusFilter] = useState<ParTaskStatus | 'all'>('pending');
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [tasks, setTasks] = useState<any[]>([]);

    const load = async () => {
        if (!facilityId) return;
        setLoading(true);
        try {
            const [dashboardResult, taskResult] = await Promise.all([
                pharmacyService.getParDashboard(facilityId),
                pharmacyService.getParTasks(
                    facilityId,
                    statusFilter === 'all' ? undefined : { status: statusFilter },
                ),
            ]);
            setDashboard(dashboardResult);
            setTasks(Array.isArray(taskResult) ? taskResult : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [facilityId, statusFilter]);

    const handleGenerateTasks = async () => {
        if (!facilityId) return;
        setGenerating(true);
        try {
            const result = await pharmacyService.generateParTasks(facilityId);
            toast.success(
                `PAR tasks generated: ${Number(result?.created || 0)} new, ${Number(result?.updated || 0)} refreshed`,
            );
            await load();
        } catch (error) {
            console.error('Failed to generate PAR tasks:', error);
            toast.error('Failed to generate PAR tasks');
        } finally {
            setGenerating(false);
        }
    };

    const updateTaskStatus = async (taskId: number, status: ParTaskStatus) => {
        if (!facilityId) return;
        try {
            await pharmacyService.updateParTaskStatus(taskId, facilityId, { status });
            toast.success(`Task marked as ${status.replace('_', ' ')}`);
            await load();
        } catch (error) {
            console.error('Failed to update PAR task status:', error);
            toast.error('Failed to update task status');
        }
    };

    const summary = useMemo(
        () =>
            dashboard?.summary || {
                tracked_items: 0,
                compliant_items: 0,
                below_min_items: 0,
                out_of_stock_items: 0,
                total_gap_quantity: 0,
            },
        [dashboard],
    );

    if (!facilityId) {
        return <div className="text-sm text-slate-500">Select a facility to view this report.</div>;
    }

    if (loading) {
        return (
            <SkeletonTable
                rows={8}
                columns={8}
                headers={[
                    'Medicine',
                    'Department',
                    'Current',
                    'Target',
                    'Suggested',
                    'Priority',
                    'Status',
                    'Actions',
                ]}
                className="border-none shadow-none"
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-healthcare-primary" />
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        PAR Replenishment
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ParTaskStatus | 'all')}
                        className="px-2 py-1 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                        <option value="all">All tasks</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                        onClick={handleGenerateTasks}
                        disabled={generating}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase bg-healthcare-primary text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                        <RefreshCcw size={12} className={generating ? 'animate-spin' : ''} />
                        {generating ? 'Generating...' : 'Generate Tasks'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SummaryCard label="Tracked Items" value={summary.tracked_items} />
                <SummaryCard label="Compliant" value={summary.compliant_items} />
                <SummaryCard label="Below Min" value={summary.below_min_items} />
                <SummaryCard label="Out of Stock" value={summary.out_of_stock_items} />
                <SummaryCard label="Gap Quantity" value={summary.total_gap_quantity} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="tc-table w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 text-left font-black">Medicine</th>
                            <th className="px-4 py-3 text-left font-black">Department</th>
                            <th className="px-4 py-3 text-right font-black">Current</th>
                            <th className="px-4 py-3 text-right font-black">Target</th>
                            <th className="px-4 py-3 text-right font-black">Suggested</th>
                            <th className="px-4 py-3 text-left font-black">Priority</th>
                            <th className="px-4 py-3 text-left font-black">Status</th>
                            <th className="px-4 py-3 text-right font-black">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tasks.map((task) => (
                            <tr key={task.id}>
                                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                    {task.medicine?.name || `Medicine #${task.medicine_id}`}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                    {task.department?.name || `Dept #${task.department_id}`}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(task.current_quantity || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {Number(task.target_quantity || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-healthcare-primary">
                                    {Number(task.suggested_quantity || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700">
                                        {String(task.priority || 'low')}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                                        {String(task.status || 'pending').replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="inline-flex gap-1">
                                        <button
                                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                            className="px-2 py-1 text-[10px] font-black uppercase rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                                        >
                                            Start
                                        </button>
                                        <button
                                            onClick={() => updateTaskStatus(task.id, 'completed')}
                                            className="px-2 py-1 text-[10px] font-black uppercase rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {tasks.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                    No PAR tasks for this filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
            <p className="text-lg font-black text-slate-700 dark:text-slate-100">
                {Number(value || 0).toLocaleString()}
            </p>
        </div>
    );
}
