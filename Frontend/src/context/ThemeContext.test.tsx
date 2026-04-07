import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

const TestComponent = () => {
    const { theme, toggleTheme, isDark } = useTheme();
    return (
        <div>
            <div data-testid="theme-value">{theme}</div>
            <div data-testid="is-dark">{isDark.toString()}</div>
            <button onClick={toggleTheme}>Toggle Theme</button>
        </div>
    );
};

describe('ThemeContext', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
    });

    it('provides default theme based on system preference (mocked as light)', () => {
        // Mock matchMedia
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // deprecated
                removeListener: vi.fn(), // deprecated
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
        expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('toggles theme correctly', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // deprecated
                removeListener: vi.fn(), // deprecated
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        const button = screen.getByText('Toggle Theme');

        // Initial state
        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');

        // Toggle to dark
        fireEvent.click(button);
        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
        expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
        expect(localStorage.getItem('theme')).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);

        // Toggle back to light
        fireEvent.click(button);
        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
        expect(localStorage.getItem('theme')).toBe('light');
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('initializes from localStorage', () => {
        localStorage.setItem('theme', 'dark');

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
