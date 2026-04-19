import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyService } from '../../services/pharmacy.service';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { PERMISSIONS } from '../../types/auth';
import type { QualityCase } from '../../types/pharmacy';
import { format } from 'date-fns';
import { ClipboardList, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { QualityCaseCreateDrawer } from '../../components/quality/QualityCaseCreateDrawer';

export function QualityCasesPage() {
    const { facilityId, user, can } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id ?? null;
    const canCreate = can(PERMISSIONS.INVENTORY_WRITE);

    const [rows, setRows] = useState<QualityCase[]>([]);
    const [loading, setLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const loadCases = useCallback(async () => {
        setLoading(true);
        try {
            const res = await pharmacyService.listQualityCases({ page: 1, limit: 100 });
            const list = res.data || [];
            setRows(
                effectiveFacilityId
                    ? list.filter((r) => r.facility_id == null || r.facility_id === effectiveFacilityId)
                    : list,
            );
        } catch (e) {
            console.error(e);
            toast.error('Could not load quality cases.');
        } finally {
            setLoading(false);
        }
    }, [effectiveFacilityId]);

    useEffect(() => {
        void loadCases();
    }, [loadCases]);

    return (
        <ProtectedRoute requiredPermissions={[PERMISSIONS.INVENTORY_READ]} requireFacility>
            <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary shrink-0" />
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">Quality cases</h1>
                            <p className="text-sm text-muted-foreground">
                                Complaints, CAPA, and pharmacovigilance (ADR) log for pilot compliance.
                            </p>
                        </div>
                    </div>
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 sm:self-center"
                        >
                            <Plus className="h-4 w-4" />
                            New quality case
                        </button>
                    )}
                </div>

                <div className="rounded-lg border bg-card">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No quality cases recorded yet.
                            {canCreate && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setDrawerOpen(true)}
                                        className="text-primary font-medium hover:underline"
                                    >
                                        Record your first case
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b bg-muted/40">
                                    <tr>
                                        <th className="px-4 py-2">Reported</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Status</th>
                                        <th className="px-4 py-2">Title</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-b last:border-0">
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {format(new Date(r.reported_at), 'yyyy-MM-dd HH:mm')}
                                            </td>
                                            <td className="px-4 py-2 uppercase">{r.type}</td>
                                            <td className="px-4 py-2">{r.status}</td>
                                            <td className="px-4 py-2">{r.title}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {canCreate && (
                    <QualityCaseCreateDrawer
                        isOpen={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        onSuccess={() => void loadCases()}
                        facilityId={effectiveFacilityId}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
