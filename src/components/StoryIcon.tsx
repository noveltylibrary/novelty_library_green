import type { SVGProps } from 'react';

/**
 * Stories mark: a dashed story ring that slowly turns, a bookmark ribbon with an up-arrow (post it), and a twinkling spark.
 * It reads as "a bookish story you upload" and shares no shapes with the book, star or camera icons used elsewhere.
 * Colour comes from currentColor; motion is CSS (.nl-si-*) and stops for visitors who prefer reduced motion.
 */
export function StoryIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      <circle className="nl-si-ring" cx="12" cy="12" r="10" strokeDasharray="3.2 2.6" strokeWidth="1.6" />
      <path className="nl-si-ribbon" d="M9 6.6h6a.9.9 0 0 1 .9.9v9.6l-3.9-2.5-3.9 2.5V7.5a.9.9 0 0 1 .9-.9Z" fill="currentColor" fillOpacity=".16" />
      <g className="nl-si-arrow"><path d="M12 12.6V9.2" /><path d="m10.4 10.7 1.6-1.6 1.6 1.6" /></g>
      <path className="nl-si-spark" d="M19.4 3.2l.55 1.3 1.3.55-1.3.55-.55 1.3-.55-1.3-1.3-.55 1.3-.55z" fill="currentColor" stroke="none" />
    </svg>
  );
}
