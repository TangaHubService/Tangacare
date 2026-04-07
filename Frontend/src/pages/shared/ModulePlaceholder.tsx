import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

interface ModulePlaceholderProps {
    title: string;
    description: string;
}

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
    return (
        <ProtectedRoute allowedRoles={['Admin', 'Pharmacist']}>
            <div className="p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-2xl font-black text-healthcare-dark tracking-tight">{title}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold mt-2 text-sm uppercase tracking-wider">
                    {description}
                </p>
                <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="glass-card h-40 flex items-center justify-center border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl"
                        >
                            <p className="text-slate-400 font-black text-xs uppercase tracking-widest">
                                MODULE CONTENT COMING SOON
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </ProtectedRoute>
    );
}
