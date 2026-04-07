import { Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { isDark, toggleTheme } = useTheme();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Features', href: '#features' },
        { name: 'How It Works', href: '#how-it-works' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'FAQ', href: '#faq' },
        { name: 'Docs', to: '/docs' as const },
        { name: 'Privacy', to: '/privacy-policy' as const },
        { name: 'Contact', href: '#contact' },
    ];

    const { user, logout } = useAuth();

    return (
        <header
            className={cn(
                'fixed top-0 w-full z-50 transition-all duration-500',
                isScrolled
                    ? 'bg-white/85 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-800 shadow-lg shadow-black/5 py-2'
                    : 'bg-transparent py-3',
            )}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                <Link to="/" className="z-50 flex items-center gap-3 group">
                    <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                        <img
                            src="/logo.png"
                            alt="TangaCare"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white lg:text-2xl">
                        TangaCare
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-2">
                    {navLinks.map((link) =>
                        link.to ? (
                            <Link
                                key={link.name}
                                to={link.to as any}
                                search={{} as any}
                                className="text-sm font-semibold px-3 py-1.5 rounded-full text-slate-700 hover:text-teal-600 hover:bg-teal-50/50 transition-all dark:text-zinc-300 dark:hover:text-teal-400 dark:hover:bg-teal-900/20"
                            >
                                {link.name}
                            </Link>
                        ) : (
                            <a
                                key={link.name}
                                href={link.href}
                                className="text-sm font-semibold px-3 py-1.5 rounded-full text-slate-700 hover:text-teal-600 hover:bg-teal-50/50 transition-all dark:text-zinc-300 dark:hover:text-teal-400 dark:hover:bg-teal-900/20"
                            >
                                {link.name}
                            </a>
                        ),
                    )}
                </nav>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-3">
                    {user ? (
                        <>
                            <Link to={'/app' as any} search={{} as any}>
                                <Button
                                    variant="outline"
                                    className="font-bold border-teal-600/50 text-teal-600 hover:bg-teal-50 dark:border-teal-400/30 dark:text-teal-400 dark:hover:bg-teal-900/20 rounded-full px-5 h-9 text-xs transition-all shadow-sm"
                                >
                                    Go to Dashboard
                                </Button>
                            </Link>
                            <Button
                                onClick={() => logout()}
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 rounded-full px-5 h-9 text-xs font-bold transition-all"
                            >
                                Logout
                            </Button>
                        </>
                    ) : (
                        <>
                            <Link to={'/auth/login' as any} search={{} as any}>
                                <Button
                                    variant="ghost"
                                    className="font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full px-4 h-9 text-xs transition-all"
                                >
                                    Log in
                                </Button>
                            </Link>
                            <Link to={'/subscribe' as any} search={{} as any}>
                                <Button className="shadow-xl shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white rounded-full px-6 font-bold h-9 text-xs transition-all hover:scale-105 active:scale-95">
                                    Get Started
                                </Button>
                            </Link>
                        </>
                    )}
                    <div className="h-5 w-px bg-slate-200 dark:border-zinc-800 mx-1"></div>
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-zinc-400 transition-all active:scale-90"
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden z-50 p-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 active:scale-90 transition-all"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>

                {/* Mobile Menu Overlay */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="absolute top-0 left-0 w-full h-screen bg-white dark:bg-black border-b border-slate-200 dark:border-zinc-800 shadow-2xl p-6 flex flex-col pt-32 md:hidden"
                        >
                            <nav className="flex flex-col gap-2">
                                {navLinks.map((link) =>
                                    link.to ? (
                                        <Link
                                            key={link.name}
                                            to={link.to as any}
                                            search={{} as any}
                                            className="text-2xl font-bold text-slate-900 dark:text-white px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {link.name}
                                        </Link>
                                    ) : (
                                        <a
                                            key={link.name}
                                            href={link.href}
                                            className="text-2xl font-bold text-slate-900 dark:text-white px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {link.name}
                                        </a>
                                    ),
                                )}
                            </nav>
                            <div className="mt-auto space-y-4 mb-10">
                                {user ? (
                                    <>
                                        <Link
                                            to={'/app' as any}
                                            search={{} as any}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="block w-full"
                                        >
                                            <Button className="w-full h-14 rounded-2xl text-lg font-bold bg-teal-600 hover:bg-teal-700 shadow-xl shadow-teal-600/20">
                                                Go to Dashboard
                                            </Button>
                                        </Link>
                                        <Button
                                            onClick={() => {
                                                logout();
                                                setIsMobileMenuOpen(false);
                                            }}
                                            variant="outline"
                                            className="w-full h-14 rounded-2xl text-lg font-bold border-red-200 text-red-600 dark:border-red-900/30 dark:text-red-400"
                                        >
                                            Logout
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to={'/auth/login' as any}
                                            search={{} as any}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="block w-full"
                                        >
                                            <Button
                                                variant="outline"
                                                className="w-full h-14 rounded-2xl text-lg font-bold"
                                            >
                                                Log in
                                            </Button>
                                        </Link>
                                        <Link
                                            to={'/subscribe' as any}
                                            search={{} as any}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="block w-full"
                                        >
                                            <Button className="w-full h-14 rounded-2xl text-lg font-bold bg-teal-600 hover:bg-teal-700 shadow-xl shadow-teal-600/20">
                                                Get Started
                                            </Button>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </header>
    );
}
