import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, X, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { pharmacyService } from '../../services/pharmacy.service';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

interface JoinOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function JoinOrganizationModal({ isOpen, onClose }: JoinOrganizationModalProps) {
    const [code, setCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [foundOrg, setFoundOrg] = useState<any>(null);
    const [joining, setJoining] = useState(false);
    const { refreshProfile } = useAuth();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setSearching(true);
        try {
            const result = await pharmacyService.getOrganizations({
                search: code.trim(),
                limit: 1,
            });
            const org = result.data.find(
                (o) => o.code?.toLowerCase() === code.trim().toLowerCase(),
            );
            if (org) {
                setFoundOrg(org);
            } else {
                toast.error('Organization not found. Please check the code.');
                setFoundOrg(null);
            }
        } catch (error) {
            toast.error('Search failed. Please try again.');
        } finally {
            setSearching(false);
        }
    };

    const handleJoin = async () => {
        if (!foundOrg) return;
        setJoining(true);
        try {
            toast.success(`Request sent to ${foundOrg.name}.`);
            await refreshProfile();
            onClose();
        } catch (error) {
            toast.error('Failed to send join request.');
        } finally {
            setJoining(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                        <div className="h-32 bg-gradient-to-br from-healthcare-primary to-teal-600 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20">
                                <Building2
                                    size={120}
                                    className="absolute -right-4 -bottom-4 rotate-12"
                                />
                                <Building2
                                    size={80}
                                    className="absolute -left-4 -top-4 -rotate-12"
                                />
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-8 pb-10 -mt-10 relative">
                            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center text-healthcare-primary mb-6 border-4 border-slate-50 dark:border-slate-900">
                                <Building2 size={36} />
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-3xl font-black text-healthcare-dark dark:text-white tracking-tight">
                                        Join Pharmacy
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                                        Enter your organization code to search and request access.
                                    </p>
                                </div>

                                {!foundOrg ? (
                                    <form onSubmit={handleSearch} className="space-y-4">
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-healthcare-primary transition-colors">
                                                <Search size={20} />
                                            </div>
                                            <input
                                                type="text"
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                placeholder="e.g. TANGA-123"
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-healthcare-primary dark:focus:border-healthcare-primary transition-all font-bold text-lg uppercase tracking-wider"
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={searching || !code.trim()}
                                            className="w-full py-4 bg-healthcare-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-healthcare-primary/30 hover:bg-teal-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                                        >
                                            {searching ? (
                                                <Loader2 size={24} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <span>Search Organization</span>
                                                    <ArrowRight size={20} />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-6"
                                    >
                                        <div className="p-6 bg-teal-50 dark:bg-teal-900/20 rounded-3xl border-2 border-healthcare-primary/20 space-y-3 relative overflow-hidden group">
                                            <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                                                <CheckCircle2 size={120} />
                                            </div>
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-healthcare-primary uppercase tracking-widest">
                                                        Organization Found
                                                    </span>
                                                    <h3 className="text-2xl font-black text-healthcare-dark dark:text-white leading-tight">
                                                        {foundOrg.name}
                                                    </h3>
                                                </div>
                                                <div className="px-3 py-1 bg-white dark:bg-slate-800 text-healthcare-primary rounded-lg text-xs font-black shadow-sm border border-healthcare-primary/10">
                                                    {foundOrg.code}
                                                </div>
                                            </div>
                                            {foundOrg.address && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">
                                                    {foundOrg.address}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setFoundOrg(null)}
                                                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={handleJoin}
                                                disabled={joining}
                                                className="flex-[2] py-4 bg-healthcare-primary text-white rounded-2xl font-black shadow-lg shadow-healthcare-primary/30 hover:bg-teal-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {joining ? (
                                                    <Loader2 size={24} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <span>Send Request</span>
                                                        <CheckCircle2 size={20} />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
