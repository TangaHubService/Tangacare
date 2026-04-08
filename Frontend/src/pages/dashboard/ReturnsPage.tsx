import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { CreateReturnModal } from '../../components/pharmacy/returns/CreateReturnModal';
import { ReturnManagement } from '../../components/pharmacy/returns/ReturnManagement';
import { useAuth } from '../../context/AuthContext';
import { parseLocalDate } from '../../lib/date';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Sale } from '../../types/pharmacy';

export function ReturnsPage() {
    const { user, facilityId } = useAuth();
    const effectiveFacilityId = facilityId ?? user?.facility_id;
    const [saleSearch, setSaleSearch] = useState('');
    const deferredSaleSearch = useDeferredValue(saleSearch.trim());
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [loadingSaleId, setLoadingSaleId] = useState<number | null>(null);

    const saleSearchQuery = useQuery({
        queryKey: ['return-sale-search', deferredSaleSearch],
        queryFn: () =>
            pharmacyService.getSales({
                search: deferredSaleSearch,
                limit: 6,
                page: 1,
            }),
        enabled: Boolean(effectiveFacilityId && deferredSaleSearch.length >= 2),
    });

    const matchingSales = saleSearchQuery.data?.data ?? [];

    const handleSelectSale = async (saleId: number) => {
        setLoadingSaleId(saleId);
        try {
            const sale = await pharmacyService.getSale(saleId);
            setSelectedSale(sale);
        } finally {
            setLoadingSaleId(null);
        }
    };

    return (
        <ProtectedRoute
            allowedRoles={[
                'FACILITY_ADMIN',
                'FACILITY ADMIN',
                'SUPER_ADMIN',
                'SUPER ADMIN',
                'CASHIER',
                'PHARMACIST',
                'AUDITOR',
            ]}
            requireFacility
        >
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight text-healthcare-dark dark:text-white">
                            <RotateCcw size={22} className="text-healthcare-primary" />
                            Returns
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Start a customer return from the original sale and track approvals,
                            rejections, and refund completion in one place.
                        </p>
                    </div>
                </div>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                                Initiate Return
                            </p>
                            <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                                Find the original sale first
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                                Search by sale number or customer name, then open the return drawer
                                from the matching receipt.
                            </p>
                        </div>

                        <div className="relative w-full lg:max-w-md">
                            <Search
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                value={saleSearch}
                                onChange={(e) => setSaleSearch(e.target.value)}
                                placeholder="Search sale number or customer..."
                                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-healthcare-primary focus:ring-2 focus:ring-healthcare-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="mt-5">
                        {deferredSaleSearch.length < 2 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                                Type at least 2 characters to look up the original sale.
                            </div>
                        ) : saleSearchQuery.isLoading ? (
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                                <Loader2 size={16} className="animate-spin" />
                                Searching sales...
                            </div>
                        ) : matchingSales.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                                No matching sales found for that search.
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {matchingSales.map((sale) => {
                                    const patientName =
                                        [sale.patient?.first_name, sale.patient?.last_name]
                                            .filter(Boolean)
                                            .join(' ') || 'Walk-in customer';

                                    return (
                                        <div
                                            key={sale.id}
                                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                        Sale Number
                                                    </p>
                                                    <p className="mt-1 font-black text-healthcare-primary">
                                                        {sale.sale_number}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectSale(sale.id)}
                                                    disabled={loadingSaleId === sale.id}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-healthcare-primary px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {loadingSaleId === sale.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : null}
                                                    Start Return
                                                </button>
                                            </div>

                                            <div className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                    {patientName}
                                                </p>
                                                <p>
                                                    {format(parseLocalDate(sale.created_at), 'MMM dd, yyyy • HH:mm')}
                                                </p>
                                                <p className="font-bold text-slate-700 dark:text-slate-200">
                                                    RWF {Number(sale.total_amount || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {effectiveFacilityId ? (
                    <ReturnManagement facilityId={effectiveFacilityId} />
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                        Facility context is required to manage returns.
                    </div>
                )}

                {selectedSale && (
                    <CreateReturnModal
                        sale={selectedSale}
                        onClose={() => setSelectedSale(null)}
                        onSuccess={() => {
                            setSelectedSale(null);
                            setSaleSearch('');
                        }}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
