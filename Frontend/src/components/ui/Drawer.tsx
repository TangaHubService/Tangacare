import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
type DrawerPosition = 'right' | 'left';
const OVERLAY_TRANSITION_MS = 240;
const PANEL_TRANSITION_MS = 300;

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    size?: DrawerSize;
    position?: DrawerPosition;
    showOverlay?: boolean;
    closeOnOverlayClick?: boolean;
    closeOnEsc?: boolean;
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
}

const sizeClass: Record<DrawerSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full',
};

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    size = 'md',
    position = 'right',
    showOverlay = false,
    closeOnOverlayClick = true,
    closeOnEsc = true,
    headerActions,
    footer,
    children,
}) => {
    // Policy: this shared Drawer is the default shell for non-trivial create/edit/view flows.
    // Keep centered modal dialogs only for short confirmations and tiny interruptive decisions.
    const [shouldRender, setShouldRender] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const closeTimeoutRef = useRef<number | null>(null);
    const openRafRef = useRef<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (closeTimeoutRef.current) {
                window.clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
            }
            setShouldRender(true);
            if (openRafRef.current) {
                window.cancelAnimationFrame(openRafRef.current);
            }
            // Mount first, then animate to visible in next frame.
            openRafRef.current = window.requestAnimationFrame(() => {
                setIsVisible(true);
                openRafRef.current = null;
            });
            return;
        }

        setIsVisible(false);
        // Wait until the longest transition finishes before unmounting.
        closeTimeoutRef.current = window.setTimeout(() => {
            setShouldRender(false);
            closeTimeoutRef.current = null;
        }, PANEL_TRANSITION_MS + 40);
    }, [isOpen]);

    useEffect(() => {
        if (!closeOnEsc || !shouldRender) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [closeOnEsc, shouldRender, onClose]);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) {
                window.clearTimeout(closeTimeoutRef.current);
            }
            if (openRafRef.current) {
                window.cancelAnimationFrame(openRafRef.current);
            }
        };
    }, []);

    if (!shouldRender) return null;

    return (
        <>
            <div
                className={clsx(
                    'fixed inset-0 z-40 transition-opacity',
                    showOverlay ? 'bg-black/40 backdrop-blur-[1px]' : 'bg-transparent',
                    isVisible ? 'opacity-100' : 'opacity-0',
                )}
                style={{ transitionDuration: `${OVERLAY_TRANSITION_MS}ms` }}
                onClick={closeOnOverlayClick ? onClose : undefined}
            />
            <aside
                className={clsx(
                    'fixed top-0 z-50 h-full w-full bg-white dark:bg-slate-900 shadow-2xl transition-transform ease-out flex flex-col',
                    position === 'right'
                        ? 'right-0 border-l border-slate-200 dark:border-slate-700'
                        : 'left-0 border-r border-slate-200 dark:border-slate-700',
                    sizeClass[size],
                    isVisible
                        ? 'translate-x-0'
                        : position === 'right'
                          ? 'translate-x-full'
                          : '-translate-x-full',
                )}
                style={{ transitionDuration: `${PANEL_TRANSITION_MS}ms` }}
                role="dialog"
                aria-modal={showOverlay}
            >
                {(title || headerActions) && (
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                        <div>
                            {title && (
                                <h3 className="text-sm font-bold text-healthcare-dark dark:text-white">
                                    {title}
                                </h3>
                            )}
                            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            {headerActions}
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                                aria-label="Close drawer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">{children}</div>

                {footer && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                        {footer}
                    </div>
                )}
            </aside>
        </>
    );
};
