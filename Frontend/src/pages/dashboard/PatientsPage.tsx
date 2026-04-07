import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, User, Phone, MapPin, Calendar, History, Edit } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import { CreatePatientModal } from '../../components/patients/CreatePatientModal';
import { format } from 'date-fns';
import { SkeletonTable } from '../../components/ui/SkeletonTable';

export const PatientsPage: React.FC = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<any>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['patients', search, page],
        queryFn: () => pharmacyService.getPatients({ search, page, limit: 10 }),
    });

    const patients = data?.data || [];
    const totalPages = data?.meta.totalPages || 1;

    return (
            <div className="space-y-6 h-full flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-healthcare-dark dark:text-white">
                            Customer Records
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Manage patient profiles and history
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-healthcare-primary text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-bold text-sm"
                    >
                        <Plus size={18} />
                        Add Customer
                    </button>
                </div>

                <div className="glass-card p-4 rounded-xl flex items-center gap-3 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                    <Search size={20} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, phone or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-transparent border-none focus:outline-none w-full text-sm font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400"
                    />
                </div>

                <div className="flex-1 glass-card rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm">
                    {isLoading ? (
                        <SkeletonTable
                            rows={10}
                            columns={6}
                            headers={['ID', 'Customer', 'Contact', 'Location', 'Joined']}
                            columnAligns={['left', 'left', 'left', 'left', 'left', 'right']}
                            actions
                            className="border-none shadow-none"
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto flex-1">
                                <table className="tc-table w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Customer
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Contact
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Location
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Joined
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {patients.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-0">
                                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full">
                                                            <User
                                                                size={32}
                                                                className="text-slate-300"
                                                            />
                                                        </div>
                                                        <span className="font-medium">
                                                            No customers found
                                                        </span>
                                                        <p className="text-xs text-slate-400 max-w-xs text-center">
                                                            Get started by adding a new customer
                                                            record to the system.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            patients.map((patient) => (
                                                <tr
                                                    key={patient.id}
                                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                                                >
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-slate-500 font-mono">
                                                            #{patient.id}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-healthcare-primary font-bold text-sm border border-healthcare-primary/10">
                                                                {patient.first_name?.[0]}
                                                                {patient.last_name?.[0]}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-healthcare-dark dark:text-white text-sm">
                                                                    {patient.first_name}{' '}
                                                                    {patient.last_name}
                                                                </p>
                                                                <p className="text-xs text-slate-400">
                                                                    {patient.email || 'No email'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <Phone
                                                                size={14}
                                                                className="text-slate-400"
                                                            />
                                                            <span className="font-medium">
                                                                {patient.phone_number}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <MapPin
                                                                size={14}
                                                                className="text-slate-400"
                                                            />
                                                            <span
                                                                className="truncate max-w-[150px]"
                                                                title={patient.address || ''}
                                                            >
                                                                {patient.address || '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <Calendar
                                                                size={14}
                                                                className="text-slate-400"
                                                            />
                                                            <span>
                                                                {patient.created_at
                                                                    ? format(
                                                                          new Date(
                                                                              patient.created_at,
                                                                          ),
                                                                          'MMM d, yyyy',
                                                                      )
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-healthcare-primary transition-colors border border-transparent hover:border-slate-200 shadow-sm"
                                                                title="View History"
                                                            >
                                                                <History size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingPatient(patient);
                                                                    setIsCreateModalOpen(true);
                                                                }}
                                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-healthcare-primary transition-colors border border-transparent hover:border-slate-200 shadow-sm"
                                                                title="Edit Details"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
                                    <span className="text-slate-500">
                                        Page <b>{page}</b> of <b>{totalPages}</b>
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={page === 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors text-slate-600"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => p + 1)}
                                            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors text-slate-600"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {isCreateModalOpen && (
                    <CreatePatientModal
                        initialData={editingPatient}
                        onClose={() => {
                            setIsCreateModalOpen(false);
                            setEditingPatient(null);
                        }}
                    />
                )}
            </div>
    );
};
