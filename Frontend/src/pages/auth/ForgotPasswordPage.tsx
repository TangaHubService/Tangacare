import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Mail, ChevronLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';
import { forgotPasswordSchema } from '../../validations/auth.validation';

type ForgotPasswordForm = yup.InferType<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordForm>({
        resolver: yupResolver(forgotPasswordSchema) as any,
    });

    const onSubmit = async (data: ForgotPasswordForm) => {
        setLoading(true);
        try {
            await authService.forgotPassword(data.email);
            toast.success('OTP sent to your email!');
            navigate({
                to: '/auth/verify-otp' as any,
                search: { email: data.email, type: 'reset' } as any,
            });
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to send OTP. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="glass-card shadow-2xl p-10 space-y-8 bg-secondary/95 border border-border-color rounded-2xl"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-text-primary tracking-tight">
                    Forgot Password?
                </h2>
                <p className="text-text-muted font-bold text-xs uppercase tracking-wider">
                    no worries, we'll send you reset instructions.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-secondary ml-1">
                        Email address
                    </label>
                    <div className="relative">
                        <Mail
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
                            size={16}
                        />
                        <input
                            {...register('email')}
                            type="email"
                            placeholder="your@email.com"
                            className={`w-full pl-12 pr-4 py-3.5 bg-input-bg border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 transition-all text-sm font-medium text-text-primary ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-border-color focus:border-healthcare-primary'}`}
                        />
                    </div>
                    {errors.email && (
                        <p className="text-[10px] font-normal text-red-500 ml-1">
                            {errors.email.message}
                        </p>
                    )}
                </div>
            </div>

            <button
                disabled={loading}
                type="submit"
                className="w-full py-4 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                    'Send OTP'
                )}
            </button>

            <div className="text-center">
                <button
                    type="button"
                    onClick={() => navigate({ to: '/auth/login' as any, search: {} as any })}
                    className="text-xs font-bold text-healthcare-primary hover:underline flex items-center justify-center mx-auto gap-1"
                >
                    <ChevronLeft size={16} /> Back to login
                </button>
            </div>
        </form>
    );
}
