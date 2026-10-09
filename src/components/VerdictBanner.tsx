import { normalizeVerdict, verdictLabel, type Verdict } from '@/lib/verdict';

/** One distinct symbol per verdict (drawn with currentColor so it follows the banner text). */
export function VerdictIcon({ verdict, size = 22 }: { verdict: Verdict; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (verdict === 'perfection') {
    // Cut gemstone with sparkle
    return (
      <svg {...common}>
        <path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
        <path d="M2 9h20M9 3l3 6 3-6M12 21 9 9m3 12 3-12" />
      </svg>
    );
  }
  if (verdict === 'go_for_it') {
    // Rocket
    return (
      <svg {...common}>
        <path d="M5 15c-1.5 1-2 4-2 6 2 0 5-.5 6-2" />
        <path d="M12 15 9 12c.5-4 4-9 12-9 0 8-5 11.5-9 12Z" />
        <circle cx="15.5" cy="8.5" r="1.3" />
        <path d="M9 12H5l2-3h3M12 15v4l3-2v-3" />
      </svg>
    );
  }
  // Hourglass
  return (
    <svg {...common}>
      <path d="M6 2h12M6 22h12" />
      <path d="M7 2v4.5L12 12l-5 5.5V22M17 2v4.5L12 12l5 5.5V22" />
      <path d="M9.5 19h5" />
    </svg>
  );
}

interface VerdictBannerProps {
  verdict: unknown;
  /** 'full' = tag with a "Verdict" prefix (review page), 'compact' = smaller tag (feed cards, admin). */
  size?: 'full' | 'compact';
  className?: string;
}

/** Verdict shown as a gradient tag. Renders nothing for legacy / empty / unknown verdicts, so old reviews are unaffected. */
export function VerdictBanner({ verdict, size = 'full', className = '' }: VerdictBannerProps) {
  const v = normalizeVerdict(verdict);
  if (!v) return null;
  return (
    <span className={`nl-verdict nl-verdict-${v} ${size === 'compact' ? 'nl-verdict-compact' : ''} ${className}`} role="note" aria-label={`Reviewer verdict: ${verdictLabel(v)}`}>
      <span className="nl-verdict-icon"><VerdictIcon verdict={v} size={size === 'compact' ? 13 : 16} /></span>
      <span className="nl-verdict-text">
        {size === 'full' && <span className="nl-verdict-kicker">Verdict</span>}
        <span className="nl-verdict-label">{verdictLabel(v)}</span>
      </span>
    </span>
  );
}
