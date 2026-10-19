import type { SVGProps } from 'react';

/** Distinctive Taste Match mark: a thinking brain, precision search lens and golden insight spark. */
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
      <path d="M22.7 8.1c-2.9-2.4-7.1-.7-7.8 2.8-4.1.2-6.4 4.8-4.3 8.3-3.1 2.9-2.2 8.1 1.8 9.8.2 4.3 4.8 6.7 8.3 4.3 1.1 1.1 2.5 1.5 3.9 1.1V10.8c-.3-1.2-1-2.1-1.9-2.7Z" fill="#D9F8FA" stroke="#008EA4" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M25 10.8c1.3-3.1 5.6-3.7 7.8-1.1 3.4-.7 6.3 2.4 5.4 5.7 2.8 2.4 2.6 6.9-.6 8.9" fill="#BCEFF2" stroke="#008EA4" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.1 12.7c2.3 1.2 2.8 3.8 1.2 5.5-1.6 1.6-4.2 1.4-5.2 3.6M20.7 24.2c-2.5-.1-3.9 1.6-3.2 3.8M25 16.1c2.3-.2 3.5 1.4 2.9 3.3-.4 1.2-1.4 1.8-2.9 1.8" stroke="#008EA4" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="29.6" cy="28.3" r="9.2" fill="#F8FEFF" fillOpacity=".96" stroke="#464A91" strokeWidth="2.7" />
      <circle cx="29.6" cy="28.3" r="5.9" stroke="#5CE1E6" strokeWidth="1.35" />
      <path d="m36.4 35.1 6.1 6.1" stroke="#464A91" strokeWidth="4.2" strokeLinecap="round" />
      <path d="m38.2 3.9 1.5 3.7 3.7 1.5-3.7 1.5-1.5 3.7-1.5-3.7L33 9.1l3.7-1.5 1.5-3.7Z" fill="#F2BC4B" stroke="#D39A25" strokeWidth=".8" strokeLinejoin="round" />
      <circle cx="9.2" cy="34.4" r="1.5" fill="#F2BC4B" />
    </svg>
  );
}
