import { Building2, Plus } from 'lucide-react';

interface FacilityEmptyStateProps {
    onCreateClick: () => void;
    onJoinClick: () => void;
    noOrganization?: boolean;
}

export function FacilityEmptyState({
    onCreateClick,
    onJoinClick,
    noOrganization,
}: FacilityEmptyStateProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex items-center justify-center mx-auto mb-6">
                    <div className="w-16 h-16 bg-healthcare-primary/10 rounded-2xl flex items-center justify-center text-healthcare-primary">
                        <Building2 size={32} />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight">
                        {noOrganization ? 'Set up your pharmacy' : 'No Facility Found'}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        {noOrganization
                            ? "Create your organization and first branch to start. You'll need an organization (your business) and at least one facility (branch/location)."
                            : "You are registered as a Facility Admin, but you haven't set up your pharmacy or clinic yet."}
                    </p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={onCreateClick}
                        className=" whitespace-nowrap group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-healthcare-primary text-white rounded-2xl font-bold text-sm hover:bg-teal-700 transition-all shadow-lg hover:shadow-healthcare-primary/30 active:scale-[0.98] w-full sm:w-auto"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                        <span>{noOrganization ? 'Add new & branch' : 'Register New Facility'}</span>
                    </button>

                    {noOrganization && (
                        <button
                            onClick={onJoinClick}
                            className=" whitespace-nowrap px-8 py-4 bg-white dark:bg-slate-800 text-healthcare-primary border-2 border-healthcare-primary/20 hover:border-healthcare-primary rounded-2xl font-bold text-sm transition-all shadow-md active:scale-[0.98] w-full sm:w-auto"
                        >
                            Join existing pharmacy
                        </button>
                    )}
                </div>
                <p className="mt-4 text-[10px] text-slate-400 font-bold tracking-widest">
                    Takes less than 2 minutes
                </p>
            </div>
        </div>
    );
}
