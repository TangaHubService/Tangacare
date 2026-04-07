import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart2, Building2, CalendarClock, CreditCard, DollarSign, TrendingUp, Users } from 'lucide-react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { adminDashboardService } from '../../../services/admin-dashboard.service';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    BarChart,
    Bar,
    CartesianGrid,
} from 'recharts';

const cardClass = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';

function formatRwf(value: any) {
    return `RWF ${Number(value || 0).toLocaleString()}`;
}

export function BillingDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await adminDashboardService.getDashboard();
                setDashboard(res);
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Failed to load dashboard');
                setDashboard(null);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const monthlyRevenueTrend = useMemo(() => dashboard?.monthlyRevenueTrend ?? [], [dashboard]);
    const planDistribution = useMemo(() => dashboard?.planDistribution ?? [], [dashboard]);
    const recentFailedPayments = useMemo(() => dashboard?.recentFailedPayments ?? [], [dashboard]);
    const renewalsDueSoonSubscriptions = useMemo(
        () => dashboard?.renewalsDueSoonSubscriptions ?? [],
        [dashboard],
    );

    return (
        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SUPER ADMIN', 'super_admin']} requireFacility={false}>
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-black">Super Admin Dashboard</h1>
                    <p className="text-sm text-slate-500">Platform-wide revenue and subscription visibility.</p>
                </div>

                {loading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                ) : !dashboard ? (
                    <div className="text-sm text-slate-500">No dashboard data available.</div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <DollarSign size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Total Revenue</p>
                                        <p className="text-xl font-black">{formatRwf(dashboard?.totalRevenue)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <TrendingUp size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Revenue This Month</p>
                                        <p className="text-xl font-black">{formatRwf(dashboard?.revenueThisMonth)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <Users size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Active Subscriptions</p>
                                        <p className="text-xl font-black">{dashboard?.activeSubscriptions || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <CalendarClock size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Trials</p>
                                        <p className="text-xl font-black">{dashboard?.trialSubscriptions || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <BarChart2 size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Expired Subscriptions</p>
                                        <p className="text-xl font-black">{dashboard?.expiredSubscriptions || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <CreditCard size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Failed Payments</p>
                                        <p className="text-xl font-black">{dashboard?.failedPayments || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <Building2 size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Total Organizations</p>
                                        <p className="text-xl font-black">{dashboard?.totalOrganizations || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardClass}>
                                <div className="flex items-center gap-3">
                                    <CalendarClock size={18} className="text-healthcare-primary" />
                                    <div>
                                        <p className="text-xs text-slate-500">Renewals Due Soon</p>
                                        <p className="text-xl font-black">{dashboard?.renewalsDueSoon || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className={cardClass}>
                                <h2 className="font-black mb-3">Revenue Trend</h2>
                                {monthlyRevenueTrend.length === 0 ? (
                                    <p className="text-sm text-slate-500">No revenue trend data.</p>
                                ) : (
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={monthlyRevenueTrend}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis tickFormatter={(v) => formatRwf(v)} />
                                                <Tooltip formatter={(v: any) => formatRwf(v)} />
                                                <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                            <div className={cardClass}>
                                <h2 className="font-black mb-3">Plan Distribution</h2>
                                {planDistribution.length === 0 ? (
                                    <p className="text-sm text-slate-500">No plan distribution data.</p>
                                ) : (
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={planDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="plan" />
                                                <YAxis allowDecimals={false} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#22c55e" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className={cardClass}>
                                <h2 className="font-black mb-3">Recent Failed Payments</h2>
                                {recentFailedPayments.length === 0 ? (
                                    <p className="text-sm text-slate-500">No failed payments found.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800">
                                                <tr>
                                                    <th className="text-left p-3">Organization</th>
                                                    <th className="text-left p-3">Amount</th>
                                                    <th className="text-left p-3">Status</th>
                                                    <th className="text-left p-3">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentFailedPayments.map((p: any, idx: number) => (
                                                    <tr
                                                        key={`${p.organization}-${idx}`}
                                                        className="border-t border-slate-100 dark:border-slate-800"
                                                    >
                                                        <td className="p-3">{p.organization}</td>
                                                        <td className="p-3 font-bold">{formatRwf(p.amount)}</td>
                                                        <td className="p-3">{p.status}</td>
                                                        <td className="p-3">
                                                            {p.date ? new Date(p.date).toLocaleString() : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className={cardClass}>
                                <h2 className="font-black mb-3">Renewals Due Soon</h2>
                                {renewalsDueSoonSubscriptions.length === 0 ? (
                                    <p className="text-sm text-slate-500">No renewals due soon.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800">
                                                <tr>
                                                    <th className="text-left p-3">Organization</th>
                                                    <th className="text-left p-3">Plan</th>
                                                    <th className="text-left p-3">Next Billing</th>
                                                    <th className="text-left p-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {renewalsDueSoonSubscriptions.map((r: any, idx: number) => (
                                                    <tr
                                                        key={`${r.organization}-${idx}`}
                                                        className="border-t border-slate-100 dark:border-slate-800"
                                                    >
                                                        <td className="p-3">{r.organization}</td>
                                                        <td className="p-3">{r.plan}</td>
                                                        <td className="p-3">
                                                            {r.nextBillingDate
                                                                ? new Date(r.nextBillingDate).toLocaleString()
                                                                : '—'}
                                                        </td>
                                                        <td className="p-3">{r.status}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}

