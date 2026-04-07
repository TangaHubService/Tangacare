import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Optional custom fallback UI. Defaults to a generic error page. */
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * H-4: Global error boundary.
 * Catches unhandled React render errors so the entire app doesn't show a blank screen.
 *
 * Usage: Wrap at the root in main.tsx around the router.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production, send to your error tracking service (Sentry, etc.)
        console.error('[ErrorBoundary] Caught unhandled error:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        background: 'var(--bg-primary, #0f172a)',
                        color: 'var(--text-primary, #f1f5f9)',
                    }}
                >
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            color: 'var(--text-secondary, #94a3b8)',
                            marginBottom: '1.5rem',
                            textAlign: 'center',
                            maxWidth: '480px',
                        }}
                    >
                        An unexpected error occurred. Your data is safe. Please reload the page.
                    </p>
                    {import.meta.env.DEV && this.state.error && (
                        <pre
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                padding: '1rem',
                                fontSize: '0.75rem',
                                maxWidth: '600px',
                                overflow: 'auto',
                                marginBottom: '1.5rem',
                                color: '#f87171',
                            }}
                        >
                            {this.state.error.stack}
                        </pre>
                    )}
                    <button
                        onClick={this.handleReset}
                        style={{
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            padding: '0.75rem 2rem',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
