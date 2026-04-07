import { AlertCircle, XCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    loading = false,
    variant = 'danger',
}: ConfirmModalProps) => {
    if (!isOpen) return null;

    const iconColors = {
        danger: 'text-red-500 bg-red-50',
        warning: 'text-amber-500 bg-amber-50',
        info: 'text-blue-500 bg-blue-50',
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                        <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconColors[variant]}`}
                        >
                            <AlertCircle size={24} />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                        >
                            <XCircle size={20} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-healthcare-dark">{title}</h3>
                        <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-[0.98]"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 px-4 py-2.5 text-xs font-black rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 ${
                                variant === 'danger'
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200'
                                    : variant === 'warning'
                                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200'
                                      : 'bg-healthcare-primary text-white hover:bg-teal-700 shadow-teal-200'
                            }`}
                        >
                            {loading ? 'Processing...' : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
