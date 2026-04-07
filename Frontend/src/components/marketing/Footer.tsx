import { Link } from '@tanstack/react-router';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
    const supportLinks = [
        { label: 'Contact', href: '#contact' },
        { label: 'Privacy Policy', to: '/privacy-policy' as const },
        { label: 'Terms of Use', to: '/terms-of-use' as const },
        { label: 'Documentation', to: '/docs' as const },
    ];

    return (
        <footer className="bg-white dark:bg-black border-t border-slate-200 dark:border-zinc-800 pt-20 pb-10 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                                <img
                                    src="/logo.png"
                                    alt="TangaCare"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                                TangaCare
                            </span>
                        </Link>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed font-medium max-w-xs">
                            Revolutionizing healthcare inventory management with AI-driven tracking
                            and multi-location control.
                        </p>
                        <div className="flex gap-4">
                            {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-900 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all"
                                >
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-bold mb-6">Product</h4>
                        <ul className="space-y-4">
                            {['Features', 'How It Works', 'Pricing', 'FAQ'].map((item) => (
                                <li key={item}>
                                    <a
                                        href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                                        className="text-slate-500 dark:text-zinc-400 text-sm font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                    >
                                        {item}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-bold mb-6">Support</h4>
                        <ul className="space-y-4">
                            {supportLinks.map((item) => (
                                <li key={item.label}>
                                    {'to' in item ? (
                                        <Link
                                            to={item.to as any}
                                            search={{} as any}
                                            className="text-slate-500 dark:text-zinc-400 text-sm font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                        >
                                            {item.label}
                                        </Link>
                                    ) : (
                                        <a
                                            href={item.href}
                                            className="text-slate-500 dark:text-zinc-400 text-sm font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                        >
                                            {item.label}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-bold mb-6">
                            Contact Us
                        </h4>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3 text-sm font-medium text-slate-500 dark:text-zinc-400">
                                <Mail size={18} className="text-teal-600 flex-shrink-0" />
                                <span>hello@tangacare.io</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm font-medium text-slate-500 dark:text-zinc-400">
                                <Phone size={18} className="text-teal-600 flex-shrink-0" />
                                <span>+1 (555) 123-4567</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm font-medium text-slate-500 dark:text-zinc-400">
                                <MapPin size={18} className="text-teal-600 flex-shrink-0" />
                                <span>
                                    123 Health Ave, Suite 100
                                    <br />
                                    San Francisco, CA 94103
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="pt-10 border-t border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-sm text-slate-400 dark:text-zinc-600 font-medium">
                        © {new Date().getFullYear()} TangaCare Inc. All rights reserved.
                    </p>
                    <div className="flex gap-8 text-xs font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">
                        <a href="#" className="hover:text-teal-600 transition-colors">
                            Twitter
                        </a>
                        <a href="#" className="hover:text-teal-600 transition-colors">
                            LinkedIn
                        </a>
                        <a href="#" className="hover:text-teal-600 transition-colors">
                            GitHub
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
