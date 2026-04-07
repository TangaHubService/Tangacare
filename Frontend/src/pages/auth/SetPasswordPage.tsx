import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';

export function SetPasswordPage() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await authService.setInitialPassword(password);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user_data');
            toast.success('Password set successfully. You can now log in.');
            navigate({ to: '/auth/login' as any, search: {} as any });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to set password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="glass-card shadow-2xl p-10 space-y-6 bg-secondary/95 border border-border-color rounded-2xl"
        >
            <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-healthcare-primary/10 text-healthcare-primary rounded-2xl flex items-center justify-center mb-4">
                    <Lock size={32} />
                </div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight">
                    Set your password
                </h2>
                <p className="text-text-muted text-sm px-4">
                    Choose a secure password for your account (at least 8 characters).
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5 text-left">
                    <label className="text-sm font-bold text-text-secondary ml-1">
                        New password *
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-4 pr-12 py-3.5 bg-input-bg border-2 border-border-color rounded-2xl text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all"
                            required
                            minLength={8}
                            placeholder="Min 8 characters"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-healthcare-primary"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5 text-left">
                    <label className="text-sm font-bold text-text-secondary ml-1">
                        Confirm password *
                    </label>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3.5 bg-input-bg border-2 border-border-color rounded-2xl text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 focus:border-healthcare-primary transition-all"
                        required
                        minLength={8}
                        placeholder="Confirm your password"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                    'Set password & continue'
                )}
            </button>
        </form>
    );
}
