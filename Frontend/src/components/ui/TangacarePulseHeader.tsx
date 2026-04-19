import { motion, useReducedMotion } from 'framer-motion';
import logo from '../../assets/tanga-logo.png';

const APP_NAME = 'TangaCare';

/**
 * Minimal branded loader: accent line, logo, animated name, tagline, five bars, LOADING.
 * Transparent — no background panel.
 */
export function TangacarePulseHeader({ compact }: { compact?: boolean }) {
    const reduceMotion = useReducedMotion();
    const letters = APP_NAME.split('');
    const barDelays = [0, 0.1, 0.2, 0.3, 0.4];
    const barScale: [number, number, number] = compact ? [0.4, 0.85, 0.4] : [0.35, 1, 0.35];

    return (
        <div className="flex flex-col items-center text-center px-2">
            <motion.div
                className={`rounded-full bg-emerald-400 ${compact ? 'mb-4 h-0.5 w-10' : 'mb-5 h-0.5 w-12'}`}
                initial={{ opacity: 0.6, scaleX: 0.7 }}
                animate={reduceMotion ? {} : { opacity: [0.55, 1, 0.55], scaleX: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
                className={`mb-4 ${compact ? 'h-12 w-12' : 'h-14 w-14 sm:h-16 sm:w-16'}`}
                animate={reduceMotion ? {} : { y: [0, -3, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
                <img src={logo} alt="" className="h-full w-full object-contain drop-shadow-sm" />
            </motion.div>

            <div className="mb-1 flex flex-wrap justify-center gap-px select-none">
                {letters.map((char, i) => {
                    const isCare = i >= 5;
                    return (
                        <motion.span
                            key={`${char}-${i}`}
                            className={`inline-block font-black tracking-tight ${
                                compact ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl'
                            } ${isCare ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-zinc-100'}`}
                            animate={reduceMotion ? {} : { y: [0, -8, 0] }}
                            transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: reduceMotion ? 0 : i * 0.06,
                            }}
                        >
                            {char}
                        </motion.span>
                    );
                })}
            </div>

            <p
                className={`font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-zinc-400 ${
                    compact ? 'mb-5 text-[9px]' : 'mb-6 text-[10px] sm:text-[11px]'
                }`}
            >
                Your health, our care
            </p>

            <div className={`mb-5 flex items-end justify-center gap-1 ${compact ? 'h-8' : 'h-10'}`}>
                {barDelays.map((delay, i) => (
                    <motion.div
                        key={i}
                        className="w-1.5 rounded-full bg-emerald-400 origin-bottom"
                        style={{ height: compact ? 22 : 28 }}
                        animate={reduceMotion ? { scaleY: 0.65 } : { scaleY: barScale }}
                        transition={{
                            duration: 0.72,
                            repeat: reduceMotion ? 0 : Infinity,
                            ease: 'easeInOut',
                            delay: reduceMotion ? 0 : delay,
                        }}
                    />
                ))}
            </div>

            <motion.p
                className={`font-bold uppercase tracking-[0.35em] text-emerald-500 dark:text-emerald-400 ${
                    compact ? 'text-[9px]' : 'text-[10px]'
                }`}
                animate={reduceMotion ? {} : { opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
                Loading
            </motion.p>
        </div>
    );
}
