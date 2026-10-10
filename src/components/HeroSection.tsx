import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from 'framer-motion';
import { ArrowRight, PenTool } from 'lucide-react';
import { StoriesRail } from '@/components/StoriesRail';
import { HomeActionGrid } from '@/components/HomeActionGrid';

interface HeroSectionProps {
  navigate: (path: string) => void;
  /** Live directory stats (from Supabase). Falls back to static numbers until loaded. */
  live?: { accepted_total: number; authors: number; avg_form_rating?: number | null } | null;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

/** Counts from 0 up to `to` in `duration` seconds on mount. */
function Counter({ to, pad = 0, suffix = '', duration = 1.8 }: { to: number; pad?: number; suffix?: string; duration?: number }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : 0);
  const text = useTransform(value, (v) => `${String(Math.round(v)).padStart(pad, '0')}${suffix}`);
  useEffect(() => {
    if (reduce) { value.set(to); return; }
    const controls = animate(value, to, { duration, ease: 'easeOut' });
    return () => controls.stop();
  }, [to, duration, reduce, value]);
  return <motion.span>{text}</motion.span>;
}

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(20,184,166,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,184,166,0.08) 1px, transparent 1px)',
  backgroundSize: '56px 56px',
  maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 78%)',
  WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 78%)',
} as const;

const GRID_BG_LIGHT = {
  ...GRID_BG,
  backgroundImage:
    'linear-gradient(to right, rgba(13,148,136,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,148,136,0.09) 1px, transparent 1px)',
} as const;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.8  0 0 0 0 0.8  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function HeroSection({ navigate, live }: HeroSectionProps) {
  const curated = live ? Math.floor(live.accepted_total / 10) * 10 : 380;
  const trust = live?.avg_form_rating ?? null;
  const authors = live ? Math.floor(live.authors / 10) * 10 : 120;
  const reduce = useReducedMotion();

  return (
    <section className="nl-home-hero relative isolate overflow-hidden bg-gradient-to-b from-sky-50 via-cyan-50/70 to-white text-slate-900 dark:bg-none dark:text-slate-100 rounded-b-[2rem] md:rounded-b-[3rem] pt-32 pb-16 md:pt-44 md:pb-24">
      {/* Atmosphere: soft & bright in light theme, deep black in dark theme (pure CSS, GPU friendly) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Light theme */}
        <div className="absolute inset-0 dark:hidden" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 38%, rgba(103,232,249,0.35), transparent 70%)' }} />
        <motion.div
          className="absolute left-1/2 top-[34%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform dark:hidden"
          style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.28), rgba(125,211,252,0.14) 45%, transparent 70%)', filter: 'blur(30px)' }}
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 dark:hidden" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(125,211,252,0.30), transparent 70%)' }} />
        <div className="absolute inset-0 dark:hidden" style={GRID_BG_LIGHT} />

        {/* Dark theme */}
        <div className="absolute inset-0 hidden dark:block" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 38%, rgba(59,130,246,0.13), rgba(6,182,212,0.07) 45%, transparent 70%)' }} />
        <motion.div
          className="absolute left-1/2 top-[34%] hidden h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform dark:block"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.16), rgba(20,184,166,0.07) 45%, transparent 70%)', filter: 'blur(30px)' }}
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-x-0 bottom-0 hidden h-1/2 dark:block" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(8,145,178,0.10), rgba(37,99,235,0.045) 42%, transparent 70%)' }} />
        <div className="absolute inset-0 hidden dark:block" style={GRID_BG} />
        <div className="absolute inset-0 hidden opacity-[0.07] mix-blend-screen dark:block" style={{ backgroundImage: GRAIN }} />
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 text-center">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={rise} className="mb-7 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-600/25 bg-cyan-600/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 dark:bg-cyan-300 dark:shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
              Two-minute book takes that mess with your head
            </span>
          </motion.div>

          <h1 className="font-serif text-[2.6rem] font-bold leading-[1.04] tracking-tight text-slate-900 dark:text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]" aria-label="What book broke your brain this month?">
            <span aria-hidden>
              {['What', 'book'].map((w) => (
                <motion.span key={w} variants={rise} className="mr-[0.25em] inline-block">{w}</motion.span>
              ))}
              <br className="hidden sm:block" />
              {['broke', 'your', 'brain'].map((w) => (
                <motion.span key={w} variants={rise} className="mr-[0.25em] inline-block">
                  <span className="hero-shimmer bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 bg-clip-text italic text-transparent dark:from-cyan-300 dark:via-teal-300 dark:to-emerald-400 dark:drop-shadow-[0_0_20px_rgba(20,184,166,0.35)]">{w}</span>
                </motion.span>
              ))}
              <br className="hidden sm:block" />
              {['this', 'month?'].map((w, i) => (
                <motion.span key={w} variants={rise} className={`inline-block ${i === 0 ? 'mr-[0.25em]' : ''}`}>{w}</motion.span>
              ))}
            </span>
          </h1>

          <motion.p variants={rise} className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
            Novelty Library is a clean, permanent digital archive for indie readers, built so great book takes never depend on a random social feed.
          </motion.p>

          <motion.div variants={rise} className="mt-9 flex flex-nowrap items-center justify-center gap-2 sm:gap-3 home-primary-actions">
            <button
              onClick={() => navigate('/submit')}
              className="hero-cta-pulse group inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-3 py-3 sm:gap-2 sm:px-7 sm:py-3.5 text-[11px] leading-tight sm:text-sm font-semibold tracking-normal sm:tracking-wide text-slate-950 shadow-[0_0_25px_rgba(20,184,166,0.3)] transition-all duration-300 hover:from-cyan-300 hover:to-teal-300 hover:-translate-y-0.5"
            >
              <PenTool className="h-4 w-4" /> Submit Nomination
            </button>
            <button
              onClick={() => navigate('/reviews')}
              className="group inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-teal-600/30 bg-white px-3 py-3 text-[11px] leading-tight sm:gap-2 sm:px-7 sm:py-3.5 sm:text-sm font-medium tracking-normal sm:tracking-wide text-slate-800 transition-all duration-300 hover:border-cyan-500/60 hover:text-cyan-700 hover:shadow-[0_0_20px_rgba(6,182,212,0.18)] dark:border-teal-500/30 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400/60 dark:hover:text-cyan-300"
            >
              Reviews <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </motion.div>

        <div className="mt-10 text-left"><StoriesRail navigate={navigate} /></div>

        <div className="mt-6 text-left"><HomeActionGrid navigate={navigate} /></div>

        {/* Animated stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
          className="mx-auto mt-14 grid max-w-4xl grid-cols-2 overflow-hidden rounded-2xl border border-teal-600/20 bg-white/70 backdrop-blur-sm dark:border-teal-500/20 dark:bg-slate-900/60 md:grid-cols-4"
        >
          {[
            { label: 'Curated Critiques', node: <Counter to={curated} suffix="+" />, tone: 'text-cyan-700 dark:text-cyan-300' },
            { label: 'Trust Score', node: trust === null ? <span>—</span> : <div className="flex flex-col items-center justify-center"><span>{trust.toFixed(1)}/10</span><div className="hero-trust-mini"><i style={{ width: `${Math.min(100, Math.max(0, trust * 10))}%` }} /></div></div>, tone: 'text-teal-700 dark:text-teal-300' },
            { label: 'Unique Authors Cataloged', node: <Counter to={authors} suffix="+" />, tone: 'text-cyan-700 dark:text-cyan-300' },
            { label: 'Unfiltered Honesty Index', node: <Counter to={100} suffix="%" />, tone: 'text-teal-700 dark:text-teal-300' },
          ].map((m, i) => (
            <div key={m.label} className={`px-3 py-5 sm:px-4 sm:py-6 ${i % 2 === 1 ? 'border-l border-teal-600/15 dark:border-teal-500/15' : ''} ${i >= 2 ? 'border-t border-teal-600/15 dark:border-teal-500/15 md:border-t-0' : ''} ${i === 2 ? 'md:border-l md:border-teal-600/15 dark:border-teal-500/15' : ''}`}>
              <div className={`font-mono text-2xl font-semibold tabular-nums dark:drop-shadow-[0_0_12px_rgba(6,182,212,0.45)] sm:text-3xl ${m.tone}`}>{m.node}</div>
              <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{m.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
