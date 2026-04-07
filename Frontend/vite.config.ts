import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return;
                    }

                    if (id.includes('react-dom')) {
                        return 'react-dom';
                    }

                    if (id.includes('recharts')) {
                        return 'charts';
                    }

                    if (id.includes('@tanstack/react-router')) {
                        return 'router';
                    }

                    if (id.includes('@tanstack/react-query')) {
                        return 'query';
                    }

                    if (id.includes('lucide-react')) {
                        return 'icons';
                    }

                    if (id.includes('date-fns')) {
                        return 'date-utils';
                    }

                    if (id.includes('framer-motion')) {
                        return 'motion';
                    }

                    if (id.includes('@radix-ui')) {
                        return 'radix';
                    }

                    if (
                        id.includes('react-hook-form') ||
                        id.includes('@hookform') ||
                        id.includes('yup')
                    ) {
                        return 'forms';
                    }

                    if (id.includes('socket.io-client')) {
                        return 'realtime';
                    }

                    if (id.includes('axios')) {
                        return 'http';
                    }

                    if (id.includes('dexie')) {
                        return 'offline';
                    }

                    return 'vendor';
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
    },
});
