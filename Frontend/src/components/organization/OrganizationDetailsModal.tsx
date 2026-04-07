import { MapPin, Phone, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Organization, Facility } from '../../types/pharmacy';
import { pharmacyService } from '../../services/pharmacy.service';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin } from '../../types/auth';
import { adminBillingService } from '../../services/admin-billing.service';
import { Drawer } from '../ui/Drawer';

interface OrganizationDetailsModalProps {
    organization: Organization;
    onClose: () => void;
}

export function OrganizationDetailsModal({ organization, onClose }: OrganizationDetailsModalProps) {
    const { user } = useAuth();
    const isSuperAdminUser = isSuperAdmin(user?.role);
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [billingLoading, setBillingLoading] = useState(false);
    const [billingData, setBillingData] = useState<any>(null);

    useEffect(() => {
        const loadFacilities = async () => {
            setIsLoading(true);
            try {
                const response = await pharmacyService.getFacilities({
                    limit: 100,

                    organization_id: organization.id,
                });
                setFacilities(response.data || []);
            } catch (error) {
                console.error('Failed to load facilities for organization', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (organization.id) {
            loadFacilities();
        }
    }, [organization.id]);

    useEffect(() => {
        const loadBilling = async () => {
            if (!organization.id || !isSuperAdminUser) return;
            setBillingLoading(true);
            try {
                const result = await adminBillingService.getCustomerByOrganizationId(organization.id);
                setBillingData(result);
            } catch (error) {
                console.error('Failed to load organization billing performance', error);
                setBillingData(null);
            } finally {
                setBillingLoading(false);
            }
        };

        void loadBilling();
    }, [organization.id, isSuperAdminUser]);

    const formatRwf = (value: any) => `RWF ${Number(value || 0).toLocaleString()}`;
    const payments = billingData?.payments || [];
    const successfulPayments = payments.filter((p: any) => p.status === 'success');
    const failedPaymentsCount = payments.filter((p: any) => p.status === 'failed').length;

    const totalRevenue = successfulPayments.reduce((acc: number, p: any) => acc + (p.amount_rwf || 0), 0);
    const revenueThisMonth = (() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return successfulPayments.reduce((acc: number, p: any) => {
            const paidAt = p.paid_at ? new Date(p.paid_at).getTime() : null;
            return paidAt && paidAt >= start ? acc + (p.amount_rwf || 0) : acc;
        }, 0);
    })();

    const planName =
        billingData?.subscription?.subscription_plan?.name ??
        billingData?.subscription?.subscription_plan?.plan_code ??
        null;
    const subscriptionStatus = billingData?.subscription?.status ?? null;
    const nextBillingAt = billingData?.subscription?.next_billing_at ?? null;
    const pendingPlanChange = billingData?.pendingPlanChange ?? null;

    return (
        <Drawer
            isOpen
            onClose={onClose}
            size="xl"
            title={organization.name}
            subtitle={`CODE: ${organization.code || 'N/A'}`}
            showOverlay
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Type
                            </span>
                            <span className="font-semibold text-healthcare-dark capitalize">
                                {(organization.type || '').replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Status
                            </span>
                            <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${organization.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                            >
                                {organization.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        {organization.legal_name && (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 md:col-span-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                    Legal name
                                </span>
                                <span className="font-semibold text-healthcare-dark">{organization.legal_name}</span>
                            </div>
                        )}
                        {(organization.tax_registration_number || organization.business_license_number) && (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 md:col-span-2 flex flex-wrap gap-4">
                                {organization.tax_registration_number && (
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            Tax registration
                                        </span>
                                        <span className="font-semibold text-healthcare-dark font-mono text-sm">
                                            {organization.tax_registration_number}
                                        </span>
                                    </div>
                                )}
                                {organization.business_license_number && (
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            Business license
                                        </span>
                                        <span className="font-semibold text-healthcare-dark font-mono text-sm">
                                            {organization.business_license_number}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {isSuperAdminUser && (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 md:col-span-2">
                                <h3 className="text-sm font-black text-healthcare-dark uppercase tracking-wider mb-3">
                                    Organization Performance
                                </h3>
                                {billingLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <span className="inline-block w-4 h-4 border-2 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin" />
                                        Loading...
                                    </div>
                                ) : !billingData?.subscription ? (
                                    <p className="text-sm text-slate-500">No subscription data.</p>
                                ) : (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500">Plan</span>
                                            <span className="font-bold">{planName || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500">Status</span>
                                            <span className="font-bold">{subscriptionStatus || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500">Next billing</span>
                                            <span className="font-bold">
                                                {nextBillingAt ? new Date(nextBillingAt).toLocaleDateString() : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500">Revenue (this month)</span>
                                            <span className="font-bold">{formatRwf(revenueThisMonth)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500">Total successful revenue</span>
                                            <span className="font-bold">{formatRwf(totalRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500">Failed payments</span>
                                            <span className="font-bold">{failedPaymentsCount}</span>
                                        </div>

                                        {pendingPlanChange && (
                                            <div className="pt-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700">
                                                Pending change:{' '}
                                                <span className="font-bold">
                                                    {pendingPlanChange.from_plan?.plan_code || pendingPlanChange.from_plan?.name || '—'} →
                                                    {pendingPlanChange.to_plan?.plan_code || pendingPlanChange.to_plan?.name || '—'}
                                                </span>{' '}
                                                <span className="italic">
                                                    (
                                                    {pendingPlanChange.effective_date
                                                        ? new Date(pendingPlanChange.effective_date).toLocaleDateString()
                                                        : '—'}
                                                    )
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Settings editing removed */}

                    {}
                    <div>
                        <h3 className="text-sm font-black text-healthcare-dark uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MapPin size={16} className="text-healthcare-primary" />
                            Assigned Facilities ({facilities.length})
                        </h3>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-healthcare-primary/20 border-t-healthcare-primary rounded-full animate-spin"></div>
                            </div>
                        ) : facilities.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {facilities.map((facility) => (
                                    <div
                                        key={facility.id}
                                        className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-healthcare-primary/30 transition-all bg-white dark:bg-slate-800 shadow-sm"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0">
                                            <span className="text-lg">🏥</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-healthcare-dark text-sm">
                                                {facility.name}
                                            </h4>
                                            <p className="text-xs text-slate-500 capitalize mb-1">
                                                {(facility.type || '').replace(/_/g, ' ')}
                                            </p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                                                {facility.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone size={10} /> {facility.phone}
                                                    </span>
                                                )}
                                                {facility.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail size={10} /> {facility.email}
                                                    </span>
                                                )}
                                                {facility.address && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={10} /> {facility.address}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-slate-300">
                                            #{facility.id}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                                <p className="text-slate-500 text-sm">
                                    No facilities assigned to this organization.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Drawer>
    );
}
