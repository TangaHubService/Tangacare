import { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

export function SubscribeRedirectPage() {
    const navigate = useNavigate();
    const searchParams = useSearch({ from: '/subscribe' }) as any;

    useEffect(() => {
        const plan = searchParams?.plan_code || 'starter';
        navigate({ to: '/checkout' as any, search: { plan, mode: 'purchase' } as any, replace: true } as any);
    }, [navigate]);

    return (
        <div className="marketing-site p-6 text-sm text-slate-500">Redirecting to subscription...</div>
    );
}

