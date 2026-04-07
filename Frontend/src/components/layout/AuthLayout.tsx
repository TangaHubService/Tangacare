import { Outlet } from '@tanstack/react-router';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import authBg from '../../assets/auth-bg.png';

export function AuthLayout() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <div
            className="fixed inset-0 h-screen w-full flex items-center justify-center p-4 md:p-6 overflow-hidden bg-cover bg-center bg-no-repeat relative transition-colors duration-300"
            style={{ backgroundImage: `url(${authBg})` }}
        >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>

            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
                <button
                    onClick={toggleTheme}
                    className="p-2.5 md:p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all shadow-lg active:scale-95"
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            <div className="max-w-md w-full animate-in zoom-in duration-500 relative z-10 mx-auto">
                <Outlet />
            </div>
        </div>
    );
}
