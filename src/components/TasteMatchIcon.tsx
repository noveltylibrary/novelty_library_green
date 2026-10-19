import type { SVGProps } from 'react';

/** Minimal line-art Taste Match mark: thought/brain + search lens + insight spark. */
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
      {/* Thought / brain: intentionally unfilled, matching the clean line style of UI icons. */}
      <path
        d="M22.8 11.2a5.1 5.1 0 0 0-9.6 2.1 5.5 5.5 0 0 0-2.1 9.1 5.4 5.4 0 0 0 3.2 8.7 5.2 5.2 0 0 0 8.5 3.2V11.2Z"
        stroke="#20BFC7" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M23 11.2a5.1 5.1 0 0 1 9.6 2.1 5.5 5.5 0 0 1 2.1 9.1"
        stroke="#20BFC7" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M17 15.3c2.6 1 3.2 3.8 1.3 5.5m-4.2 2.4c2.5-.2 4.2 1.6 3.7 3.8m5-12.7c-2.1 1.2-2.4 3.1-.8 4.7"
        stroke="#20BFC7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Search lens: clean double-ring outline, offset to suggest discovery. */}
      <circle cx="30.2" cy="29.1" r="8.1" stroke="#5557A6" strokeWidth="2.4" />
      <circle cx="30.2" cy="29.1" r="4.7" stroke="#20BFC7" strokeWidth="1.5" />
      <path d="m36 35 5.1 5.1" stroke="#5557A6" strokeWidth="3.1" strokeLinecap="round" />
      {/* Small insight spark, not a filled illustration. */}
      <path d="m38.2 5.2 1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1 1.1-2.6Z" stroke="#D9A63A" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
