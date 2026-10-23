import type { SVGProps } from 'react';

/**
 * Bespoke line-art icons for the Explore page. Uniform fine strokes in currentColor with a soft tinted fill, so they read the
 * same in teal on a card and in white on the active tab. Motion is plain CSS (see .nl-disc-* / .nl-explore-* in index.css)
 * and is switched off for visitors who prefer reduced motion.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
});

/** Discovery tab mark: a single lightning bolt. */
export function ZapIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(size)} {...props}>
      <path d="M13.5 2.5 5 13.4h5.7l-.9 8.1 8.7-11.2h-5.8l.8-7.8Z" fill="currentColor" fillOpacity=".16" />
    </svg>
  );
}

/** About tab mark: an open book. */
export function AboutTabIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" />
    </svg>
  );
}

/** Live Rankings: a three-step podium with a spark above the winner. */
export function RankingsIcon({ size = 46, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...base(size)} {...props}>
      <rect className="nl-ri-bar nl-ri-b1" x="6" y="27" width="10" height="13" rx="2" fill="currentColor" fillOpacity=".12" />
      <rect className="nl-ri-bar nl-ri-b2" x="19" y="18" width="10" height="22" rx="2" fill="currentColor" fillOpacity=".2" />
      <rect className="nl-ri-bar nl-ri-b3" x="32" y="31" width="10" height="9" rx="2" fill="currentColor" fillOpacity=".12" />
      <path d="M4 41.5h40" />
      <path className="nl-ri-spark" d="M24 4.2l1.7 3.6 3.6 1.7-3.6 1.7L24 14.8l-1.7-3.6-3.6-1.7 3.6-1.7z" fill="currentColor" fillOpacity=".25" />
    </svg>
  );
}

/** Analytics: a trust gauge that draws itself, with three rising bars inside. */
export function AnalyticsIcon({ size = 46, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...base(size)} {...props}>
      <circle cx="24" cy="24" r="17" strokeOpacity=".22" />
      <circle className="nl-ai-arc" cx="24" cy="24" r="17" pathLength="100" strokeDasharray="100" strokeDashoffset="24" transform="rotate(-90 24 24)" />
      <path className="nl-ai-bar nl-ai-b1" d="M17.5 30.5v-4.5" strokeWidth="2.6" />
      <path className="nl-ai-bar nl-ai-b2" d="M24 30.5V21.5" strokeWidth="2.6" />
      <path className="nl-ai-bar nl-ai-b3" d="M30.5 30.5V16.5" strokeWidth="2.6" />
      <circle className="nl-ai-dot" cx="41.2" cy="10.6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
