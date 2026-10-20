import type { CSSProperties } from 'react';
import { sanitizeUserText } from '@/lib/sanitize';

/** "Anna Maria de la Cruz" -> first "Anna", rest "Maria de la Cruz". */
export function splitName(full: string): { first: string; rest: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', rest: parts.slice(1).join(' ') };
}

/** The first name stays big; it only steps down when it is itself long (1 = full size). */
export function firstNameScale(first: string): number {
  const n = [...first].length;
  return n <= 7 ? 1 : n <= 9 ? 0.86 : n <= 11 ? 0.74 : n <= 13 ? 0.64 : n <= 16 ? 0.54 : n <= 20 ? 0.46 : 0.38;
}

/** Middle name + surname: a smaller secondary size that also steps down when the rest is long. */
function restScale(rest: string): number {
  const n = [...rest].length;
  return n <= 10 ? 0.52 : n <= 18 ? 0.45 : n <= 28 ? 0.38 : 0.32;
}

/**
 * Full name for profile cards and headers. The first name is large; the middle name(s) and surname are set
 * smaller beside it (wrapping onto a second line inside their own column when needed), so long full names no
 * longer eat the whole card. `size` is the full-size pixel font of a short first name.
 */
export function NameBlock({ name, size, color = '#fff', restColor = 'rgba(255,255,255,.82)', shadow, className = 'font-serif', style }: {
  name: string; size: number; color?: string; restColor?: string; shadow?: string; className?: string; style?: CSSProperties;
}) {
  const clean = sanitizeUserText(name, 120);
  const { first, rest } = splitName(clean);
  const firstSize = Math.max(14, size * firstNameScale(first));
  const restSize = Math.max(11, Math.min(size * restScale(rest), firstSize * 0.62));
  return (
    <div className={className} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: Math.max(6, firstSize * 0.2), rowGap: 0, minWidth: 0, maxWidth: '100%', ...style }}>
      <h2 style={{ margin: 0, flex: '0 1 auto', minWidth: 0, maxWidth: '100%', fontSize: firstSize, fontWeight: 700, lineHeight: 1.12, color, textShadow: shadow, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingBottom: '.06em' }}>{first}</h2>
      {rest && <span style={{ flex: `1 1 ${Math.round(restSize * 4.2)}px`, minWidth: 0, fontSize: restSize, fontWeight: 700, lineHeight: 1.14, color: restColor, textShadow: shadow, overflowWrap: 'anywhere' }}>{rest}</span>}
    </div>
  );
}
