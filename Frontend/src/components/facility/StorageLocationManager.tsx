import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Layout,
    Thermometer,
    MapPin,
    XCircle,
    Loader2,
} from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import {
    TemperatureType,
    type StorageLocation,
    type CreateStorageLocationDto,
} from '../../types/pharmacy';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function StorageLocationManager({ facilityId }: { facilityId: number }) {
    const [locations, setLocations] = useState<StorageLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState<CreateStorageLocationDto>({
        name: '',
        code: '',
        area: '',
        temperature_type: TemperatureType.ROOM_TEMP,
        is_active: true,
        parent_id: null,
    });

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const data = await pharmacyService.getStorageLocations({ facility_id: facilityId });
            setLocations(data);
        } catch (error) {
            console.error('Failed to fetch locations:', error);
            toast.error('Failed to load storage locations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (facilityId) fetchLocations();
    }, [facilityId]);

    const handleEdit = (location: StorageLocation) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            code: location.code,
            area: location.area || '',
            temperature_type: location.temperature_type,
            is_active: location.is_active,
            parent_id: location.parent_id,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this storage location?')) return;

        try {
            await pharmacyService.deleteStorageLocation(id);
            toast.success('Location deleted successfully');
            fetchLocations();
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete location');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingLocation) {
                await pharmacyService.updateStorageLocation(editingLocation.id, formData);
                toast.success('Location updated successfully');
            } else {
                await pharmacyService.createStorageLocation({
                    ...formData,
                    facility_id: facilityId,
                } as any);
                toast.success('Location created successfully');
            }
            setIsModalOpen(false);
            setEditingLocation(null);
            setFormData({
                name: '',
                code: '',
                area: '',
                temperature_type: TemperatureType.ROOM_TEMP,
                is_active: true,
                parent_id: null,
            });
            fetchLocations();
        } catch (error: any) {
            console.error('Submit failed:', error);
            toast.error(error?.response?.data?.message || 'Failed to save location');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredLocations = locations.filter(
        (loc) =>
            loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.area?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">
                        Storage Locations
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Manage shelves, racks, and cold storage units
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingLocation(null);
                        setFormData({
                            name: '',
                            code: '',
                            area: '',
                            temperature_type: TemperatureType.ROOM_TEMP,
                            is_active: true,
                            parent_id: null,
                        });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-healthcare-primary text-white rounded-xl text-sm font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20"
                >
                    <Plus size={16} /> Add Location
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative group flex-1">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-healthcare-primary transition-colors"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search locations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-healthcare-primary focus:bg-white transition-all shadow-inner"
                    />
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-healthcare-primary" size={40} />
                    </div>
                ) : filteredLocations.length === 0 ? (
                    <div className="py-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                        <Layout className="text-slate-300 mb-4" size={48} />
                        <p className="text-slate-500 font-bold">No storage locations found</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-healthcare-primary font-black text-sm mt-2 hover:underline"
                        >
                            Create your first location
                        </button>
                    </div>
                ) : (
                    (() => {
                        // Hierarchical view logic
                        const rootLocations = filteredLocations.filter((loc) => !loc.parent_id);
                        const renderLocation = (loc: StorageLocation, depth: number = 0) => {
                            const children = locations.filter((c) => c.parent_id === loc.id);
                            return (
                                <div
                                    key={loc.id}
                                    style={{ marginLeft: `${depth * 24}px` }}
                                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm hover:border-healthcare-primary/30 transition-all group relative"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={cn(
                                                    'w-10 h-10 rounded-xl flex items-center justify-center',
                                                    loc.temperature_type === TemperatureType.COLD
                                                        ? 'bg-blue-50 text-blue-500'
                                                        : loc.temperature_type ===
                                                            TemperatureType.FROZEN
                                                          ? 'bg-indigo-50 text-indigo-500'
                                                          : 'bg-orange-50 text-orange-500',
                                                )}
                                            >
                                                <Layout size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-800 dark:text-white leading-tight">
                                                    {loc.name}
                                                </h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {loc.code}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(loc)}
                                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-healthcare-primary rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(loc.id)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                            <MapPin size={12} />
                                            <span>Area: {loc.area || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                            <Thermometer size={12} />
                                            <span className="capitalize">
                                                {loc.temperature_type
                                                    .toLowerCase()
                                                    .replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                        <span
                                            className={cn(
                                                'px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider',
                                                loc.is_active
                                                    ? 'bg-teal-50 text-teal-600'
                                                    : 'bg-red-50 text-red-600',
                                            )}
                                        >
                                            {loc.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    {children.map((child) => renderLocation(child, depth + 1))}
                                </div>
                            );
                        };
                        return (
                            <div className="grid grid-cols-1 gap-4">
                                {rootLocations.map((loc) => renderLocation(loc))}
                            </div>
                        );
                    })()
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">
                                {editingLocation ? 'Edit Location' : 'Add New Location'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <XCircle size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                    Location Name
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Shelf A, Cold Storage 1"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-healthcare-primary/20 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm font-bold outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                        Code
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. SLF-A"
                                        value={formData.code}
                                        onChange={(e) =>
                                            setFormData({ ...formData, code: e.target.value })
                                        }
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-healthcare-primary/20 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm font-bold outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                        Area
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Backdoor, Front Desk"
                                        value={formData.area}
                                        onChange={(e) =>
                                            setFormData({ ...formData, area: e.target.value })
                                        }
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-healthcare-primary/20 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm font-bold outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                    Parent Location (Optional)
                                </label>
                                <select
                                    value={formData.parent_id || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            parent_id: e.target.value
                                                ? parseInt(e.target.value)
                                                : null,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-healthcare-primary/20 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm font-bold outline-none transition-all"
                                >
                                    <option value="">None (Root Location)</option>
                                    {locations
                                        .filter((loc) => loc.id !== editingLocation?.id) // Avoid self-reference
                                        .map((loc) => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name} ({loc.code})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                                    Temperature Requirement
                                </label>
                                <select
                                    value={formData.temperature_type}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            temperature_type: e.target.value as TemperatureType,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-healthcare-primary/20 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm font-bold outline-none transition-all"
                                >
                                    <option value={TemperatureType.ROOM_TEMP}>
                                        Room Temperature
                                    </option>
                                    <option value={TemperatureType.COLD}>
                                        Cold Storage (2-8°C)
                                    </option>
                                    <option value={TemperatureType.FROZEN}>
                                        Frozen Storage (&lt;0°C)
                                    </option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) =>
                                        setFormData({ ...formData, is_active: e.target.checked })
                                    }
                                    className="w-5 h-5 rounded border-2 border-slate-300 text-healthcare-primary focus:ring-healthcare-primary transition-all"
                                />
                                <label
                                    htmlFor="is_active"
                                    className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                    This storage location is active
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 bg-healthcare-primary text-white rounded-2xl font-black text-sm hover:bg-teal-700 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : editingLocation ? (
                                    <Edit2 size={20} />
                                ) : (
                                    <Plus size={20} />
                                )}
                                {editingLocation ? 'Update Location' : 'Create Location'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
