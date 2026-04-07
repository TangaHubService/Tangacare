import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, AlertTriangle, ShieldAlert, Package, Clock } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Batch, Medicine } from '../../types/pharmacy';
import { formatLocalDate, formatLocalDateTime, parseLocalDate } from '../../lib/date';

const RISK_SOON_DAYS = 90;

const toLabel = (value: string) =>
    String(value || '')
        .replace(/[_\s]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

export function MedicineDetailsPage() {
    const { medicineId } = useParams({ from: '/app/inventory/$medicineId' });
    const navigate = useNavigate();
    const { user, facilityId } = useAuth();
    const [medicine, setMedicine] = useState<Medicine | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const effectiveFacilityId = facilityId ?? user?.facility_id ?? null;
    const numericMedicineId = Number(medicineId);

    useEffect(() => {
        if (!Number.isFinite(numericMedicineId)) {
            setError('Invalid medicine identifier.');
            setLoading(false);
            return;
        }

        const loadMedicineDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const [medicineData, batchRows, movementResponse] = await Promise.all([
                    pharmacyService.getMedicine(numericMedicineId),
                    pharmacyService.getBatches({
                        medicine_id: numericMedicineId,
                        facility_id: effectiveFacilityId || undefined,
                    }),
                    effectiveFacilityId
                        ? pharmacyService.getStockMovements({
                              facilityId: effectiveFacilityId,
                              page: 1,
                              limit: 250,
                          })
                        : Promise.resolve({ data: [] as any[] }),
                ]);

                const medicineName = String(medicineData.name || '').toLowerCase();
                const movementRows = (movementResponse as any).data || [];
                const filteredMovements = movementRows.filter((row: any) => {
                    if (Number(row.medicine_id) === numericMedicineId) return true;
                    const rowMedicineName = String(
                        row.medicine_name || row.medicine?.name || row.description || '',
                    ).toLowerCase();
                    return medicineName && rowMedicineName.includes(medicineName);
                });

                setMedicine(medicineData);
                setBatches(Array.isArray(batchRows) ? batchRows : []);
                setMovements(filteredMovements.slice(0, 100));
            } catch (err: any) {
                setError(err?.response?.data?.message || 'Failed to load medicine details.');
            } finally {
                setLoading(false);
            }
        };

        loadMedicineDetails();
    }, [effectiveFacilityId, numericMedicineId]);

    const stockSummary = useMemo(() => {
        const totalFromBatches = batches.reduce(
            (sum, batch) => sum + Number(batch.current_quantity || 0),
            0,
        );
        const fallbackTotal = Number(medicine?.stock_quantity || 0);
        const totalStock = totalFromBatches > 0 ? totalFromBatches : fallbackTotal;
        const reservedStock = Number((medicine as any)?.reserved_stock || 0);
        const availableStock = Math.max(totalStock - reservedStock, 0);
        return { totalStock, reservedStock, availableStock };
    }, [batches, medicine]);

    const alertSummary = useMemo(() => {
        const now = new Date();
        const soon = new Date();
        soon.setDate(now.getDate() + RISK_SOON_DAYS);

        const nearExpiry = batches.filter((batch) => {
            const expiryDate = batch.expiry_date ? parseLocalDate(batch.expiry_date) : null;
            return expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate >= now && expiryDate <= soon;
        });

        const expired = batches.filter((batch) => {
            const expiryDate = batch.expiry_date ? parseLocalDate(batch.expiry_date) : null;
            return expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate < now;
        });

        const reorderPoint = Number(medicine?.reorder_point ?? medicine?.min_stock_level ?? 0);
        const isLowStock = reorderPoint > 0 && stockSummary.totalStock <= reorderPoint;

        return { nearExpiry, expired, isLowStock, reorderPoint };
    }, [batches, medicine, stockSummary.totalStock]);

    if (loading) {
        return (
            <ProtectedRoute
                allowedRoles={[
                    'admin',
                    'pharmacist',
                    'super_admin',
                    'store_manager',
                    'facility_admin',
                    'auditor',
                    'owner',
                ]}
                requireFacility
            >
                <div className="p-6">
                    <div className="w-full h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
            </ProtectedRoute>
        );
    }

    if (!medicine || error) {
        return (
            <ProtectedRoute
                allowedRoles={[
                    'admin',
                    'pharmacist',
                    'super_admin',
                    'store_manager',
                    'facility_admin',
                    'auditor',
                    'owner',
                ]}
                requireFacility
            >
                <div className="p-6 space-y-4">
                    <button
                        onClick={() => navigate({ to: '/app/inventory' as any, search: {} as any })}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                    >
                        <ArrowLeft size={16} /> Back to Inventory
                    </button>
                    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">
                        {error || 'Medicine not found.'}
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    const isControlled = Boolean(
        (medicine as any).is_controlled_drug ||
        (medicine as any).controlled_flag ||
        (medicine as any).drug_schedule?.includes('controlled'),
    );

    return (
        <ProtectedRoute
            allowedRoles={[
                'admin',
                'pharmacist',
                'super_admin',
                'store_manager',
                'facility_admin',
                'auditor',
                'owner',
            ]}
            requireFacility
        >
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={() => navigate({ to: '/app/inventory' as any, search: {} as any })}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300"
                    >
                        <ArrowLeft size={16} /> Back to Inventory
                    </button>
                    {isControlled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-3 py-1">
                            <ShieldAlert size={12} /> Controlled Medicine
                        </span>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                    <h2 className="text-2xl font-black text-healthcare-dark dark:text-white">
                        {medicine.name}
                    </h2>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                        {medicine.code}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
                        <InfoCard
                            label="Generic Name"
                            value={String((medicine as any).generic_name || 'N/A')}
                        />
                        <InfoCard label="Dosage" value={medicine.strength || 'N/A'} />
                        <InfoCard
                            label="Manufacturer"
                            value={String((medicine as any).manufacturer || 'N/A')}
                        />
                        <InfoCard
                            label="Category"
                            value={String(
                                (medicine as any).category?.name ||
                                    (medicine as any).category_name ||
                                    'N/A',
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        label="Total Stock"
                        value={stockSummary.totalStock}
                        icon={<Package size={14} />}
                    />
                    <MetricCard
                        label="Reserved Stock"
                        value={stockSummary.reservedStock}
                        icon={<Clock size={14} />}
                    />
                    <MetricCard
                        label="Available Stock"
                        value={stockSummary.availableStock}
                        icon={<Package size={14} />}
                    />
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-wider text-healthcare-dark dark:text-white">
                            Batch List
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {batches.length} batches
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="tc-table w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                    <th className="px-6 py-3 font-black">Batch</th>
                                    <th className="px-6 py-3 font-black">Expiry Date</th>
                                    <th className="px-6 py-3 font-black text-right">Quantity</th>
                                    <th className="px-6 py-3 font-black">Supplier</th>
                                    <th className="px-6 py-3 font-black">Received Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {batches.length === 0 ? (
                                    <tr>
                                        <td
                                            className="px-6 py-8 text-sm text-slate-500"
                                            colSpan={5}
                                        >
                                            No batches available.
                                        </td>
                                    </tr>
                                ) : (
                                    batches.map((batch) => (
                                        <tr key={batch.id}>
                                            <td className="px-6 py-4 font-black text-slate-800 dark:text-white">
                                                {batch.batch_number}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {batch.expiry_date
                                                    ? formatLocalDate(batch.expiry_date)
                                                    : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">
                                                {Number(
                                                    batch.current_quantity || 0,
                                                ).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {String(
                                                    (batch as any).supplier_name ||
                                                        (batch as any).supplier?.name ||
                                                        'N/A',
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {(batch as any).received_date
                                                    ? formatLocalDate((batch as any).received_date)
                                                    : 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-wider text-healthcare-dark dark:text-white">
                            Stock Movement History
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {movements.length} records
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="tc-table w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                    <th className="px-6 py-3 font-black">Type</th>
                                    <th className="px-6 py-3 font-black text-right">Qty Change</th>
                                    <th className="px-6 py-3 font-black">Reference</th>
                                    <th className="px-6 py-3 font-black">User</th>
                                    <th className="px-6 py-3 font-black">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {movements.length === 0 ? (
                                    <tr>
                                        <td
                                            className="px-6 py-8 text-sm text-slate-500"
                                            colSpan={5}
                                        >
                                            No stock movements found for this medicine.
                                        </td>
                                    </tr>
                                ) : (
                                    movements.map((movement) => (
                                        <tr key={movement.id}>
                                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                                                {toLabel(
                                                    movement.movement_subtype ||
                                                        movement.movement_type,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black">
                                                <span
                                                    className={
                                                        Number(movement.quantity_delta || 0) >= 0
                                                            ? 'text-emerald-600'
                                                            : 'text-rose-600'
                                                    }
                                                >
                                                    {Number(movement.quantity_delta || 0) >= 0
                                                        ? '+'
                                                        : ''}
                                                    {Number(
                                                        movement.quantity_delta || 0,
                                                    ).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {movement.reference || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {movement.user_name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {movement.created_at
                                                    ? formatLocalDateTime(movement.created_at)
                                                    : 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AlertCard
                        title="Near Expiry Batches"
                        status={alertSummary.nearExpiry.length > 0 ? 'warning' : 'safe'}
                        value={alertSummary.nearExpiry.length}
                        details={`Within ${RISK_SOON_DAYS} days`}
                    />
                    <AlertCard
                        title="Low Stock Warning"
                        status={alertSummary.isLowStock ? 'critical' : 'safe'}
                        value={stockSummary.totalStock}
                        details={`Reorder point: ${alertSummary.reorderPoint.toLocaleString()}`}
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {label}
            </p>
            <p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{value}</p>
        </div>
    );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {label}
                </p>
                <span className="text-slate-400">{icon}</span>
            </div>
            <p className="mt-2 text-2xl font-black text-healthcare-dark dark:text-white">
                {value.toLocaleString()}
            </p>
        </div>
    );
}

function AlertCard({
    title,
    status,
    value,
    details,
}: {
    title: string;
    status: 'safe' | 'warning' | 'critical';
    value: number;
    details: string;
}) {
    return (
        <div
            className={`rounded-2xl border p-4 ${
                status === 'critical'
                    ? 'border-rose-200 bg-rose-50'
                    : status === 'warning'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
            }`}
        >
            <div className="flex items-start justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {title}
                </h4>
                <AlertTriangle
                    size={16}
                    className={
                        status === 'critical'
                            ? 'text-rose-600'
                            : status === 'warning'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                    }
                />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-800">{value.toLocaleString()}</p>
            <p className="text-xs font-bold text-slate-500 mt-1">{details}</p>
        </div>
    );
}

export default MedicineDetailsPage;
