import type { SVGProps } from 'react';

/** Compact line-art mark for thoughtful, preference-led book discovery. */
export function TasteMatchIcon({ size = 28, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      focusable="false"
      aria-hidden="true"
      {...props}
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* One continuous, readable brain silhouette with a central fold. */}
        <path
          d="M22.8 13.2c-.2-3.1-2.5-5.2-5.4-5.2-3.2 0-5.5 2.6-5.2 5.6-3.1 1.2-4.4 4.8-2.5 7.5-2.1 2.9-.9 6.8 2.2 8.1-.2 3.4 2.6 5.8 5.7 5.2 1.4 1.6 3.4 2.1 5.2 1.2V13.2Z"
          stroke="currentColor"
          strokeWidth="2.1"
        />
        <path
          d="M24.2 13.2c.2-3.1 2.5-5.2 5.4-5.2 3.2 0 5.5 2.6 5.2 5.6 3.1 1.2 4.4 4.8 2.5 7.5 1.1 1.5 1.3 3.4.6 5"
          stroke="currentColor"
          strokeWidth="2.1"
        />
        <path
          d="M17 13.7c2.4.8 3.4 3.4 2.1 5.4m-5.5 2.7c2.8-.1 4.7 2 4.1 4.5m5.1-10.1c-1.7 1.1-2 3-.6 4.3"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        {/* A single clear lens reads as search, not a second decorative ring. */}
        <circle cx="31.1" cy="30.2" r="7.1" stroke="currentColor" strokeWidth="2.3" />
        <path d="m36.2 35.3 5 5" stroke="currentColor" strokeWidth="3" />
        {/* Small insight spark, rendered monochrome like the other shortcut icons. */}
        <path d="m39 5.5.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" stroke="currentColor" strokeWidth="1.4" />
      </g>
    </svg>
  );
}
