import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from './lib/query-client';
import { router } from './routes/router';
import { AuthProvider } from './context/AuthContext';
import { RuntimeConfigProvider } from './context/RuntimeConfigContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {/* H-4: Global error boundary prevents the entire app from going blank on runtime errors */}
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <RuntimeConfigProvider>
                        <SocketProvider>
                            <Toaster position="top-right" reverseOrder={false} />
                            <RouterProvider router={router} />
                        </SocketProvider>
                        </RuntimeConfigProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    </StrictMode>,
);
