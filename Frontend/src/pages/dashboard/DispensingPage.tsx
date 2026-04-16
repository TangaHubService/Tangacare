import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, CheckCircle2, User, ChevronDown, ChevronUp, X, Download, ArrowLeft, Mail } from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Medicine, Batch, Stock } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { SkeletonTable } from '../../components/ui/SkeletonTable';
import { CreatePatientModal } from '../../components/patients/CreatePatientModal';
import { MedicineCard } from '../../components/dispensing/MedicineCard';
import { DispensingCart } from '../../components/dispensing/DispensingCart';
import { PaymentModal } from '../../components/dispensing/PaymentModal';
import { PatientSummaryPanel } from '../../components/dispensing/PatientSummaryPanel';
import type { CartItem } from '../../types/pharmacy';
import { toast } from 'react-hot-toast';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { db } from '../../lib/indexeddb';
import { toSentenceCase } from '../../lib/text';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useRuntimeConfig } from '../../context/RuntimeConfigContext';
import { cn } from '../../lib/utils';
import { formatLocalDate, parseLocalDate } from '../../lib/date';

const WALK_IN_PATIENT = {
    id: null,
    first_name: 'Walk-in',
    last_name: 'Customer',
    phone_number: 'N/A',
    email: null,
    is_walk_in: true,
};

interface SubstitutionAlternative {
    id: number;
    name: string;
    selling_price: number;
    total_stock: number;
    reason: string;
}

interface SuccessSummary {
    amount: number;
    saleId: number | string;
    paymentMethod: string;
    date: Date;
    facilityName: string;
    customerEmail?: string | null;
}

export function DispensingPage() {
    const { user, currentFacility } = useAuth();
    const { isOnline, queueCount } = useOfflineSync();
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 500);
    const medicineSearchInputRef = useRef<HTMLInputElement>(null);
    const [hasMore, setHasMore] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [patientQuery, setPatientQuery] = useState('');
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<any | null>(WALK_IN_PATIENT);
    const [showSuccess, setShowSuccess] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [showCreatePatient, setShowCreatePatient] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [prescriptionId, setPrescriptionId] = useState('');
    const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);
    const [downloadingReceipt, setDownloadingReceipt] = useState(false);
    const [substitutionLoadingMedicineId, setSubstitutionLoadingMedicineId] = useState<
        number | null
    >(null);
    const [substitutionContext, setSubstitutionContext] = useState<{
        medicine: Medicine;
        alternatives: SubstitutionAlternative[];
    } | null>(null);
    const shownExpiryWarningsRef = useRef<Set<number>>(new Set());
    const cartPanelRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
    );
    const [isCartExpandedOnMobile, setIsCartExpandedOnMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const onChange = () => setIsMobile(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const scrollToCart = () => {
        setIsCartExpandedOnMobile(true);
        if (!isMobile) {
            cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        if (!isMobile || !isCartExpandedOnMobile) return;
        const id = setTimeout(() => {
            cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return () => clearTimeout(id);
    }, [isMobile, isCartExpandedOnMobile]);

    const handleDownloadReceipt = async () => {
        if (!successSummary || typeof successSummary.saleId !== 'number' || !user?.facility_id) return;
        setDownloadingReceipt(true);
        try {
            await pharmacyService.getSaleReceipt(successSummary.saleId, user.facility_id);
            toast.success('Receipt downloaded');
        } catch (err: any) {
            const message = err?.message || 'Failed to download receipt';
            toast.error(message);
        } finally {
            setDownloadingReceipt(false);
        }
    };

    const { formatMoney, vatRate } = useRuntimeConfig();

    const isReadOnly = user?.role?.toString()?.toLowerCase() === 'auditor';
    const hasControlledDrug = cart.some((item) => item.is_controlled_drug);

    const getApiErrorMessage = (error: any): string => {
        return (
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            'Checkout failed. Please try again.'
        );
    };

    const getAvailableQuantity = (
        stock: Stock & { reserved_quantity?: number; is_frozen?: boolean },
    ): number => {
        const quantity = Number(stock.quantity || 0);
        const reserved = Number(stock.reserved_quantity || 0);
        return Math.max(0, quantity - reserved);
    };

    const getDispensableStocks = async (
        medicineId: number,
    ): Promise<Array<Stock & { reserved_quantity?: number; is_frozen?: boolean }>> => {
        const stockResponse = await pharmacyService.getStock({
            medicine_id: medicineId,
            ...(user?.facility_id ? { facility_id: user.facility_id } : {}),
            page: 1,
            limit: 100,
        });
        const now = new Date();

        return (stockResponse.data || [])
            .filter((stock) => {
                const candidate = stock as Stock & {
                    reserved_quantity?: number;
                    is_frozen?: boolean;
                };
                if (candidate.is_frozen) return false;
                if (!candidate.batch?.expiry_date) return false;
                const expiry = parseLocalDate(candidate.batch.expiry_date);
                if (Number.isNaN(expiry.getTime()) || expiry <= now) return false;
                return getAvailableQuantity(candidate) > 0;
            })
            .sort(
                (a, b) =>
                    parseLocalDate(a.batch!.expiry_date).getTime() -
                    parseLocalDate(b.batch!.expiry_date).getTime(),
            );
    };

    const resolveFefoPreferredStock = (
        stocks: Array<Stock & { reserved_quantity?: number; is_frozen?: boolean }>,
    ) => {
        if (!stocks.length) return undefined;
        const firstExpiryTs = parseLocalDate(stocks[0].batch!.expiry_date).getTime();
        const sameEarliestExpiry = stocks.filter(
            (stock) => parseLocalDate(stock.batch!.expiry_date).getTime() === firstExpiryTs,
        );
        return sameEarliestExpiry.find((stock) => !!stock.location?.name) || sameEarliestExpiry[0];
    };

    const getFefoViolationMessage = (
        stocks: Array<Stock & { reserved_quantity?: number; is_frozen?: boolean }>,
        selectedBatchId: number,
        requestedQty: number,
    ): string | null => {
        const earliestStock = stocks[0];
        const selectedStock = stocks.find(
            (stock) => Number(stock.batch?.id) === Number(selectedBatchId),
        );
        if (!earliestStock || !selectedStock || !earliestStock.batch || !selectedStock.batch)
            return null;

        if (Number(earliestStock.batch.id) === Number(selectedStock.batch.id)) return null;

        const earliestExpiryTs = parseLocalDate(earliestStock.batch.expiry_date).getTime();
        const selectedExpiryTs = parseLocalDate(selectedStock.batch.expiry_date).getTime();
        if (!Number.isFinite(earliestExpiryTs) || !Number.isFinite(selectedExpiryTs)) return null;
        if (earliestExpiryTs >= selectedExpiryTs) return null;

        if (getAvailableQuantity(earliestStock) >= requestedQty) {
            return `FEFO rule: use batch ${earliestStock.batch.batch_number} (earlier expiry) before ${selectedStock.batch.batch_number}`;
        }

        return null;
    };

    useEffect(() => {
        setPage(1);
        setHasMore(true);
    }, [debouncedSearch]);

    const fetchMedicines = async () => {
        if (page === 1) setLoading(true);

        try {
            const response = await pharmacyService.getMedicines({
                page,
                limit: 20,
                search: debouncedSearch,
                ...(user?.facility_id ? { facility_id: user.facility_id } : {}),
                sort_by: 'expiry_date',
                min_stock: 1,
            });

            setMedicines((prev) => {
                if (page === 1) return response.data;
                const newIds = new Set(response.data.map((m) => m.id));
                return [...prev.filter((m) => !newIds.has(m.id)), ...response.data];
            });

            setHasMore(response.meta.page < response.meta.totalPages);
        } catch (error) {
            console.error('Failed to fetch medicines:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleScroll = () => {
        if (!scrollContainerRef.current || loading || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            setPage((prev) => prev + 1);
        }
    };

    const [showPatientResults, setShowPatientResults] = useState(false);
    const patientSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                patientSearchRef.current &&
                !patientSearchRef.current.contains(event.target as Node)
            ) {
                setShowPatientResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchPatients = async () => {
            try {
                const params = patientQuery ? { search: patientQuery } : { limit: 10 };
                const results = await pharmacyService.getPatients(params);
                const fetchedPatients = results.data || [];

                // Always include Walk-in in results if query is empty or matches
                const showWalkIn = !patientQuery || 'walk-in'.includes(patientQuery.toLowerCase());
                setPatients(showWalkIn ? [WALK_IN_PATIENT, ...fetchedPatients] : fetchedPatients);
            } catch (err) {
                console.warn('Patient API not reachable, mocking results');
                setPatients([]);
            }
        };
        const timer = setTimeout(searchPatients, 300);
        return () => clearTimeout(timer);
    }, [patientQuery]);

    useEffect(() => {
        fetchMedicines();
    }, [debouncedSearch, page]);

    useBarcodeScanner(
        (barcode) => {
            const activeElement = document.activeElement as HTMLElement | null;
            const activeTag = activeElement?.tagName;
            const isTextInput =
                activeTag === 'INPUT' ||
                activeTag === 'TEXTAREA' ||
                activeElement?.getAttribute('contenteditable') === 'true';
            const isMedicineSearchFocused = activeElement === medicineSearchInputRef.current;

            if (isTextInput && !isMedicineSearchFocused) {
                return;
            }

            setSearchQuery(barcode);
            setPage(1);
            setHasMore(true);
            medicineSearchInputRef.current?.focus();
            toast.success(`Scanned barcode: ${barcode}`, { duration: 1200 });
        },
        {
            enabled: !showPaymentModal && !showCreatePatient,
            minLength: 4,
            scanTimeoutMs: 60,
        },
    );

    const addToCart = async (med: Medicine) => {
        if (isReadOnly) return;
        if ((med.stock_quantity || 0) <= 0) {
            toast.error('Out of stock');
            return;
        }

        let bestBatch: Batch | undefined;
        let bestBatchAvailableQty = 0;
        try {
            const dispensableStocks = await getDispensableStocks(med.id);
            const bestStock = resolveFefoPreferredStock(dispensableStocks);

            if (bestStock?.batch) {
                bestBatchAvailableQty = getAvailableQuantity(bestStock);
                const violation = getFefoViolationMessage(dispensableStocks, bestStock.batch.id, 1);
                if (violation) {
                    toast.error(violation, { duration: 7000 });
                    return;
                }

                const existingFefoViolation = cart
                    .filter((item) => item.id === med.id && !!item.selectedBatch?.id)
                    .map((item) =>
                        getFefoViolationMessage(
                            dispensableStocks,
                            Number(item.selectedBatch!.id),
                            Number(item.quantity || 0),
                        ),
                    )
                    .find(Boolean);
                if (existingFefoViolation) {
                    toast.error(existingFefoViolation, { duration: 7000 });
                    return;
                }

                bestBatch = {
                    ...bestStock.batch,
                    stock_id: bestStock.id,
                    current_quantity: bestBatchAvailableQty,
                    location_id: bestStock.location?.id ?? bestStock.location_id ?? null,
                    location: bestStock.location || null,
                };
            }
        } catch (err) {
            console.error('Failed to fetch stock details', err);
            const message = getApiErrorMessage(err);
            toast.error(message, {
                duration: message.toLowerCase().includes('fefo') ? 7000 : 4000,
            });
            return;
        }

        if (!bestBatch) {
            toast.error('No active batches found for this medicine');
            return;
        }

        setCart((prev) => {
            const isSameCartLine = (item: CartItem) =>
                item.id === med.id &&
                (bestBatch?.stock_id && item.selectedBatch?.stock_id
                    ? Number(item.selectedBatch.stock_id) === Number(bestBatch.stock_id)
                    : item.selectedBatch?.id === bestBatch?.id);

            const existing = prev.find((item) => isSameCartLine(item));
            if (existing) {
                if (existing.quantity >= bestBatchAvailableQty) {
                    toast.error(`Batch ${bestBatch!.batch_number} stock limit reached`);
                    return prev;
                }
                return prev.map((item) =>
                    isSameCartLine(item) ? { ...item, quantity: item.quantity + 1 } : item,
                );
            }
            const sellingPrice = Number(med.selling_price || 0);
            return [
                ...prev,
                {
                    ...med,
                    selling_price: sellingPrice,
                    quantity: 1,
                    selectedBatch: bestBatch,
                },
            ];
        });

        // FEFO Prompt & Expiry Warning (use local timezone for expiry date)
        const expiryDate = parseLocalDate(bestBatch.expiry_date);
        const daysToExpiry = Math.ceil(
            (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        );
        const locationName = toSentenceCase(bestBatch.location?.name || 'Main Shelf');

        if (daysToExpiry <= 30 && !shownExpiryWarningsRef.current.has(bestBatch.id)) {
            shownExpiryWarningsRef.current.add(bestBatch.id);
            toast(
                () => (
                    <div className="flex flex-col gap-1">
                        <span className="font-bold text-orange-600">⚠️ Batch Expiring Soon!</span>
                        <span className="text-xs">
                            {med.name} • Batch {bestBatch!.batch_number} • {locationName}
                        </span>
                    </div>
                ),
                { duration: 3500, icon: '⚠️' },
            );
        }
    };

    const handleFindAlternatives = async (medicine: Medicine) => {
        const activeFacilityId = user?.facility_id;
        if (!activeFacilityId) {
            toast.error('No facility selected for your account');
            return;
        }

        setSubstitutionLoadingMedicineId(medicine.id);
        try {
            const alternatives = await pharmacyService.getSubstitutionRecommendations(
                medicine.id,
                activeFacilityId,
            );
            if (!alternatives.length) {
                toast('No substitution candidates with stock found.', { icon: 'ℹ️' });
                return;
            }
            setSubstitutionContext({
                medicine,
                alternatives,
            });
        } catch (error) {
            console.error('Failed to load substitution recommendations:', error);
            toast.error('Failed to load substitution recommendations');
        } finally {
            setSubstitutionLoadingMedicineId(null);
        }
    };

    const useAlternative = async (alternative: SubstitutionAlternative) => {
        if (isReadOnly) return;
        try {
            const existingMedicine = medicines.find((medicine) => medicine.id === alternative.id);
            if (existingMedicine) {
                await addToCart(existingMedicine);
                setSubstitutionContext(null);
                return;
            }

            const medicine = await pharmacyService.getMedicine(alternative.id);
            await addToCart(medicine);
            setSubstitutionContext(null);
        } catch (error) {
            console.error('Failed to apply substitution:', error);
            toast.error('Could not add substitution medicine to cart');
        }
    };

    const updateQuantity = async (id: number, batchId: number, delta: number, stockId?: number) => {
        const isTargetLine = (item: CartItem) =>
            item.id === id &&
            (stockId && item.selectedBatch?.stock_id
                ? Number(item.selectedBatch.stock_id) === Number(stockId)
                : item.selectedBatch?.id === batchId);

        if (delta > 0) {
            const targetItem = cart.find((item) => isTargetLine(item));
            if (!targetItem?.selectedBatch) return;

            try {
                const dispensableStocks = await getDispensableStocks(id);
                const requestedQty = targetItem.quantity + delta;
                const violation = getFefoViolationMessage(dispensableStocks, batchId, requestedQty);
                if (violation) {
                    toast.error(violation, { duration: 7000 });
                    return;
                }

                const selectedStock =
                    (stockId
                        ? dispensableStocks.find((stock) => Number(stock.id) === Number(stockId))
                        : undefined) ||
                    dispensableStocks.find((stock) => Number(stock.batch?.id) === Number(batchId));
                if (!selectedStock?.batch) {
                    toast.error(
                        `Batch ${targetItem.selectedBatch.batch_number} is no longer available`,
                    );
                    return;
                }

                const availableQty = getAvailableQuantity(selectedStock);
                if (requestedQty > availableQty) {
                    toast.error(`Cannot exceed batch stock (${availableQty})`);
                    return;
                }

                setCart((prev) =>
                    prev.map((item) =>
                        isTargetLine(item)
                            ? {
                                  ...item,
                                  quantity: requestedQty,
                                  selectedBatch: {
                                      ...item.selectedBatch!,
                                      stock_id: selectedStock.id,
                                      current_quantity: availableQty,
                                  },
                              }
                            : item,
                    ),
                );
                return;
            } catch (error) {
                console.error('Failed to validate stock details:', error);
                const message = getApiErrorMessage(error);
                toast.error(message, {
                    duration: message.toLowerCase().includes('fefo') ? 7000 : 4000,
                });
                return;
            }
        }

        setCart((prev) =>
            prev.map((item) => {
                if (isTargetLine(item)) {
                    return { ...item, quantity: Math.max(1, item.quantity + delta) };
                }
                return item;
            }),
        );
    };

    const removeFromCart = (id: number, batchId: number, stockId?: number) => {
        setCart((prev) =>
            prev.filter(
                (item) =>
                    !(
                        item.id === id &&
                        (stockId && item.selectedBatch?.stock_id
                            ? Number(item.selectedBatch.stock_id) === Number(stockId)
                            : item.selectedBatch?.id === batchId)
                    ),
            ),
        );
    };

    const subtotal = cart.reduce((acc, item) => acc + item.selling_price * item.quantity, 0);
    const tax = subtotal * vatRate;
    const total = subtotal + tax;
    const cartTotalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleCheckout = () => {
        if (!user?.facility_id) {
            toast.error('No facility selected for your account');
            return;
        }
        if (!selectedPatient) {
            toast.error('Please select a patient first');
            return;
        }
        if (cart.length === 0) return;

        const belowCostItem = cart.find(
            (item) =>
                !!item.selectedBatch &&
                Number(item.selling_price || 0) < Number(item.selectedBatch.unit_cost || 0),
        );
        if (belowCostItem) {
            toast.error(
                `Selling price for ${belowCostItem.name} is below cost. Update medicine pricing first.`,
            );
            return;
        }

        setShowPaymentModal(true);
    };

    const handlePaymentConfirm = async (
        payments: any[],
        patientIdType?: string,
        patientIdNumber?: string,
        insuranceProviderId?: number,
        patientInsuranceNumber?: string,
    ) => {
        setProcessing(true);
        const saleData: any = {
            patient_id: selectedPatient.id,
            dispense_type: 'otc' as const,
            vat_rate: vatRate,
            items: cart
                .filter((i) => !!i.selectedBatch)
                .map((i) => ({
                    medicine_id: i.id,
                    batch_id: i.selectedBatch!.id,
                    stock_id: i.selectedBatch?.stock_id,
                    quantity: i.quantity,
                    unit_price: i.selling_price,
                })),
            payments: payments,
            patient_id_type: patientIdType,
            patient_id_number: patientIdNumber,
            insurance_provider_id: insuranceProviderId,
            patient_insurance_number: patientInsuranceNumber,
            ...(hasControlledDrug && prescriptionId
                ? { prescription_id: parseInt(prescriptionId) || undefined }
                : {}),
        };

        try {
            if (!isOnline) {
                const offlineId = `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await db.saleQueue.add({
                    ...saleData,
                    offlineId,
                    createdAt: new Date().toISOString(),
                    status: 'pending',
                    retryCount: 0,
                });
                toast.success('Offline: Sale queued for sync');
                setCart([]);
                setShowPaymentModal(false);
                setSuccessSummary({
                    amount: total,
                    saleId: 'Pending sync',
                    paymentMethod: payments[0]?.method ? String(payments[0].method).replace(/_/g, ' ') : 'Cash',
                    date: new Date(),
                    facilityName: currentFacility?.name ?? 'Pharmacy',
                    customerEmail: (selectedPatient as any)?.email ?? null,
                });
                setShowSuccess(true);
                return;
            }

            const { sale, warnings } = await pharmacyService.createSale(saleData);

            setSuccessSummary({
                amount: total,
                saleId: sale.id,
                paymentMethod: payments[0]?.method ? String(payments[0].method).replace(/_/g, ' ') : 'Cash',
                date: new Date(),
                facilityName: currentFacility?.name ?? 'Pharmacy',
                customerEmail: selectedPatient?.email ?? (selectedPatient as any)?.email ?? null,
            });
            setShowSuccess(true);
            toast.success('Sale completed successfully');
            if (warnings.length > 0) {
                for (const w of warnings) {
                    toast(w, { duration: 7500, icon: '⚠️' });
                }
            }
            setShowPaymentModal(false);
            // Success overlay stays open until user clicks "Return to Sell"
        } catch (error) {
            console.error('Checkout failed:', error);
            const message = getApiErrorMessage(error);
            toast.error(message, {
                duration: message.toLowerCase().includes('fefo') ? 7000 : 4000,
            });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <ProtectedRoute
            allowedRoles={[
                'admin',
                'pharmacist',
                'super_admin',
                'facility_admin',
                'auditor',
                'owner',
            ]}
            requireFacility
        >
            {!isOnline && (
                <div className="bg-amber-500 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest flex justify-between items-center animate-in slide-in-from-top duration-300">
                    <span>Offline Mode Active • Sales will sync automatically</span>
                    {queueCount > 0 && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full">
                            {queueCount} Pending
                        </span>
                    )}
                </div>
            )}
            <div className="flex h-full flex-col lg:flex-row p-3 sm:p-4 md:p-5 gap-4 md:gap-5 lg:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700 overflow-y-auto lg:overflow-hidden">
                {/* LEFT SIDE - Medicine Search and Cards (mobile: 2 cols, tablet: 3 cols, desktop: 2–3 cols) */}
                <div className="flex flex-col gap-4 md:gap-5 lg:gap-6 overflow-hidden min-h-0 lg:flex-1 lg:min-h-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-healthcare-dark dark:text-white tracking-tight">
                                Sell
                            </h2>
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                                POS — search or scan · FEFO batches · checkout
                            </p>
                        </div>
                        {/* Cart / Store indicator - click to show cart items list */}
                        <button
                            type="button"
                            onClick={scrollToCart}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-healthcare-primary/10 dark:bg-healthcare-primary/20 border-2 border-healthcare-primary/30 text-healthcare-primary hover:bg-healthcare-primary/20 dark:hover:bg-healthcare-primary/30 transition-colors font-bold text-sm shrink-0"
                        >
                            <ShoppingCart size={20} />
                            <span>Cart</span>
                            {cartTotalQuantity > 0 && (
                                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-healthcare-primary text-white text-xs font-black flex items-center justify-center">
                                    {cartTotalQuantity}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={20}
                        />
                        <input
                            ref={medicineSearchInputRef}
                            type="text"
                            placeholder="Search medicine by name, code, brand, or barcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-healthcare-primary transition-all text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                        />
                    </div>

                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 min-h-[200px] lg:min-h-0 overflow-y-auto custom-scrollbar pr-2 -mr-2"
                    >
                        {loading ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <SkeletonTable
                                        key={i}
                                        rows={2}
                                        columns={1}
                                        headers={null}
                                        animate
                                        className="border-none shadow-none"
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-4">
                                {medicines.map((med) => (
                                    <MedicineCard
                                        key={med.id}
                                        medicine={med}
                                        onAddToCart={addToCart}
                                        onFindAlternatives={handleFindAlternatives}
                                        isFindingAlternatives={
                                            substitutionLoadingMedicineId === med.id
                                        }
                                        readOnly={isReadOnly}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE - Hidden completely on mobile/tablet until user taps Cart; always visible on desktop (lg+) */}
                {(!isMobile || isCartExpandedOnMobile) && (
                <div
                    ref={cartPanelRef}
                    className="w-full md:max-w-md lg:w-[450px] flex-shrink-0 flex flex-col gap-4 md:gap-5 lg:gap-6 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl relative min-h-0"
                >
                    {/* On mobile/tablet: close button to hide panel completely */}
                    {isMobile && (
                        <div className="flex justify-end -mt-1 -mx-1">
                            <button
                                type="button"
                                onClick={() => setIsCartExpandedOnMobile(false)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm"
                                aria-label="Close cart"
                            >
                                <X size={18} />
                                Close
                            </button>
                        </div>
                    )}
                    {/* Patient Details Section */}
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-healthcare-dark dark:text-white font-black text-sm">
                            <div className="flex items-center gap-2">
                                <User size={16} />
                                <span>Patient Details</span>
                            </div>
                            {user?.role?.toString()?.toLowerCase() !== 'auditor' && (
                                <button
                                    onClick={() => setShowCreatePatient(true)}
                                    className="p-1 px-2 bg-healthcare-primary/10 hover:bg-healthcare-primary/20 text-healthcare-primary rounded text-xs transition-colors"
                                >
                                    + New
                                </button>
                            )}
                        </div>
                        {user?.role?.toString()?.toLowerCase() !== 'auditor' &&
                            (!selectedPatient || selectedPatient.is_walk_in) && (
                                <div className="relative" ref={patientSearchRef}>
                                    <input
                                        type="text"
                                        placeholder="Search or select patient..."
                                        value={patientQuery}
                                        onFocus={() => setShowPatientResults(true)}
                                        onClick={() => setShowPatientResults(true)}
                                        onChange={(e) => {
                                            setPatientQuery(e.target.value);
                                            setShowPatientResults(true);
                                        }}
                                        className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-healthcare-primary/20 outline-none pr-8 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                                    />
                                    <ChevronDown
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                    />
                                    {showPatientResults && (
                                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg shadow-lg mt-1 z-10 max-h-60 overflow-y-auto custom-scrollbar">
                                            {patients.length > 0 ? (
                                                patients.map((p, idx) => (
                                                    <div
                                                        key={p.id || `patient-${idx}`}
                                                        onClick={() => {
                                                            setSelectedPatient(p);
                                                            setPatientQuery('');
                                                            setShowPatientResults(false);
                                                        }}
                                                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-sm border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                                                    >
                                                        <div className="font-bold text-healthcare-dark dark:text-white">
                                                            {p.first_name ||
                                                                p.firstName ||
                                                                p.name ||
                                                                ''}{' '}
                                                            {p.last_name || p.lastName || ''}
                                                            {p.is_walk_in && (
                                                                <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-black uppercase">
                                                                    Default
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                                                            <span>
                                                                {p.phone_number ||
                                                                    p.phoneNumber ||
                                                                    p.phone ||
                                                                    '—'}
                                                            </span>
                                                            {p.email && (
                                                                <span className="text-slate-400">
                                                                    {p.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                                                    No patients found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        {(selectedPatient && !selectedPatient.is_walk_in) ||
                        user?.role?.toString()?.toLowerCase() === 'auditor' ? (
                            <div className="flex justify-between items-center bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg border dark:border-slate-700 text-sm">
                                <div>
                                    <div className="font-bold text-healthcare-dark dark:text-white">
                                        {selectedPatient && !selectedPatient.is_walk_in ? (
                                            <>
                                                {selectedPatient.first_name ||
                                                    selectedPatient.firstName ||
                                                    selectedPatient.name ||
                                                    ''}{' '}
                                                {selectedPatient.last_name ||
                                                    selectedPatient.lastName ||
                                                    ''}
                                            </>
                                        ) : (
                                            'No Patient Selected'
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-0.5">
                                        {selectedPatient && !selectedPatient.is_walk_in ? (
                                            <>
                                                <span>
                                                    {selectedPatient.phone_number ||
                                                        selectedPatient.phoneNumber ||
                                                        selectedPatient.phone ||
                                                        '—'}
                                                </span>
                                            </>
                                        ) : (
                                            <span>Patient info is unavailable in browse mode</span>
                                        )}
                                    </div>
                                </div>
                                {selectedPatient &&
                                    !selectedPatient.is_walk_in &&
                                    user?.role?.toString()?.toLowerCase() !== 'auditor' && (
                                        <button
                                            onClick={() => setSelectedPatient(WALK_IN_PATIENT)}
                                            className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                            </div>
                        ) : null}
                    </div>

                    {selectedPatient && !selectedPatient.is_walk_in && (
                        <PatientSummaryPanel
                            patient={{
                                id: Number(selectedPatient.id),
                                name: `${selectedPatient.first_name || selectedPatient.firstName || selectedPatient.name || ''} ${selectedPatient.last_name || selectedPatient.lastName || ''}`.trim(),
                                id_type: selectedPatient.id_type,
                                id_number: selectedPatient.id_number,
                                phone:
                                    selectedPatient.phone_number ||
                                    selectedPatient.phoneNumber ||
                                    selectedPatient.phone,
                                insurance_provider:
                                    selectedPatient.insurance_provider || selectedPatient.insurance,
                            }}
                            onDownloadReceipt={(saleId) => {
                                if (user?.facility_id) {
                                    pharmacyService.getSaleReceipt(saleId, user.facility_id);
                                }
                            }}
                        />
                    )}

                    {/* Cart Header - on mobile, click to expand and show cart items list */}
                    <button
                        type="button"
                        onClick={() => isMobile && setIsCartExpandedOnMobile((v) => !v)}
                        className={cn(
                            'w-full flex items-center justify-between text-left rounded-xl transition-colors',
                            isMobile && 'hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 p-1 -m-1',
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-healthcare-primary/10 flex items-center justify-center text-healthcare-primary border border-healthcare-primary/20">
                                <ShoppingCart size={18} />
                            </div>
                            <h3 className="font-black text-healthcare-dark dark:text-white">
                                Current Cart
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 uppercase">
                                {cartTotalQuantity} Item{cartTotalQuantity !== 1 ? 's' : ''}
                            </span>
                            {isMobile && (
                                <span className="text-slate-400">
                                    {isCartExpandedOnMobile ? (
                                        <ChevronUp size={20} />
                                    ) : (
                                        <ChevronDown size={20} />
                                    )}
                                </span>
                            )}
                        </div>
                    </button>

                    {/* Cart Items - on mobile/tablet hidden completely until card is clicked; click again to hide */}
                    {(isMobile ? isCartExpandedOnMobile : true) ? (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <DispensingCart
                            cart={cart}
                            updateQuantity={updateQuantity}
                            removeFromCart={removeFromCart}
                            subtotal={subtotal}
                            tax={tax}
                            total={total}
                            onCheckout={handleCheckout}
                            isProcessing={processing}
                            prescriptionId={prescriptionId}
                            setPrescriptionId={setPrescriptionId}
                            prescriptionRequired={hasControlledDrug}
                            readOnly={isReadOnly}
                        />
                    </div>
                    ) : null}
                </div>
                )}

            </div>

            {/* Success Overlay - Payment/Sale success (fixed so it shows on mobile too); green icons */}
            {showSuccess && successSummary && (
                <div className="fixed inset-0 z-50 bg-slate-200/90 dark:bg-slate-950/90 flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 animate-in fade-in duration-300">
                        {/* Green success icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center ring-4 ring-emerald-200/50 dark:ring-emerald-800/30">
                                <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <CheckCircle2 size={32} className="text-white" />
                                </div>
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-900 dark:text-white tracking-tight">
                            Payment Successful!
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                            Your payment has been processed successfully. Receipt is ready to download.
                        </p>
                        {/* Payment summary */}
                        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Amount</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                    {formatMoney(successSummary.amount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-500 dark:text-slate-400">Transaction ID</span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-mono text-xs">
                                    {typeof successSummary.saleId === 'number' ? `SALE-${String(successSummary.saleId).padStart(6, '0')}` : successSummary.saleId}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Payment Method</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                                    {successSummary.paymentMethod.replace(/_/g, ' ')}
                                </span>
                            </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Date</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {formatLocalDate(successSummary.date)}
                                        </span>
                                    </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Merchant</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {successSummary.facilityName}
                                </span>
                            </div>
                        </div>
                        {/* Receipt email */}
                        {successSummary.customerEmail && (
                            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40">
                                <Mail size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-sm text-emerald-800 dark:text-emerald-200">
                                    Receipt sent to {successSummary.customerEmail}
                                </span>
                            </div>
                        )}
                        {/* Actions */}
                        <div className="mt-6 flex flex-col gap-3">
                            {typeof successSummary.saleId === 'number' && user?.facility_id && (
                                <button
                                    type="button"
                                    onClick={handleDownloadReceipt}
                                    disabled={downloadingReceipt}
                                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    <Download size={20} className="text-white shrink-0" />
                                    {downloadingReceipt ? 'Downloading…' : 'Download Receipt'}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setShowSuccess(false);
                                    setSuccessSummary(null);
                                    setIsCartExpandedOnMobile(false);
                                    setCart([]);
                                    setSearchQuery('');
                                    setPatientQuery('');
                                    setPrescriptionId('');
                                    setSelectedPatient(WALK_IN_PATIENT);
                                    fetchMedicines();
                                }}
                                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
                            >
                                <ArrowLeft size={20} className="text-emerald-600 dark:text-emerald-400" />
                                Return to Sell
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {substitutionContext && (
                <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                                    Substitution Options
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Alternatives for{' '}
                                    <span className="font-bold">
                                        {substitutionContext.medicine.name}
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={() => setSubstitutionContext(null)}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="max-h-[420px] overflow-auto">
                            <table className="tc-table w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                                    <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                                        <th className="px-4 py-3 text-left font-black">Medicine</th>
                                        <th className="px-4 py-3 text-right font-black">Stock</th>
                                        <th className="px-4 py-3 text-right font-black">Price</th>
                                        <th className="px-4 py-3 text-left font-black">Reason</th>
                                        <th className="px-4 py-3 text-right font-black">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {substitutionContext.alternatives.map((alternative) => (
                                        <tr key={alternative.id}>
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                                                {alternative.name}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-300">
                                                {alternative.total_stock.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-300">
                                                {formatMoney(alternative.selling_price)}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {alternative.reason}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => useAlternative(alternative)}
                                                    className="px-3 py-1.5 rounded-lg bg-healthcare-primary text-white text-[10px] font-black uppercase tracking-wider hover:bg-teal-700 transition-colors"
                                                >
                                                    Use
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Patient Modal */}
            {showCreatePatient && (
                <CreatePatientModal
                    onClose={() => setShowCreatePatient(false)}
                    onCreate={(patient) => {
                        setSelectedPatient(patient);
                        setShowCreatePatient(false);
                    }}
                />
            )}

            {showPaymentModal && (
                <PaymentModal
                    totalAmount={total}
                    hasControlledDrugs={hasControlledDrug}
                    onClose={() => setShowPaymentModal(false)}
                    onConfirm={handlePaymentConfirm}
                    isProcessing={processing}
                />
            )}
        </ProtectedRoute>
    );
}
