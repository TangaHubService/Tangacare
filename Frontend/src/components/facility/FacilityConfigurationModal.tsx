import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Facility, Department } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import { X, Settings, Building2, Plus, Trash2, Save } from 'lucide-react';

interface FacilityConfigurationModalProps {
    facility: Facility;
    onClose: () => void;
    onUpdate: () => void;
}

const configSchema = yup.object({
    min_stock_threshold_percentage: yup.number().min(0).max(100).required('Required'),
    expiry_alert_days: yup.number().min(1).required('Required'),
    departments_enabled: yup.boolean(),
    controlled_drug_rules_enabled: yup.boolean(),
    ebm_enabled: yup.boolean(),
});

export function FacilityConfigurationModal({
    facility,
    onClose,
    onUpdate,
}: FacilityConfigurationModalProps) {
    const { user } = useAuth();
    const role = user?.role?.toUpperCase();
    const canManage =
        role === 'SUPER_ADMIN' ||
        role === 'SUPER ADMIN' ||
        role === 'FACILITY_ADMIN' ||
        role === 'FACILITY ADMIN';

    const [activeTab, setActiveTab] = useState<'config' | 'departments'>('config');
    const [isLoading, setIsLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptType, setNewDeptType] = useState<Department['type']>('dispensary');

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(configSchema),
        defaultValues: {
            min_stock_threshold_percentage: facility.min_stock_threshold_percentage || 10,
            expiry_alert_days: facility.expiry_alert_days || 90,
            departments_enabled: facility.departments_enabled || false,
            controlled_drug_rules_enabled: facility.controlled_drug_rules_enabled || false,
            ebm_enabled: facility.ebm_enabled || false,
        },
    });

    const isHospital = facility.type.toLowerCase().includes('hospital');

    useEffect(() => {
        if (activeTab === 'departments' && isHospital) {
            loadDepartments();
        }
    }, [activeTab, isHospital]);

    const loadDepartments = async () => {
        setIsLoading(true);
        try {
            const data = await pharmacyService.getDepartments({ facility_id: facility.id });
            setDepartments(data || []);
        } catch (error) {
            console.error('Failed to load departments:', error);
            toast.error('Failed to load departments');
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmitConfig = async (data: any) => {
        setIsLoading(true);
        try {
            await pharmacyService.updateFacility(facility.id, data);
            toast.success('Configuration updated successfully');
            onUpdate();
        } catch (error) {
            console.error('Failed to update configuration:', error);
            toast.error('Failed to update configuration');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddDepartment = async () => {
        if (!newDeptName.trim()) return;
        setIsLoading(true);
        try {
            await pharmacyService.createDepartment({
                facility_id: facility.id,
                name: newDeptName,
                type: newDeptType,
                is_main_store: newDeptType === 'store',
                status: 'active',
            });
            toast.success('Department created');
            setNewDeptName('');
            loadDepartments();
        } catch (error) {
            console.error('Failed to create department:', error);
            toast.error('Failed to create department');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDepartment = async (id: number) => {
        if (!confirm('Are you sure you want to delete this department?')) return;
        setIsLoading(true);
        try {
            await pharmacyService.deleteDepartment(id);
            toast.success('Department deleted');
            loadDepartments();
        } catch (error) {
            console.error('Failed to delete department:', error);
            toast.error('Failed to delete department (ensure it has no stock)');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-healthcare-dark">Manage Facility</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {facility.name}{' '}
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                                {facility.type}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {}
                <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 shrink-0">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${
                            activeTab === 'config'
                                ? 'border-healthcare-primary text-healthcare-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Settings size={16} /> Configuration
                        </div>
                    </button>
                    {isHospital && (
                        <button
                            onClick={() => setActiveTab('departments')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${
                                activeTab === 'departments'
                                    ? 'border-healthcare-primary text-healthcare-primary'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Building2 size={16} /> Departments
                            </div>
                        </button>
                    )}
                </div>

                {}
                <div className="p-6 overflow-y-auto">
                    {activeTab === 'config' ? (
                        <form
                            onSubmit={handleSubmit(onSubmitConfig)}
                            className="space-y-6 max-w-lg"
                        >
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Min Stock Threshold (%)
                                    </label>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Alert when stock falls below this percentage of max
                                        capacity.
                                    </p>
                                    <input
                                        type="number"
                                        {...register('min_stock_threshold_percentage')}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold"
                                    />
                                    {errors.min_stock_threshold_percentage && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.min_stock_threshold_percentage.message}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Expiry Alert Days
                                    </label>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Days before expiry to start showing warnings.
                                    </p>
                                    <input
                                        type="number"
                                        {...register('expiry_alert_days')}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary text-sm font-bold"
                                    />
                                    {errors.expiry_alert_days && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.expiry_alert_days.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3 pt-2">
                                    <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            {...register('departments_enabled')}
                                            className="w-4 h-4 text-healthcare-primary rounded"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">
                                                Enable Departments
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                Allow tracking stock across multiple locations
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            {...register('controlled_drug_rules_enabled')}
                                            className="w-4 h-4 text-healthcare-primary rounded"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">
                                                Controlled Drug Rules
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                Enforce stricter dispensing rules for controlled
                                                substances
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors border-blue-100 bg-blue-50/30">
                                        <input
                                            type="checkbox"
                                            {...register('ebm_enabled')}
                                            className="w-4 h-4 text-healthcare-primary rounded"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">
                                                Active RRA EBM Integration
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                Automatically submit sales to RRA EBM system
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {canManage && (
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 bg-healthcare-primary text-white rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    Save Configuration
                                </button>
                            )}
                        </form>
                    ) : (
                        <div className="space-y-6">
                            {}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-700 mb-3">
                                    Add New Department
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        placeholder="Department Name (e.g. ICU Store)"
                                        value={newDeptName}
                                        onChange={(e) => setNewDeptName(e.target.value)}
                                        className="flex-1 px-4 py-2 border rounded-lg text-sm"
                                    />
                                    <select
                                        value={newDeptType}
                                        onChange={(e) => setNewDeptType(e.target.value as any)}
                                        className="px-4 py-2 border rounded-lg text-sm bg-white"
                                    >
                                        <option value="store">Main Store</option>
                                        <option value="dispensary">Dispensary</option>
                                        <option value="ward">Ward</option>
                                        <option value="theatre">Theatre</option>
                                    </select>
                                    {canManage && (
                                        <button
                                            onClick={handleAddDepartment}
                                            disabled={isLoading || !newDeptName}
                                            className="px-4 py-2 bg-healthcare-dark text-white rounded-lg hover:bg-slate-800 transition-colors"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {}
                            <div>
                                <table className="tc-table w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Role</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {departments.map((dept) => (
                                            <tr key={dept.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-700">
                                                    {dept.name}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded textxs bg-slate-100 text-slate-600 capitalize">
                                                        {dept.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {dept.is_main_store ? (
                                                        <span className="text-teal-600 font-bold text-xs">
                                                            Main Store
                                                        </span>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {canManage && (
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteDepartment(dept.id)
                                                            }
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            title="Delete Department"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {departments.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-4 py-8 text-center text-slate-500 italic"
                                                >
                                                    No departments configured yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
