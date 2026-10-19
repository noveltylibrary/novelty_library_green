import { useId } from 'react';

interface AnimatedBookProps {
  size?: number;
  /** Play the pop-up entrance. */
  pop?: boolean;
  /** Keep flipping pages in a loop. */
  loop?: boolean;
  className?: string;
}

/**
 * Cyan/teal open-book icon. Colours come from CSS variables that switch
 * automatically with the app theme (.dark class), so it is always legible in
 * both light and dark mode. Animation: pops up, then pages flip, sparkles twinkle.
 */
export function AnimatedBook({ size = 120, pop = true, loop = true, className = '' }: AnimatedBookProps) {
  const uid = useId().replace(/:/g, '');
  const classes = ['nl-book', pop ? 'nl-book-pop' : '', loop ? 'nl-book-loop' : '', className].filter(Boolean).join(' ');

  return (
    <svg
      className={classes}
      width={size}
      height={size * (100 / 120)}
      viewBox="0 0 120 100"
      role="img"
      aria-label="Novelty Library book"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${uid}-cover`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--bk-cover-a)" />
          <stop offset="1" stopColor="var(--bk-cover-b)" />
        </linearGradient>
      </defs>

      {/* soft glow + shadow */}
      <ellipse className="nl-book-glow" cx="60" cy="90" rx="38" ry="5" fill="var(--bk-glow)" />

      {/* cover */}
      <path d="M8 30 Q34 22 60 32 Q86 22 112 30 L112 80 Q86 72 60 82 Q34 72 8 80 Z" fill={`url(#${uid}-cover)`} />

      {/* left page */}
      <path d="M14 32 Q36 26 60 35 L60 80 Q36 72 14 78 Z" fill="var(--bk-page)" />
      {/* right page */}
      <path d="M106 32 Q84 26 60 35 L60 80 Q84 72 106 78 Z" fill="var(--bk-page-2)" />

      {/* text lines */}
      <g stroke="var(--bk-line)" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
        <path d="M22 44 Q38 40 53 46" /><path d="M22 52 Q38 48 53 54" /><path d="M22 60 Q38 56 53 62" />
        <path d="M67 46 Q82 40 98 44" /><path d="M67 54 Q82 48 98 52" /><path d="M67 62 Q82 56 98 60" />
      </g>

      {/* flipping page (hinged at the spine) */}
      <g className="nl-book-flip">
        <path d="M60 35 Q84 26 106 32 L106 78 Q84 72 60 80 Z" fill="var(--bk-page-flip)" stroke="var(--bk-line)" strokeWidth="0.6" strokeOpacity="0.5" />
        <path d="M67 46 Q82 40 98 44" stroke="var(--bk-line)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" fill="none" />
        <path d="M67 54 Q82 48 98 52" stroke="var(--bk-line)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" fill="none" />
      </g>

      {/* spine + bookmark ribbon */}
      <path d="M60 33 L60 82" stroke="var(--bk-spine)" strokeWidth="1.8" />
      <path className="nl-book-ribbon" d="M72 33 L72 55 L77 50 L82 55 L82 31 Z" fill="var(--bk-accent)" />

      {/* sparkles */}
      <g fill="var(--bk-accent)">
        <path className="nl-spark nl-spark-1" d="M22 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
        <path className="nl-spark nl-spark-2" d="M96 8 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" />
        <path className="nl-spark nl-spark-3" d="M60 6 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3z" />
      </g>
    </svg>
  );
}
