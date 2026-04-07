import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    Plus,
    Filter,
    AlertCircle,
    Download,
    Pill,
    Upload,
    Loader2,
    CheckCircle2,
    XCircle,
    FileText,
    Copy,
    PackagePlus,
    Pencil,
    Eye,
    ShieldAlert,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import type { Medicine } from '../../types/pharmacy';
import { pharmacyService } from '../../services/pharmacy.service';
import { useDebounce } from '../../hooks/useDebounce';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../context/AuthContext';
import { StockTransferModal } from '../../components/inventory/StockTransferModal';
import { AddStockModal } from '../../components/inventory/AddStockModal';
import { toast } from 'react-hot-toast';
import { toSentenceCase } from '../../lib/text';
import { formatLocalDate, parseLocalDate } from '../../lib/date';
import { MedicineModal } from '../../components/inventory/MedicineModal';
import { Pagination } from '../../components/ui/Pagination';
import { TableToolbar } from '../../components/ui/table/TableToolbar';
import { useTableViewState, type TableViewColumn } from '../../hooks/useTableViewState';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const INVENTORY_TABLE_COLUMNS: TableViewColumn[] = [
    { key: 'select', label: 'Select', hideable: false },
    { key: 'medicine', label: 'Medicine', hideable: false },
    { key: 'category', label: 'Category' },
    { key: 'dosage_form', label: 'Dosage Form' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'stock', label: 'Current Stock' },
    { key: 'threshold', label: 'Min / Reorder' },
    { key: 'expiry', label: 'Expiry Risk' },
    { key: 'updated', label: 'Last Updated' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', hideable: false },
];

const INVENTORY_ROLE_DEFAULT_COLUMNS: Record<string, string[]> = {
    OWNER: [
        'medicine',
        'category',
        'supplier',
        'stock',
        'threshold',
        'expiry',
        'status',
        'actions',
    ],
    PHARMACIST: ['medicine', 'dosage_form', 'stock', 'threshold', 'expiry', 'status', 'actions'],
    STOREMANAGER: ['medicine', 'category', 'supplier', 'stock', 'threshold', 'status', 'actions'],
    AUDITOR: [
        'medicine',
        'category',
        'supplier',
        'stock',
        'threshold',
        'updated',
        'status',
        'actions',
    ],
};

const ALL_CATEGORIES_FILTER = 'All Categories';
const UNCATEGORIZED_FILTER = '__UNCATEGORIZED__';

type InventoryQuickPreset = 'all' | 'safety_risk' | 'controlled' | 'reorder_needed';

type InventorySort = 'name_asc' | 'name_desc' | 'stock_desc' | 'stock_asc' | 'updated_desc';

const MedicineImportPreviewModal = ({
    isOpen,
    onClose,
    onConfirm,
    items,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    items: any[];
    loading: boolean;
}) => {
    if (!isOpen) return null;

    const updates = items.filter((i) => i.is_update).length;
    const newItems = items.length - updates;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                {}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <FileText className="text-healthcare-primary" size={24} />
                            Preview Medicines Import
                        </h3>
                        <p className="text-sm text-slate-500 font-bold mt-1">
                            Review the {items.length} medicines before final confirmation.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <XCircle size={20} className="text-slate-400" />
                    </button>
                </div>

                {}
                <div className="flex-1 overflow-auto p-6">
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-healthcare-primary/5 rounded-xl p-4 border border-healthcare-primary/10">
                            <div className="text-[10px] font-black text-healthcare-primary uppercase tracking-wider">
                                New Medicines
                            </div>
                            <div className="text-2xl font-black text-healthcare-primary">
                                {newItems}
                            </div>
                        </div>
                        <div className="flex-1 bg-amber-500/5 rounded-xl p-4 border border-amber-500/10">
                            <div className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                                To Be Updated
                            </div>
                            <div className="text-2xl font-black text-amber-500">{updates}</div>
                        </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="tc-table w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                        Medicine Name
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                        Form
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {items.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-bold text-xs">
                                            {item.is_update ? (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px]">
                                                    Update
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px]">
                                                    New
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-xs text-slate-700 dark:text-slate-300">
                                            {item.code}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-black text-slate-900 dark:text-white">
                                            {item.name}
                                            {item.brand_name && (
                                                <span className="block text-[10px] font-bold text-slate-400">
                                                    {item.brand_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                            {toSentenceCase(item.dosage_form)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-black text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-2.5 bg-healthcare-primary text-white rounded-xl text-sm font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                Confirm Import
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export function InventoryPage() {
    const { user, facilityId } = useAuth();
    const navigate = useNavigate();
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES_FILTER);
    const [stockFilter, setStockFilter] = useState<
        'all' | 'low_stock' | 'out_of_stock' | 'expiring_soon'
    >('all');
    const [controlledFilter, setControlledFilter] = useState<
        'all' | 'controlled' | 'non_controlled'
    >('all');
    const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [limit, setLimit] = useState(10);
    const [selectedMedForTransfer, setSelectedMedForTransfer] = useState<Medicine | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [previewItems, setPreviewItems] = useState<any[]>([]);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [stats, setStats] = useState({
        totalItems: 0,
        totalCategories: 0,
        lowStock: 0,
        expired: 0,
    });
    const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
    const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);
    const [categories, setCategories] = useState<string[]>([
        ALL_CATEGORIES_FILTER,
        UNCATEGORIZED_FILTER,
    ]);
    const [quickPreset] = useState<InventoryQuickPreset>('all');
    const [sortBy] = useState<InventorySort>('updated_desc');
    const inventoryTableRef = useRef<HTMLDivElement | null>(null);
    const [inventoryScrollTop, setInventoryScrollTop] = useState(0);
    const [inventoryViewportHeight, setInventoryViewportHeight] = useState(0);
    const { visibleColumnSet: inventoryVisibleColumnSet } = useTableViewState(
        'inventory-medicines',
        INVENTORY_TABLE_COLUMNS,
        {
            role: String(user?.role || ''),
            roleDefaultColumns: INVENTORY_ROLE_DEFAULT_COLUMNS,
        },
    );

    const debouncedSearch = useDebounce(searchQuery, 500);
    const canManageInventory = user?.role?.toString() !== 'auditor';

    const fetchMedicines = async () => {
        setLoading(true);
        try {
            const response = await pharmacyService.getMedicines({
                page,
                limit,
                search: debouncedSearch,
                start_date: startDate,
                end_date: endDate,
                category: selectedCategory !== ALL_CATEGORIES_FILTER ? selectedCategory : undefined,
                low_stock_only: stockFilter === 'low_stock' ? true : undefined,
                expiring_soon: stockFilter === 'expiring_soon' ? true : undefined,
                controlled_only: controlledFilter === 'controlled' ? true : undefined,
                supplier_name: supplierFilter !== 'All Suppliers' ? supplierFilter : undefined,
                ...(user?.facility_id ? { facility_id: user.facility_id } : {}),
            });
            setMedicines(response?.data || []);
            setTotalPages(response?.meta?.totalPages || 1);
            setTotalItems(response?.meta?.total || 0);
        } catch (error) {
            console.error('Failed to fetch medicines:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const data = await pharmacyService.getMedicineStatistics();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    useEffect(() => {
        if (facilityId) {
            fetchStats();
        }
    }, [facilityId]);

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const rows = await pharmacyService.getCategories();
                const dynamicCategories = rows
                    .map((row) => String(row.name || '').trim())
                    .filter(Boolean);
                const uniqueCategories = Array.from(new Set(dynamicCategories));
                setCategories([ALL_CATEGORIES_FILTER, UNCATEGORIZED_FILTER, ...uniqueCategories]);
            } catch (error) {
                console.error('Failed to load categories:', error);
            }
        };
        loadCategories();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [
        debouncedSearch,
        selectedCategory,
        stockFilter,
        controlledFilter,
        supplierFilter,
        limit,
        startDate,
        endDate,
    ]);

    useEffect(() => {
        if (facilityId) {
            fetchMedicines();
        }
    }, [
        page,
        debouncedSearch,
        selectedCategory,
        stockFilter,
        controlledFilter,
        limit,
        startDate,
        endDate,
        facilityId,
    ]);

    useEffect(() => {
        const updateViewport = () => {
            if (inventoryTableRef.current) {
                setInventoryViewportHeight(inventoryTableRef.current.clientHeight);
            }
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [inventoryTableRef]);

    useEffect(() => {
        setInventoryScrollTop(0);
        if (inventoryTableRef.current) {
            inventoryTableRef.current.scrollTop = 0;
        }
    }, [
        page,
        limit,
        stockFilter,
        controlledFilter,
        supplierFilter,
        quickPreset,
        sortBy,
        searchQuery,
    ]);

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const result = await pharmacyService.validateMedicineImport(file);
            if (result.errors && result.errors.length > 0) {
                toast.error(`${result.errors.length} errors found in file. Check details.`);
            }
            setPreviewItems(result.items);
            setPendingFile(file);
            setIsImportModalOpen(true);
        } catch (error: any) {
            console.error('Validation failed:', error);
            toast.error(error.message || 'Failed to validate Excel file.');
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = async () => {
        if (!pendingFile) return;

        setUploading(true);
        try {
            const result = await pharmacyService.importMedicines(pendingFile);
            toast.success(`Import complete: ${result.imported} new, ${result.updated} updated.`, {
                duration: 5000,
            });
            if (result.errors?.length) {
                console.error('Import errors:', result.errors);
            }
            setIsImportModalOpen(false);
            setPendingFile(null);
            fetchMedicines();
            fetchStats();
        } catch (error: any) {
            console.error('Import failed:', error);
            toast.error(error.message || 'Failed to import medicines.');
        } finally {
            setUploading(false);
        }
    };

    const downloadTemplate = async () => {
        try {
            const blob = await pharmacyService.downloadMedicineTemplate();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Medicine_Template.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Template downloaded!');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to download template.');
        }
    };

    const supplierOptions = useMemo(() => {
        const names = medicines
            .map((med) =>
                String((med as any).supplier_name || (med as any).supplier?.name || '').trim(),
            )
            .filter(Boolean);
        return ['All Suppliers', ...Array.from(new Set(names))];
    }, [medicines]);

    const visibleMedicines = useMemo(() => {
        const now = new Date();
        const in90Days = new Date();
        in90Days.setDate(now.getDate() + 90);
        const filtered = medicines.filter((med) => {
            const quantity = Number(med.stock_quantity || 0);
            const reorderPoint = Number(med.reorder_point ?? med.min_stock_level ?? 0);
            const expiryDate = med.expiry_date ? parseLocalDate(med.expiry_date) : null;
            const isExpired = !!expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate < now;
            const isExpiringSoon = !!expiryDate && expiryDate >= now && expiryDate <= in90Days;
            const isOutOfStock = quantity <= 0;
            const isLowStock =
                reorderPoint > 0
                    ? quantity <= reorderPoint
                    : quantity <= Number(med.min_stock_level || 0);
            const supplierName = String(
                (med as any).supplier_name || (med as any).supplier?.name || '',
            );
            const isControlled = Boolean(
                (med as any).is_controlled_drug ||
                (med as any).controlled_flag ||
                (med as any).drug_schedule?.includes('controlled'),
            );

            if (stockFilter === 'out_of_stock' && !isOutOfStock) return false;
            if (stockFilter === 'low_stock' && (isOutOfStock || !isLowStock)) return false;
            if (stockFilter === 'expiring_soon' && (isExpired || !isExpiringSoon)) return false;
            if (controlledFilter === 'controlled' && !isControlled) return false;
            if (controlledFilter === 'non_controlled' && isControlled) return false;
            if (supplierFilter !== 'All Suppliers' && supplierName !== supplierFilter) return false;

            if (
                quickPreset === 'safety_risk' &&
                !(isExpired || isExpiringSoon || isLowStock || isOutOfStock)
            ) {
                return false;
            }
            if (quickPreset === 'controlled' && !isControlled) return false;
            if (quickPreset === 'reorder_needed' && !(isLowStock || isOutOfStock)) return false;
            return true;
        });

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name_asc':
                    return String(a.name || '').localeCompare(String(b.name || ''));
                case 'name_desc':
                    return String(b.name || '').localeCompare(String(a.name || ''));
                case 'stock_asc':
                    return Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0);
                case 'stock_desc':
                    return Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);
                case 'updated_desc':
                default: {
                    const left = parseLocalDate((a as any).updated_at || a.created_at || 0).getTime();
                    const right = parseLocalDate((b as any).updated_at || b.created_at || 0).getTime();
                    return right - left;
                }
            }
        });
    }, [controlledFilter, medicines, stockFilter, supplierFilter, quickPreset, sortBy]);

    const inventoryVisibleColumnCount = useMemo(
        () =>
            INVENTORY_TABLE_COLUMNS.filter((column) => inventoryVisibleColumnSet.has(column.key))
                .length,
        [inventoryVisibleColumnSet],
    );

    const shouldVirtualizeInventory = visibleMedicines.length >= 80;
    const inventoryRowHeight = 96;
    const inventoryOverscan = 4;
    const inventoryStartIndex = shouldVirtualizeInventory
        ? Math.max(0, Math.floor(inventoryScrollTop / inventoryRowHeight) - inventoryOverscan)
        : 0;
    const inventoryVisibleRowCount = shouldVirtualizeInventory
        ? Math.ceil((inventoryViewportHeight || 560) / inventoryRowHeight) + inventoryOverscan * 2
        : visibleMedicines.length;
    const inventoryEndIndex = shouldVirtualizeInventory
        ? Math.min(visibleMedicines.length, inventoryStartIndex + inventoryVisibleRowCount)
        : visibleMedicines.length;
    const renderedMedicines = shouldVirtualizeInventory
        ? visibleMedicines.slice(inventoryStartIndex, inventoryEndIndex)
        : visibleMedicines;
    const inventoryTopSpacerHeight = shouldVirtualizeInventory
        ? inventoryStartIndex * inventoryRowHeight
        : 0;
    const inventoryBottomSpacerHeight = shouldVirtualizeInventory
        ? Math.max(0, (visibleMedicines.length - inventoryEndIndex) * inventoryRowHeight)
        : 0;

    const toggleSelectAll = () => {
        const visibleIds = visibleMedicines.map((m) => m.id);
        const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
        if (allVisibleSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(visibleIds);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
        );
    };

    const copySelectedIds = () => {
        const selectedCodes = medicines
            .filter((m) => selectedIds.includes(m.id))
            .map((m) => m.code)
            .join(', ');

        if (!selectedCodes) {
            toast.error('No items selected');
            return;
        }

        navigator.clipboard.writeText(selectedCodes);
        toast.success(`Copied ${selectedIds.length} medicine codes to clipboard!`);
    };

    const handleExport = async () => {
        try {
            await pharmacyService.exportMedicines();
            toast.success('Exporting inventory...');
        } catch (error) {
            toast.error('Failed to export inventory');
        }
    };

    const openCreateMedicine = () => {
        setEditingMedicine(undefined);
        setIsMedicineModalOpen(true);
    };

    const openEditMedicine = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setIsMedicineModalOpen(true);
    };

    useEffect(() => {
        const isTypingTarget = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            if (!el) return false;
            const tag = el.tagName?.toLowerCase();
            return (
                tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
            );
        };

        const handleShortcuts = (event: KeyboardEvent) => {
            if (!event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target))
                return;

            const key = event.key.toLowerCase();
            if (key === 'a') {
                event.preventDefault();
                navigate({ to: '/app/stock' as any, search: {} as any });
                return;
            }

            if (user?.role?.toString() === 'auditor') return;

            if (key === 's') {
                event.preventDefault();
                setIsAddStockModalOpen(true);
                return;
            }
            if (key === 't') {
                event.preventDefault();
                if (facilityId && visibleMedicines.length > 0) {
                    setSelectedMedForTransfer(visibleMedicines[0]);
                }
                return;
            }
            if (key === 'm') {
                event.preventDefault();
                openCreateMedicine();
            }
        };

        window.addEventListener('keydown', handleShortcuts);
        return () => window.removeEventListener('keydown', handleShortcuts);
    }, [facilityId, navigate, user?.role, visibleMedicines]);

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
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                {}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-black text-healthcare-dark dark:text-white tracking-tight">
                            Medicine Inventory
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-2 mt-0.5 text-xs uppercase tracking-wider">
                            Manage your full pharmaceutical stock and batches
                        </p>
                    </div>
                    {user?.role?.toString() !== 'auditor' && (
                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportFileChange}
                                className="hidden"
                                accept=".xlsx,.xls"
                            />
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                            >
                                <Download size={14} /> Template
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                            >
                                {loading && !medicines.length ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <Upload size={14} />
                                )}
                                Import Excel
                            </button>
                            <button
                                onClick={() => setIsAddStockModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-healthcare-primary/10 text-healthcare-primary border-2 border-healthcare-primary/20 rounded-lg text-sm font-black hover:bg-healthcare-primary hover:text-white transition-all shadow-sm"
                            >
                                <PackagePlus size={16} /> Add Stock
                            </button>
                            <button
                                onClick={openCreateMedicine}
                                className="flex items-center gap-2 px-4 py-2 bg-healthcare-primary text-white rounded-lg text-sm font-black hover:bg-teal-700 transition-all shadow-md shadow-teal-500/10"
                            >
                                <Plus size={16} /> Add Medicine
                            </button>
                        </div>
                    )}
                </div>

                {}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#2563EB] to-[#1D4ED8]">
                        <div className="tc-stat-card-header">
                            <h3 className="tc-stat-card-title text-white/90">Medicines</h3>
                            <span className="tc-stat-card-icon bg-white/20">
                                <Pill size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <span className="tc-stat-card-value">
                                {stats.totalItems.toLocaleString()}
                            </span>
                            <span className="tc-stat-card-subtitle">Total</span>
                        </div>
                    </div>

                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#1D4ED8] to-[#1E40AF]">
                        <div className="tc-stat-card-header">
                            <h3 className="tc-stat-card-title text-white/90">Categories</h3>
                            <span className="tc-stat-card-icon bg-white/20">
                                <Filter size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <span className="tc-stat-card-value">
                                {stats.totalCategories.toLocaleString()}
                            </span>
                            <span className="tc-stat-card-subtitle">Types</span>
                        </div>
                    </div>

                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#F59E0B] to-[#D97706]">
                        <div className="tc-stat-card-header">
                            <h3 className="tc-stat-card-title text-white/90">Low stock</h3>
                            <span className="tc-stat-card-icon bg-white/20">
                                <AlertCircle size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <span className="tc-stat-card-value">
                                {stats.lowStock.toLocaleString()}
                            </span>
                            <span className="tc-stat-card-subtitle">Alert</span>
                        </div>
                    </div>

                    <div className="tc-stat-card tc-stat-card-gradient bg-gradient-to-br from-[#EF4444] to-[#DC2626]">
                        <div className="tc-stat-card-header">
                            <h3 className="tc-stat-card-title text-white/90">Expired</h3>
                            <span className="tc-stat-card-icon bg-white/20">
                                <AlertCircle size={15} />
                            </span>
                        </div>
                        <div className="tc-stat-card-foot">
                            <span className="tc-stat-card-value">
                                {stats.expired.toLocaleString()}
                            </span>
                            <span className="tc-stat-card-subtitle">Critical</span>
                        </div>
                    </div>
                </div>

                {}
                <div className="flex flex-col gap-4">
                    <TableToolbar
                        layout="stacked"
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Search by code, generic or brand name..."
                        onReset={() => {
                            setSearchQuery('');
                            setStartDate('');
                            setEndDate('');
                            setSelectedCategory(ALL_CATEGORIES_FILTER);
                            setStockFilter('all');
                            setControlledFilter('all');
                            setSupplierFilter('All Suppliers');
                            setLimit(10);
                            setPage(1);
                        }}
                        filters={
                            <>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-11 sm:h-10 px-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-900 dark:text-white transition-all outline-none focus:border-healthcare-primary"
                                />
                                <span className="h-11 sm:h-10 inline-flex items-center px-1 text-slate-400 font-black text-[10px] shrink-0 uppercase tracking-widest">
                                    To
                                </span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-11 sm:h-10 px-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-900 dark:text-white transition-all outline-none focus:border-healthcare-primary"
                                />
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="h-11 sm:h-10 px-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                                >
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat === UNCATEGORIZED_FILTER ? 'Uncategorized' : cat}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={stockFilter}
                                    onChange={(e) => setStockFilter(e.target.value as any)}
                                    className="h-11 sm:h-10 px-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                                >
                                    <option value="all">All stock levels</option>
                                    <option value="low_stock">Low stock</option>
                                    <option value="out_of_stock">Out of stock</option>
                                    <option value="expiring_soon">Expiring soon</option>
                                </select>
                                <select
                                    value={supplierFilter}
                                    onChange={(e) => setSupplierFilter(e.target.value)}
                                    className="h-11 sm:h-10 px-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-healthcare-primary transition-all shadow-sm"
                                >
                                    {supplierOptions.map((supplier) => (
                                        <option key={supplier} value={supplier}>
                                            {supplier}
                                        </option>
                                    ))}
                                </select>
                            </>
                        }
                        actions={
                            <>
                                {user?.role?.toString() !== 'auditor' ? (
                                    <button
                                        onClick={handleExport}
                                        className="h-11 sm:h-10 flex items-center gap-2 px-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm touch-manipulation"
                                    >
                                        <Download size={16} /> Export
                                    </button>
                                ) : null}
                            </>
                        }
                    />

                    {selectedIds.length > 0 && (
                        <div className="sticky bottom-3 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-2 border-healthcare-primary/20 rounded-xl shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-healthcare-primary text-white rounded-lg">
                                    <CheckCircle2 size={16} />
                                </div>
                                <span className="text-sm font-black text-healthcare-primary">
                                    {selectedIds.length} items selected
                                </span>
                            </div>
                            <button
                                onClick={copySelectedIds}
                                className="h-11 px-4 w-full sm:w-auto flex items-center justify-center gap-2 bg-healthcare-primary text-white rounded-lg text-sm font-black hover:bg-teal-700 transition-all shadow-md touch-manipulation"
                            >
                                <Copy size={16} /> Copy Codes for PO
                            </button>
                        </div>
                    )}
                </div>

                {}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div
                        ref={inventoryTableRef}
                        onScroll={(event) => setInventoryScrollTop(event.currentTarget.scrollTop)}
                        className="overflow-x-auto overflow-y-auto max-h-[560px]"
                    >
                        <table className="tc-table w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-800">
                                    {inventoryVisibleColumnSet.has('select') && (
                                        <th className="px-4 py-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    visibleMedicines.length > 0 &&
                                                    visibleMedicines.every((med) =>
                                                        selectedIds.includes(med.id),
                                                    )
                                                }
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded border-2 border-slate-300 text-healthcare-primary focus:ring-healthcare-primary transition-all"
                                            />
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('medicine') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                            Medicine Details
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('category') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                            Category
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('dosage_form') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center whitespace-nowrap">
                                            Dosage Form
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('supplier') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                            Supplier
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('stock') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                            Current Stock
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('threshold') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                            Min / Reorder
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('expiry') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center whitespace-nowrap">
                                            Expiry Risk
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('updated') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center whitespace-nowrap">
                                            Last Updated
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('status') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center whitespace-nowrap">
                                            Status
                                        </th>
                                    )}
                                    {inventoryVisibleColumnSet.has('actions') && (
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right whitespace-nowrap">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, rowIdx) => (
                                        <tr key={`skeleton-${rowIdx}`} className="animate-pulse">
                                            {Array.from({
                                                length: inventoryVisibleColumnCount,
                                            }).map((__, colIdx) => (
                                                <td
                                                    key={`skeleton-${rowIdx}-${colIdx}`}
                                                    className="px-4 py-4"
                                                >
                                                    <div
                                                        className={cn(
                                                            'h-3 rounded bg-slate-200 dark:bg-slate-700',
                                                            colIdx === 0
                                                                ? 'w-4'
                                                                : colIdx === 1
                                                                  ? 'w-36'
                                                                  : 'w-20',
                                                        )}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : visibleMedicines.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={inventoryVisibleColumnCount}
                                            className="px-6 py-20 text-center"
                                        >
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                                                    <Search size={32} className="text-slate-300" />
                                                </div>
                                                <p className="text-slate-500 font-bold">
                                                    No medicines found matching your filters.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {shouldVirtualizeInventory &&
                                            inventoryTopSpacerHeight > 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={inventoryVisibleColumnCount}
                                                        style={{
                                                            height: `${inventoryTopSpacerHeight}px`,
                                                        }}
                                                    />
                                                </tr>
                                            )}
                                        {renderedMedicines.map((med) => {
                                            const quantity = Number(med.stock_quantity || 0);
                                            const reorderPoint = Number(
                                                med.reorder_point ?? med.min_stock_level ?? 0,
                                            );
                                            const minLevel = Number(med.min_stock_level || 0);
                                            const expiryDate = med.expiry_date
                                                ? parseLocalDate(med.expiry_date)
                                                : null;
                                            const now = new Date();
                                            const in90Days = new Date();
                                            in90Days.setDate(now.getDate() + 90);
                                            const isExpired = !!expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate < now;
                                            const isExpiringSoon =
                                                !!expiryDate &&
                                                expiryDate >= now &&
                                                expiryDate <= in90Days;
                                            const isOutOfStock = quantity <= 0;
                                            const isLowStock =
                                                reorderPoint > 0
                                                    ? quantity <= reorderPoint
                                                    : quantity <= minLevel;
                                            const isControlled = Boolean(
                                                (med as any).is_controlled_drug ||
                                                (med as any).controlled_flag ||
                                                (med as any).drug_schedule?.includes('controlled'),
                                            );
                                            const supplierName = String(
                                                (med as any).supplier_name ||
                                                    (med as any).supplier?.name ||
                                                    'Unassigned',
                                            );
                                            const genericName = String(
                                                (med as any).generic_name || '',
                                            );
                                            const manufacturerName = String(
                                                (med as any).manufacturer || '',
                                            );
                                            const updatedAt =
                                                (med as any).updated_at || med.created_at;

                                            return (
                                                <tr
                                                    key={med.id}
                                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                                                >
                                                    {inventoryVisibleColumnSet.has('select') && (
                                                        <td className="px-4 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.includes(
                                                                    med.id,
                                                                )}
                                                                onChange={() =>
                                                                    toggleSelect(med.id)
                                                                }
                                                                className="w-4 h-4 rounded border-2 border-slate-300 text-healthcare-primary focus:ring-healthcare-primary transition-all"
                                                            />
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('medicine') && (
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 bg-healthcare-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                    <Pill
                                                                        className="text-healthcare-primary"
                                                                        size={20}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">
                                                                        {med.name}
                                                                    </p>
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                                                                        {med.code} •{' '}
                                                                        {med.brand_name || 'N/A'}
                                                                    </p>
                                                                    {(genericName ||
                                                                        manufacturerName) && (
                                                                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                                                                            {[
                                                                                genericName,
                                                                                manufacturerName,
                                                                            ]
                                                                                .filter(Boolean)
                                                                                .join(' • ')}
                                                                        </p>
                                                                    )}
                                                                    {isControlled && (
                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5 mt-1">
                                                                            <ShieldAlert
                                                                                size={10}
                                                                            />
                                                                            Controlled
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('category') && (
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-xs font-bold text-slate-500">
                                                                {String(
                                                                    (med as any).category?.name ||
                                                                        (med as any)
                                                                            .category_name ||
                                                                        'Uncategorized',
                                                                )}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has(
                                                        'dosage_form',
                                                    ) && (
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <span className="text-xs font-bold text-slate-500">
                                                                {toSentenceCase(med.dosage_form)}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('supplier') && (
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-xs font-bold text-slate-500">
                                                                {supplierName}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('stock') && (
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm font-black text-slate-800 dark:text-white">
                                                                    {quantity}
                                                                </span>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                    {toSentenceCase(med.unit)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('threshold') && (
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm font-black text-slate-800 dark:text-white">
                                                                    {reorderPoint.toLocaleString()}
                                                                </span>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                    min {minLevel.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('expiry') && (
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <span
                                                                className={cn(
                                                                    'text-xs font-bold',
                                                                    isExpired
                                                                        ? 'text-red-500'
                                                                        : isExpiringSoon
                                                                          ? 'text-amber-600'
                                                                          : 'text-slate-500',
                                                                )}
                                                            >
                                                                {expiryDate
                                                                    ? formatLocalDate(expiryDate)
                                                                    : 'N/A'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('updated') && (
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <span className="text-xs font-bold text-slate-500">
                                                                {updatedAt
                                                                    ? formatLocalDate(updatedAt)
                                                                    : 'N/A'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('status') && (
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <span
                                                                className={cn(
                                                                    'px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider',
                                                                    isExpired
                                                                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                                        : isOutOfStock
                                                                          ? 'bg-red-50 text-red-600 border-red-100'
                                                                          : isLowStock
                                                                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                                                                            : 'bg-teal-50 text-teal-600 border-teal-100',
                                                                )}
                                                            >
                                                                {isExpired
                                                                    ? 'Expired'
                                                                    : isOutOfStock
                                                                      ? 'Out of Stock'
                                                                      : isLowStock
                                                                        ? 'Low Stock'
                                                                        : 'In Stock'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {inventoryVisibleColumnSet.has('actions') && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2 transition-all">
                                                                {canManageInventory && (
                                                                    <button
                                                                        onClick={() =>
                                                                            setIsAddStockModalOpen(
                                                                                true,
                                                                            )
                                                                        }
                                                                        title="Add Stock"
                                                                        className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center text-teal-600 hover:bg-teal-50 bg-teal-50/10 rounded-lg transition-colors touch-manipulation"
                                                                    >
                                                                        <PackagePlus size={16} />
                                                                    </button>
                                                                )}
                                                                {canManageInventory && (
                                                                    <button
                                                                        onClick={() =>
                                                                            openEditMedicine(med)
                                                                        }
                                                                        title="Edit Medicine"
                                                                        className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 bg-emerald-50/10 rounded-lg transition-colors touch-manipulation"
                                                                    >
                                                                        <Pencil size={16} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() =>
                                                                        navigate({
                                                                            to: `/app/inventory/${med.id}` as any,
                                                                        })
                                                                    }
                                                                    title="View details"
                                                                    className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 bg-slate-50/30 dark:hover:bg-slate-800 rounded-lg transition-colors touch-manipulation"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                        {shouldVirtualizeInventory &&
                                            inventoryBottomSpacerHeight > 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={inventoryVisibleColumnCount}
                                                        style={{
                                                            height: `${inventoryBottomSpacerHeight}px`,
                                                        }}
                                                    />
                                                </tr>
                                            )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={limit}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => {
                                setLimit(size);
                                setPage(1);
                            }}
                            pageSizeOptions={[10, 25, 50, 100]}
                            pageSizeLabel="Items/Page"
                            loading={loading}
                            className="w-full border-none shadow-none bg-transparent p-0"
                        />
                    </div>
                </div>

                {selectedMedForTransfer && facilityId && (
                    <StockTransferModal
                        facilityId={facilityId}
                        onClose={() => setSelectedMedForTransfer(null)}
                        medicine={selectedMedForTransfer}
                        onSuccess={() => {
                            if (facilityId) {
                                fetchMedicines();
                                fetchStats();
                            }
                            setSelectedMedForTransfer(null);
                        }}
                    />
                )}

                {}
                <MedicineImportPreviewModal
                    isOpen={isImportModalOpen}
                    onClose={() => {
                        setIsImportModalOpen(false);
                        setPendingFile(null);
                    }}
                    onConfirm={confirmImport}
                    items={previewItems}
                    loading={uploading}
                />

                <AddStockModal
                    isOpen={isAddStockModalOpen}
                    onClose={() => setIsAddStockModalOpen(false)}
                    onSuccess={() => {
                        fetchMedicines();
                        fetchStats();
                    }}
                />

                {isMedicineModalOpen && (
                    <MedicineModal
                        medicine={editingMedicine}
                        onClose={() => {
                            setIsMedicineModalOpen(false);
                            setEditingMedicine(undefined);
                        }}
                        onSuccess={() => {
                            fetchMedicines();
                            fetchStats();
                        }}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
