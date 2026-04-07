import { useState } from 'react';
import { Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { loginSchema } from '../../validations/auth.validation';

type LoginForm = yup.InferType<typeof loginSchema>;

export function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const searchParams = useSearch({ from: '/auth/login' }) as any;
    const redirectTo = searchParams?.redirect as string | undefined;
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: yupResolver(loginSchema) as any,
    });

    const onSubmit = async (data: LoginForm) => {
        setLoading(true);
        try {
            await login(data);
            toast.success('Welcome back to TangaCare!');
            if (redirectTo) {
                window.location.href = redirectTo;
                return;
            }
            navigate({ to: '/app' as any, search: {} as any });
        } catch (err: any) {
            const message =
                err.response?.data?.message ||
                'Authentication failed. Please check your credentials.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated) {
        if (redirectTo) {
            return <Navigate to={redirectTo as any} search={{} as any} />;
        }
        return <Navigate to={'/app' as any} search={{} as any} />;
    }

    return (
        <>
            {loading && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-900 dark:bg-slate-950 flex items-center justify-center"
                    aria-hidden="true"
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-xs font-bold text-white/90 uppercase tracking-widest">
                            Signing in...
                        </span>
                    </div>
                </div>
            )}
            <LoginFormContent
                loading={loading}
                register={register}
                handleSubmit={handleSubmit}
                errors={errors}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                onSubmit={onSubmit}
                navigate={navigate}
                redirectTo={redirectTo}
            />
        </>
    );
}

function LoginFormContent({
    loading,
    register,
    handleSubmit,
    errors,
    showPassword,
    setShowPassword,
    onSubmit,
    navigate,
    redirectTo,
}: {
    loading: boolean;
    register: any;
    handleSubmit: any;
    errors: any;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    onSubmit: (data: LoginForm) => Promise<void>;
    navigate: any;
    redirectTo?: string;
}) {
    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="glass-card shadow-2xl p-10 space-y-8 bg-secondary/95 border border-border-color rounded-2xl"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-text-primary tracking-tight">
                    Welcome Back
                </h2>
                <p className="text-text-muted font-bold text-xs uppercase tracking-wider">
                    Login to manage your pharmacy
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

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-sm font-bold text-text-secondary">Password</label>
                        <button
                            type="button"
                            onClick={() =>
                                navigate({ to: '/auth/forgot-password' as any, search: {} as any })
                            }
                            className="text-[10px] font-bold text-healthcare-primary hover:underline"
                        >
                            Forgot?
                        </button>
                    </div>
                    <div className="relative">
                        <Lock
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
                            size={16}
                        />
                        <input
                            {...register('password')}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className={`w-full pl-12 pr-12 py-3.5 bg-input-bg border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-healthcare-primary/20 transition-all text-sm font-medium text-text-primary ${errors.password ? 'border-red-400 focus:border-red-500' : 'border-border-color focus:border-healthcare-primary'}`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-healthcare-primary transition-colors"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-[10px] font-normal text-red-500 ml-1">
                            {errors.password.message}
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
                    'Sign in'
                )}
            </button>

            <div className="text-center">
                <p className="text-xs text-text-muted font-medium">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        onClick={() =>
                            navigate({
                                to: '/auth/register' as any,
                                search: redirectTo ? ({ redirect: redirectTo } as any) : ({} as any),
                            })
                        }
                        className="font-bold text-healthcare-primary hover:underline ml-1"
                    >
                        Register
                    </button>
                </p>
            </div>
        </form>
    );
}
