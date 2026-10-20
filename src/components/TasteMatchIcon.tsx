import { useId, type SVGProps } from 'react';

/**
 * Taste Match mark, drawn on a 48 x 48 grid: an organic two-lobed mind, a lens resting over it, and one curved spark.
 * Uniform fine strokes in currentColor (soft tinted fills), so it reads the same in white on a button and in teal on a card.
 * The geometry is exported so the coloured page emblem is built from the very same curves.
 */
export const TM_GEO = {
  left: 'M19 9.6C16.6 7 12 7.5 10.5 10.9 7.5 11.1 5.7 14.2 6.8 17 4.8 18.8 4.9 22 7.1 23.7 6.5 26.5 8.4 29.1 11.2 29.5 12.6 31.9 16 32.7 19 30.9',
  right: 'M19 9.6C21.4 7 26 7.5 27.5 10.9 30.5 11.1 32.3 14.2 31.2 17 33.2 18.8 33.1 22 30.9 23.7 31.5 26.5 29.6 29.1 26.8 29.5 25.4 31.9 22 32.7 19 30.9',
  fissure: 'M19 9.6C18.2 13 19.9 15.2 19.1 18.6 18.4 21.6 19.7 24.2 19 30.9',
  gyri: [
    'M10.5 10.9C12.1 12.5 12.3 14.6 10.7 16.1',
    'M6.8 17C9.3 17 11 18.4 11.5 20.5',
    'M7.1 23.7C9.2 22.7 11.7 23.5 12.5 25.6',
    'M15.5 13.4C14.5 15 15.1 16.9 16.8 17.7',
    'M13.2 29.3C14 27.5 15.7 26.6 17.3 27',
    'M27.5 10.9C25.9 12.5 25.7 14.6 27.3 16.1',
    'M22.5 14C23.7 15.1 23.7 16.9 22.5 18.1',
    'M31.2 17C28.7 17 27 18.4 26.5 20.5',
  ],
  lens: { cx: 32.6, cy: 31.6, r: 6.4 },
  handle: 'M37.3 36.3L42.2 41.2',
  glint: 'M29.2 29.6a4.1 4.1 0 0 1 3.1-2.2',
  spark: 'M39.2 3.4C39.6 6.5 40.6 7.6 43.8 9 40.6 10.4 39.6 11.5 39.2 14.6 38.8 11.5 37.8 10.4 34.6 9 37.8 7.6 38.8 6.5 39.2 3.4Z',
  dot: { cx: 44.2, cy: 17.2, r: 1.1 },
} as const;

export function TasteMatchIcon({ size = 28, animate = false, className, ...props }: SVGProps<SVGSVGElement> & { size?: number; animate?: boolean }) {
  const maskId = useId().replace(/:/g, '');
  const g = TM_GEO;
  return (
    <svg
      viewBox="2 1 43 43"
      width={size}
      height={size}
      fill="none"
      focusable="false"
      aria-hidden="true"
      className={`${animate ? 'tm-icon-live ' : ''}${className ?? ''}`.trim() || undefined}
      {...props}
    >
      <defs>
        {/* The lens sits over the mind: a soft gap keeps the two shapes distinct without a background colour. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <circle cx={g.lens.cx} cy={g.lens.cy} r={g.lens.r + 2.3} fill="#000" />
        </mask>
      </defs>
      <g strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <g className="tm-i-brain" mask={`url(#${maskId})`}>
          <path d={`${g.left}${g.right}`} fill="currentColor" fillOpacity=".09" stroke="none" />
          <path d={g.left} strokeWidth="2.15" />
          <path d={g.right} strokeWidth="2.15" />
          <path d={g.fissure} strokeWidth="1.7" />
          <path d={g.gyri.join('')} strokeWidth="1.55" strokeOpacity=".85" />
        </g>
        <g className="tm-i-lens">
          <circle cx={g.lens.cx} cy={g.lens.cy} r={g.lens.r} fill="currentColor" fillOpacity=".12" strokeWidth="2.25" />
          <path d={g.glint} strokeWidth="1.45" strokeOpacity=".85" />
          <path d={g.handle} strokeWidth="3" />
        </g>
        <g className="tm-i-spark">
          <path d={g.spark} fill="currentColor" stroke="none" />
          <circle cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r} fill="currentColor" stroke="none" opacity=".75" />
        </g>
      </g>
    </svg>
  );
}

/** Full-colour emblem for the Taste Match page hero, built from the same curves with gradient strokes and orbiting "spice" dots. */
export function TasteMatchEmblem() {
  const id = useId().replace(/:/g, '');
  const g = TM_GEO;
  const orbit: [number, number, number, string][] = [[24, 3.2, 3.4, '#f4be54'], [40, 24.6, 2.4, '#8b5cf6'], [9, 40, 2.8, '#38c7d7'], [3.5, 14, 1.9, '#f08fa8'], [26, 45, 2.1, '#f4be54']];
  return (
    <svg className="tm-emblem" viewBox="-2 -2 52 52" role="img" aria-label="Taste Match: a thoughtful mind, a searching lens and a spark">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0ea5b7" /><stop offset="1" stopColor="#6d5ce7" /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8fbf4" /><stop offset="1" stopColor="#c7c9ff" /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".95" /><stop offset="1" stopColor="#b9c4ff" stopOpacity=".7" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe9a3" /><stop offset="1" stopColor="#f2a93b" /></linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="-2" y="-2" width="52" height="52">
          <rect x="-2" y="-2" width="52" height="52" fill="#fff" />
          <circle cx={g.lens.cx} cy={g.lens.cy} r={g.lens.r + 2.3} fill="#000" />
        </mask>
      </defs>
      <g className="tm-e-orbit">{orbit.map(([cx, cy, r, c], i) => <circle key={i} className="tm-e-dot" style={{ animationDelay: `${i * 0.55}s` }} cx={cx} cy={cy} r={r} fill={c} />)}</g>
      <g className="tm-e-brain" mask={`url(#${id}m)`} strokeLinecap="round" strokeLinejoin="round">
        <path className="tm-e-fill" d={`${g.left}${g.right}`} fill={`url(#${id}f)`} stroke="none" />
        <path className="tm-e-draw" pathLength={1} d={g.left} stroke={`url(#${id}b)`} strokeWidth="2.2" />
        <path className="tm-e-draw" pathLength={1} d={g.right} stroke={`url(#${id}b)`} strokeWidth="2.2" />
        <path className="tm-e-draw tm-e-d2" pathLength={1} d={g.fissure} stroke={`url(#${id}b)`} strokeWidth="1.7" />
        {g.gyri.map((d, i) => <path key={i} className="tm-e-draw tm-e-d3" style={{ animationDelay: `${0.9 + i * 0.09}s` }} pathLength={1} d={d} stroke={`url(#${id}b)`} strokeWidth="1.55" strokeOpacity=".8" />)}
      </g>
      <g className="tm-e-lens" strokeLinecap="round">
        <circle cx={g.lens.cx} cy={g.lens.cy} r={g.lens.r} fill={`url(#${id}l)`} stroke={`url(#${id}b)`} strokeWidth="2.3" />
        <path className="tm-e-glint" d={g.glint} stroke="#fff" strokeWidth="1.6" />
        <path d={g.handle} stroke={`url(#${id}b)`} strokeWidth="3.1" />
      </g>
      <g className="tm-e-spark">
        <path d={g.spark} fill={`url(#${id}s)`} />
        <circle cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r + 0.3} fill="#f2a93b" />
      </g>
    </svg>
  );
}
