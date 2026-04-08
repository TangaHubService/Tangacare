import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import type { BatchRecall, Batch } from '../../types/pharmacy';
import { RecallStatus, RecallReason } from '../../types/pharmacy';
import { format } from 'date-fns';
import { formatLocalDate, parseLocalDate } from '../../lib/date';
import { LifeBuoy, Plus, Search, AlertCircle, Download, Eye, ChevronRight } from 'lucide-react';
import { SkeletonTable } from '../../components/ui/SkeletonTable';

type InventoryView = 'expiry-actions' | 'recalls';
type ExpiryRisk = 'expired' | 'critical' | 'high' | 'warning' | 'medium' | 'watch' | 'low';
type ExpiryActionType = 'markdown' | 'transfer' | 'vendor_return' | 'disposal' | 'monitor';

interface ExpiryReportItem {
    batch_id: number;
    batch_number: string;
    medicine_name: string;
    expiry_date: string;
    days_until_expiry?: number;
    quantity: number;
    risk_level?: 'critical' | 'warning' | 'watch' | 'expired';
    recommended_action?: string;
}

interface ExpiryReportResponse {
    expiring_soon: ExpiryReportItem[];
    expired: ExpiryReportItem[];
}

interface NearExpiryActionItem {
    stock_id: number;
    medicine_id: number;
    medicine_name: string;
    batch_id: number;
    batch_number: string;
    quantity: number;
    days_to_expiry: number;
    risk_value: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    recommended_action: ExpiryActionType;
    action_reason: string;
}

interface ExpiryActionsResponse {
    summary: Record<ExpiryActionType, number>;
    items: NearExpiryActionItem[];
}

interface CombinedExpiryActionRow {
    batchId: number;
    batchNumber: string;
    medicineName: string;
    expiryDate: string;
    daysLeft: number;
    quantity: number;
    riskLevel: ExpiryRisk;
    action: string;
    actionReason: string;
    riskValue: number;
    status: 'expired' | 'expiring_soon';
}

const EXPIRY_WINDOW_OPTIONS = [30, 60, 90, 120, 180] as const;

function formatActionLabel(value: string) {
    return value.replace(/_/g, ' ');
}

function resolveRiskLevel(item: ExpiryReportItem): ExpiryRisk {
    if (item.risk_level) return item.risk_level;
    const daysLeft = Number(item.days_until_expiry ?? 999);
    if (daysLeft <= 0) return 'expired';
    if (daysLeft <= 7) return 'critical';
    if (daysLeft <= 30) return 'warning';
    return 'watch';
}

function getRiskTone(level: ExpiryRisk) {
    if (level === 'expired' || level === 'critical' || level === 'high') {
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-300 dark:border-rose-900/30';
    }
    if (level === 'warning' || level === 'medium') {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-900/30';
    }
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/10 dark:text-sky-300 dark:border-sky-900/30';
}

function getActionTone(action: string) {
    if (action === 'disposal') {
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-300 dark:border-rose-900/30';
    }
    if (action === 'vendor_return' || action === 'transfer') {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-900/30';
    }
    if (action === 'markdown') {
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/10 dark:text-indigo-300 dark:border-indigo-900/30';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
}

export function BatchRecallPage() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [recalls, setRecalls] = useState<BatchRecall[]>([]);
    const [recallsLoading, setRecallsLoading] = useState(false);
    const [expiryLoading, setExpiryLoading] = useState(false);
    const [view, setView] = useState<'list' | 'detail' | 'initiate'>('list');
    const [inventoryView, setInventoryView] = useState<InventoryView>('expiry-actions');
    const [expiryWindowDays, setExpiryWindowDays] = useState<number>(90);
    const [expirySearch, setExpirySearch] = useState('');
    const [selectedRecall, setSelectedRecall] = useState<BatchRecall | null>(null);
    const [expiryRows, setExpiryRows] = useState<CombinedExpiryActionRow[]>([]);

    const loadRecalls = async () => {
        if (!effectiveFacilityId) return;
        setRecallsLoading(true);
        try {
            const response = await pharmacyService.getRecalls({
                facility_id: effectiveFacilityId,
                page: 1,
                limit: 50,
            });
            setRecalls(response.data);
        } catch (error) {
            console.error('Failed to load recalls', error);
        } finally {
            setRecallsLoading(false);
        }
    };

    const loadExpiryActions = async () => {
        if (!effectiveFacilityId) return;
        setExpiryLoading(true);
        try {
            const [expiryReport, actionPlan] = await Promise.all([
                pharmacyService.getExpiryReport(Number(effectiveFacilityId), {
                    days: expiryWindowDays,
                }) as Promise<ExpiryReportResponse>,
                pharmacyService.getNearExpiryActions({
                    facilityId: Number(effectiveFacilityId),
                    horizon_days: expiryWindowDays,
                }) as Promise<ExpiryActionsResponse>,
            ]);

            const actionMap = new Map<number, NearExpiryActionItem>(
                (actionPlan.items || []).map((item) => [item.batch_id, item]),
            );
            const baseRows = [
                ...(expiryReport.expired || []).map((item) => ({
                    ...item,
                    status: 'expired' as const,
                })),
                ...(expiryReport.expiring_soon || []).map((item) => ({
                    ...item,
                    status: 'expiring_soon' as const,
                })),
            ];

            const mergedRows = baseRows
                .map((item) => {
                    const action = actionMap.get(item.batch_id);
                    const riskLevel = (action?.risk_level || resolveRiskLevel(item)) as ExpiryRisk;
                    const defaultAction =
                        item.status === 'expired'
                            ? 'disposal'
                            : item.recommended_action || 'monitor';
                    return {
                        batchId: item.batch_id,
                        batchNumber: item.batch_number,
                        medicineName: item.medicine_name,
                        expiryDate: item.expiry_date,
                        daysLeft:
                            Number(action?.days_to_expiry ?? item.days_until_expiry ?? 0) ||
                            (item.status === 'expired' ? 0 : 0),
                        quantity: Number(action?.quantity ?? item.quantity ?? 0),
                        riskLevel,
                        action: String(action?.recommended_action || defaultAction),
                        actionReason:
                            action?.action_reason ||
                            (item.status === 'expired'
                                ? 'Expired stock should be isolated from sale and sent to disposal or formal return handling.'
                                : 'Action is based on the selected expiry window and current stock risk.'),
                        riskValue: Number(action?.risk_value || 0),
                        status: item.status,
                    };
                })
                .sort((a, b) => {
                    if (a.status !== b.status) {
                        return a.status === 'expired' ? -1 : 1;
                    }
                    return a.daysLeft - b.daysLeft || b.riskValue - a.riskValue;
                });

            setExpiryRows(mergedRows);
        } catch (error) {
            console.error('Failed to load expiry actions', error);
            setExpiryRows([]);
        } finally {
            setExpiryLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'list' && inventoryView === 'recalls') {
            loadRecalls();
        }
    }, [effectiveFacilityId, inventoryView, view]);

    useEffect(() => {
        if (view === 'list' && inventoryView === 'expiry-actions') {
            loadExpiryActions();
        }
    }, [effectiveFacilityId, expiryWindowDays, inventoryView, view]);

    const handleViewDetail = (recall: BatchRecall) => {
        setSelectedRecall(recall);
        setView('detail');
    };

    const filteredExpiryRows = useMemo(() => {
        const query = expirySearch.trim().toLowerCase();
        if (!query) return expiryRows;
        return expiryRows.filter((row) =>
            [
                row.medicineName,
                row.batchNumber,
                formatActionLabel(row.action),
                row.actionReason,
                row.riskLevel,
            ]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [expiryRows, expirySearch]);

    const expirySummary = useMemo(() => {
        return {
            total: expiryRows.length,
            expired: expiryRows.filter((row) => row.status === 'expired').length,
            disposal: expiryRows.filter((row) => row.action === 'disposal').length,
            vendorReturn: expiryRows.filter((row) => row.action === 'vendor_return').length,
        };
    }, [expiryRows]);

    if (view === 'initiate') {
        return <InitiateRecallForm onBack={() => setView('list')} />;
    }

    if (view === 'detail' && selectedRecall) {
        return <RecallDetail recall={selectedRecall} onBack={() => setView('list')} />;
    }

    return (
        <ProtectedRoute
            allowedRoles={[
                'super_admin',
                'facility_admin',
                'store_manager',
                'pharmacist',
                'auditor',
                'admin',
                'owner',
            ]}
            requireFacility
        >
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white flex items-center gap-2">
                            <LifeBuoy className="text-rose-500" /> Expiry Monitoring & Recalls
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Review expiring batches, recommended actions, and formal recall cases
                            from one stock workspace.
                        </p>
                    </div>
                    {inventoryView === 'recalls' && (
                        <button
                            onClick={() => setView('initiate')}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors shadow-md"
                        >
                            <Plus size={18} /> Initiate Recall
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {(
                        [
                            ['expiry-actions', 'Expiry Actions'],
                            ['recalls', 'Recalls'],
                        ] as Array<[InventoryView, string]>
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            onClick={() => setInventoryView(value)}
                            className={[
                                'rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors',
                                inventoryView === value
                                    ? 'bg-healthcare-primary text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-healthcare-dark dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                            ].join(' ')}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {inventoryView === 'expiry-actions' ? (
                    <section className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                <span>{expirySummary.total.toLocaleString()} batches</span>
                                <span className="text-slate-300">•</span>
                                <span>{expirySummary.expired.toLocaleString()} expired</span>
                                <span className="text-slate-300">•</span>
                                <span>
                                    {expirySummary.disposal.toLocaleString()} disposal actions
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>
                                    {expirySummary.vendorReturn.toLocaleString()} vendor return
                                    candidates
                                </span>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                    <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Window
                                    </span>
                                    <select
                                        value={String(expiryWindowDays)}
                                        onChange={(e) =>
                                            setExpiryWindowDays(Number(e.target.value) || 90)
                                        }
                                        className="bg-transparent text-xs font-black uppercase tracking-wider text-slate-700 outline-none dark:text-slate-200"
                                    >
                                        {EXPIRY_WINDOW_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option} days
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="relative block">
                                    <Search
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        size={16}
                                    />
                                    <input
                                        type="text"
                                        value={expirySearch}
                                        onChange={(e) => setExpirySearch(e.target.value)}
                                        placeholder="Search medicine, batch, action..."
                                        className="w-full min-w-[280px] rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-healthcare-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                </label>
                            </div>
                        </div>

                        {expiryLoading ? (
                            <SkeletonTable
                                rows={8}
                                columns={9}
                                headers={[
                                    'Medicine',
                                    'Batch',
                                    'Expiry',
                                    'Days Left',
                                    'Qty',
                                    'Risk',
                                    'Action',
                                    'Reason',
                                    'Risk Value',
                                ]}
                                columnAligns={[
                                    'left',
                                    'left',
                                    'left',
                                    'right',
                                    'right',
                                    'left',
                                    'left',
                                    'left',
                                    'right',
                                ]}
                                className="border-none shadow-none"
                            />
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                                <div className="overflow-x-auto">
                                    <table className="tc-table w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-5 py-4 font-bold text-slate-500">
                                                    Medicine
                                                </th>
                                                <th className="px-5 py-4 font-bold text-slate-500">
                                                    Batch
                                                </th>
                                                <th className="px-5 py-4 font-bold text-slate-500">
                                                    Expiry
                                                </th>
                                                <th className="px-5 py-4 text-right font-bold text-slate-500">
                                                    Days Left
                                                </th>
                                                <th className="px-5 py-4 text-right font-bold text-slate-500">
                                                    Qty
                                                </th>
                                                <th className="px-5 py-4 font-bold text-slate-500">
                                                    Risk
                                                </th>
                                                <th className="px-5 py-4 font-bold text-slate-500">
                                                    Action
                                                </th>
                                                <th className="px-5 py-4 font-bold text-slate-500">
                                                    Reason
                                                </th>
                                                <th className="px-5 py-4 text-right font-bold text-slate-500">
                                                    Risk Value
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredExpiryRows.length > 0 ? (
                                                filteredExpiryRows.map((row) => (
                                                    <tr
                                                        key={row.batchId}
                                                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                                                    >
                                                        <td className="px-5 py-4">
                                                            <div className="font-semibold text-slate-900 dark:text-white">
                                                                {row.medicineName}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {row.status === 'expired'
                                                                    ? 'Expired batch'
                                                                    : 'Expiring soon'}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-200">
                                                            {row.batchNumber}
                                                        </td>
                                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                                            {formatLocalDate(row.expiryDate)}
                                                        </td>
                                                        <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-slate-200">
                                                            {row.status === 'expired'
                                                                ? 'Expired'
                                                                : row.daysLeft}
                                                        </td>
                                                        <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-slate-200">
                                                            {row.quantity.toLocaleString()}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span
                                                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getRiskTone(row.riskLevel)}`}
                                                            >
                                                                {formatActionLabel(row.riskLevel)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span
                                                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getActionTone(row.action)}`}
                                                            >
                                                                {formatActionLabel(row.action)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 max-w-[340px] whitespace-normal text-sm text-slate-500 dark:text-slate-400">
                                                            {row.actionReason}
                                                        </td>
                                                        <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-slate-200">
                                                            RWF {row.riskValue.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={9}
                                                        className="px-6 py-12 text-center text-slate-400"
                                                    >
                                                        No expiry action rows found for the selected
                                                        window.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                ) : recallsLoading ? (
                    <SkeletonTable
                        rows={5}
                        columns={7}
                        headers={[
                            'Recall #',
                            'Medicine & Batch',
                            'Reason',
                            'Affected Sales',
                            'Recovery Status',
                            'Status',
                        ]}
                        columnAligns={['left', 'left', 'left', 'left', 'left', 'left', 'right']}
                        actions
                        className="border-none shadow-none"
                    />
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto">
                        <table className="tc-table w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-slate-500">Recall #</th>
                                    <th className="px-6 py-4 font-bold text-slate-500">
                                        Medicine & Batch
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500">Reason</th>
                                    <th className="px-6 py-4 font-bold text-slate-500">
                                        Affected Sales
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500">
                                        Recovery Status
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500">Status</th>
                                    <th className="px-6 py-4 font-bold text-slate-500 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recalls.length > 0 ? (
                                    recalls.map((recall) => (
                                        <tr
                                            key={recall.id}
                                            className="hover:bg-slate-50/50 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white underline decoration-rose-200 underline-offset-4">
                                                {recall.recall_number}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white">
                                                    {recall.medicine?.name}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    Batch: {recall.batch?.batch_number}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                                                    {recall.reason.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900 dark:text-white font-bold">
                                                    {recall.affected_sales_count}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {recall.affected_quantity} units total
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className="h-full bg-rose-500"
                                                        style={{
                                                            width: `${Math.min(100, (recall.recovered_quantity / recall.affected_quantity) * 100 || 0)}%`,
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    {recall.recovered_quantity} /{' '}
                                                    {recall.affected_quantity} recovered
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                <StatusBadge status={recall.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleViewDetail(recall)}
                                                    className="p-2 text-healthcare-primary hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-6 py-12 text-center text-slate-400"
                                        >
                                            No active or historical recalls found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

function InitiateRecallForm({ onBack }: { onBack: () => void }) {
    const { user, facilityId } = useAuth();
    const [step, setStep] = useState(1);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [search, setSearch] = useState('');
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [reason, setReason] = useState<RecallReason>(RecallReason.QUALITY_ISSUE);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const searchBatches = async () => {
        if (search.length < 2) return;
        try {
            const data = await pharmacyService.getBatches({
                facility_id: facilityId || user?.facility_id,
            });
            // Filter locally by search string (name or batch number)
            const filtered = data.filter(
                (b) =>
                    (b as any).medicine?.name.toLowerCase().includes(search.toLowerCase()) ||
                    b.batch_number.toLowerCase().includes(search.toLowerCase()),
            );
            setBatches(filtered);
        } catch (error) {
            console.error('Search failed', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(searchBatches, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSubmit = async () => {
        if (!selectedBatch) return;
        setSubmitting(true);
        try {
            await pharmacyService.initiateRecall({
                batch_id: selectedBatch.id,
                reason,
                description,
            });
            onBack();
        } catch (error) {
            alert('Failed to initiate recall');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h1 className="text-xl font-black">Initiate Batch Recall</h1>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                {step === 1 ? (
                    <>
                        <label className="block text-sm font-bold text-slate-700">
                            Search Batch to Recall
                        </label>
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                size={18}
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Medicine name or batch number..."
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200"
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y">
                            {batches.map((b) => (
                                <div
                                    key={b.id}
                                    onClick={() => {
                                        setSelectedBatch(b);
                                        setStep(2);
                                    }}
                                    className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-bold">{(b as any).medicine?.name}</div>
                                        <div className="text-xs text-slate-500">
                                            Batch: {b.batch_number} • Exp: {b.expiry_date}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-400" />
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                            <div className="text-xs text-rose-500 font-bold uppercase">
                                Selected for Recall
                            </div>
                            <div className="font-bold">{(selectedBatch as any).medicine?.name}</div>
                            <div className="text-sm">Batch: {selectedBatch?.batch_number}</div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">
                                    Recall Reason
                                </label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value as any)}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    {Object.values(RecallReason).map((r) => (
                                        <option key={r} value={r}>
                                            {r.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">
                                    Detailed Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full p-2 border rounded-lg h-32"
                                    placeholder="Provide detailed information regarding the issue..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={onBack}
                                className="flex-1 py-2 border rounded-lg font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !description}
                                className="flex-1 py-2 bg-rose-600 text-white rounded-lg font-bold disabled:opacity-50"
                            >
                                {submitting ? 'Initiating...' : 'Start Recall'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function RecallDetail({ recall, onBack }: { recall: BatchRecall; onBack: () => void }) {
    const handleDownloadNotice = () => {
        pharmacyService.downloadRecallNotice(recall.id);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full rotate-180">
                    <ChevronRight size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-black">Recall {recall.recall_number}</h1>
                    <div className="text-sm text-slate-500">
                        {recall.medicine?.name} • Batch {recall.batch?.batch_number}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadNotice}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
                    >
                        <Download size={16} /> Download Notice
                    </button>
                    {recall.status !== RecallStatus.COMPLETED && (
                        <button className="px-4 py-2 bg-healthcare-primary text-white rounded-lg text-sm font-bold">
                            Mark as Completed
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                        <h2 className="font-bold mb-4 flex items-center gap-2">
                            <AlertCircle size={18} className="text-rose-500" /> Recall Information
                        </h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-slate-400">Reason</div>
                                <div className="font-bold capitalize">
                                    {recall.reason.replace(/_/g, ' ')}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-400">Initiated At</div>
                                <div className="font-bold">
                                    {format(parseLocalDate(recall.initiated_at), 'PPP')}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="text-slate-400">Description</div>
                                <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg italic">
                                    "{recall.description}"
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                        <h2 className="font-bold mb-4">Affected Inventory Tracking</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <div className="text-xs text-slate-400 uppercase font-black">
                                    Total Affected
                                </div>
                                <div className="text-2xl font-black">
                                    {recall.affected_quantity}
                                </div>
                            </div>
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl">
                                <div className="text-xs text-emerald-600 uppercase font-black">
                                    Recovered
                                </div>
                                <div className="text-2xl font-black text-emerald-600">
                                    {recall.recovered_quantity}
                                </div>
                            </div>
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                                <div className="text-xs text-amber-600 uppercase font-black">
                                    Remaining Out
                                </div>
                                <div className="text-2xl font-black text-amber-600">
                                    {recall.affected_quantity - recall.recovered_quantity}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                        <h2 className="font-bold mb-4">Affected Contacts</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Patients to Notify</span>
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-full">
                                    {recall.affected_sales_count}
                                </span>
                            </div>
                            <button className="w-full py-2 bg-rose-50 text-rose-600 text-sm font-bold rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors">
                                Send SMS Alerts All
                            </button>
                            <button className="w-full py-2 bg-slate-50 text-slate-600 text-sm font-bold rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                                Export Patient List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: RecallStatus }) {
    switch (status) {
        case RecallStatus.INITIATED:
            return (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                    Initiated
                </span>
            );
        case RecallStatus.IN_PROGRESS:
            return (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                    In Progress
                </span>
            );
        case RecallStatus.COMPLETED:
            return (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    Completed
                </span>
            );
        default:
            return (
                <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                    {status}
                </span>
            );
    }
}
