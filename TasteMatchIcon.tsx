import type { SVGProps } from 'react';

/**
 * Taste Match AI mark: a bold, flat line-style search lens with an AI sparkle inside and a
 * secondary spark. Pure SVG, single colour (currentColor) so it matches the other home icons in
 * light and dark mode and on any background. No gradients, no cartoon fills.
 */
export function TasteMatchIcon({ size = 28, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
      {...props}
    >
      {/* search lens + handle */}
      <circle cx="21" cy="22" r="14.5" strokeWidth="3.2" />
      <path d="m31.8 32.8 10.2 10.2" strokeWidth="5" />
      {/* AI sparkle inside the lens */}
      <path className="nl-tm-spark" d="M21 11.5c.9 5.6 3.9 8.6 9.5 9.5-5.6.9-8.6 3.9-9.5 9.5-.9-5.6-3.9-8.6-9.5-9.5 5.6-.9 8.6-3.9 9.5-9.5Z" fill="currentColor" strokeWidth="1.4" />
      {/* secondary spark */}
      <path className="nl-tm-spark nl-tm-spark-b" d="M38.5 3.5c.5 3.3 2 4.8 5.3 5.3-3.3.5-4.8 2-5.3 5.3-.5-3.3-2-4.8-5.3-5.3 3.3-.5 4.8-2 5.3-5.3Z" fill="currentColor" strokeWidth="1" />
    </svg>
  );
}
