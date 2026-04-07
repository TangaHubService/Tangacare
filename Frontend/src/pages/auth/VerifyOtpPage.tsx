import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ShieldCheck, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';

export function VerifyOtpPage() {
    const navigate = useNavigate();
    const search = useSearch({ from: '/auth/verify-otp' }) as any;
    const email = search.email;
    const type = search.type || 'reset';
    const redirectTo = search.redirect as string | undefined;
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!email) {
            if (type === 'register') {
                navigate({ to: '/auth/register' as any, search: {} as any });
            } else {
                toast.error('Session expired. Please try again.');
                navigate({ to: '/auth/forgot-password' as any, search: {} as any });
            }
        }
    }, [email, navigate]);

    const handleChange = (element: HTMLInputElement, index: number) => {
        if (isNaN(Number(element.value))) return false;

        setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

        if (element.value !== '' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');

        const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

        if (digits.length === 0) return;

        const newOtp = [...otp];
        digits.forEach((digit, index) => {
            if (index < 6) {
                newOtp[index] = digit;
            }
        });

        setOtp(newOtp);

        const focusIndex = Math.min(digits.length, 5);
        inputRefs.current[focusIndex]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpValue = otp.join('');
        if (otpValue.length < 6) {
            toast.error('Please enter the full 6-digit code.');
            return;
        }

        setLoading(true);
        try {
            if (type === 'register') {
                const result = await authService.verifyRegistrationOtp(email, otpValue);
                const payload = result?.data ?? result;
                const mustSetPassword = payload?.mustSetPassword === true;
                const tokens = payload?.tokens;
                if (mustSetPassword && tokens) {
                    if (tokens.accessToken)
                        localStorage.setItem('access_token', tokens.accessToken);
                    if (tokens.refreshToken)
                        localStorage.setItem('refresh_token', tokens.refreshToken);
                    if (payload?.user)
                        localStorage.setItem('user_data', JSON.stringify(payload.user));
                    toast.success('Email verified! Set your password to continue.');
                    navigate({ to: '/auth/set-password' as any, search: {} as any });
                } else {
                    toast.success('Account verified! Please login.');
                    navigate({
                        to: '/auth/login' as any,
                        search: redirectTo ? ({ redirect: redirectTo } as any) : ({} as any),
                    });
                }
            } else {
                await authService.verifyResetOtp(email, otpValue);
                toast.success('OTP verified successfully!');
                navigate({
                    to: '/auth/reset-password' as any,
                    search: { email, otp: otpValue } as any,
                    params: {} as any,
                });
            }
        } catch (err: any) {
            const message = err.response?.data?.message || 'Invalid OTP. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="glass-card shadow-2xl p-10 space-y-8 bg-secondary/95 border border-border-color rounded-2xl"
        >
            <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-healthcare-primary/10 text-healthcare-primary rounded-2xl flex items-center justify-center mb-4">
                    <ShieldCheck size={32} />
                </div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight">Verify OTP</h2>
                <p className="text-text-muted font-bold text-[10px] uppercase tracking-widest px-4">
                    We've sent a 6-digit code to <br />
                    <span className="text-healthcare-primary lowercase font-black text-xs">
                        {email}
                    </span>
                </p>
            </div>

            <div className="flex justify-between gap-2 max-w-[280px] mx-auto">
                {otp.map((data, index) => (
                    <input
                        key={index}
                        type="text"
                        maxLength={1}
                        ref={(el) => {
                            inputRefs.current[index] = el;
                        }}
                        value={data}
                        onChange={(e) => handleChange(e.target, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onPaste={handlePaste}
                        className="w-10 h-14 border-2 border-border-color bg-input-bg rounded-xl text-center text-xl font-black text-text-primary focus:border-healthcare-primary focus:outline-none transition-all"
                    />
                ))}
            </div>

            <button
                disabled={loading}
                type="submit"
                className="w-full py-4 bg-healthcare-primary text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                    'Verify & Proceed'
                )}
            </button>

            <div className="text-center">
                <button
                    type="button"
                    onClick={() => {
                        if (type === 'register') {
                            navigate({
                                to: '/auth/register' as any,
                                search: redirectTo ? ({ redirect: redirectTo } as any) : ({} as any),
                            });
                        } else {
                            navigate({ to: '/auth/forgot-password' as any, search: {} as any });
                        }
                    }}
                    className="text-xs font-bold text-healthcare-primary hover:underline flex items-center justify-center mx-auto gap-1"
                >
                    <ChevronLeft size={16} /> {type === 'register' ? 'Back to Register' : 'Back'}
                </button>
            </div>
        </form>
    );
}
