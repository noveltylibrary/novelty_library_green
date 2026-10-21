import type { CSSProperties } from 'react';
import { sanitizeUserText } from '@/lib/sanitize';

const HONORIFICS = new Set(['sir', 'madam', 'madame', 'mr', 'mrs', 'miss', 'ms', 'mx', 'dr', 'prof', 'professor', 'lord', 'lady', 'dame', 'rev', 'reverend', 'fr', 'father', 'sister', 'brother', 'capt', 'captain', 'col', 'colonel', 'gen', 'general', 'sgt', 'major', 'maj', 'lt', 'hon', 'judge', 'sheikh', 'sri', 'shri', 'smt', 'kumari', 'pt', 'baron', 'baroness', 'count', 'countess', 'duke', 'duchess', 'saint', 'st']);
const isHonorific = (w: string) => HONORIFICS.has(w.toLowerCase().replace(/\./g, ''));

/** Splits a leading title ("Sir", "Mrs.", "Dr") off the name so it is never treated as the first name. */
export function parseName(full: string): { title: string; first: string; rest: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  const titles: string[] = [];
  while (parts.length > 1 && isHonorific(parts[0])) titles.push(parts.shift() as string);
  return { title: titles.join(' '), first: parts[0] || '', rest: parts.slice(1).join(' ') };
}

/** "Anna Maria de la Cruz" -> first "Anna", rest "Maria de la Cruz". Titles are skipped. */
export function splitName(full: string): { first: string; rest: string } {
  const { first, rest } = parseName(full);
  return { first, rest };
}

const PARTICLES = new Set(['de', 'del', 'della', 'di', 'da', 'dos', 'das', 'du', 'van', 'von', 'der', 'den', 'ter', 'ten', 'la', 'le', 'el', 'al', 'bin', 'ibn', 'bint', 'st', 'mac']);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md']);

/** Title + given names + surname, for people who are known by their surname (Dostoyevsky, Doyle). */
export function parseSurname(full: string): { title: string; given: string; surname: string } {
  const { title, first, rest } = parseName(full);
  const parts = [first, ...rest.split(/\s+/)].filter(Boolean);
  if (parts.length < 2) return { title, given: '', surname: parts[0] || '' };
  let end = parts.length;
  const suffix: string[] = [];
  while (end > 2 && SUFFIXES.has(parts[end - 1].toLowerCase().replace(/[.,]/g, ''))) suffix.unshift(parts[--end]);
  let start = end - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase().replace(/\./g, ''))) start--;
  return { title, given: parts.slice(0, start).join(' '), surname: [...parts.slice(start, end), ...suffix].join(' ') };
}

/** Letter for avatars: first letter of the first name, never of a title. */
export function nameInitial(full: string, fallback = 'A', lead: 'first' | 'last' = 'first'): string {
  const clean = sanitizeUserText(full, 120);
  const letter = lead === 'last' ? parseSurname(clean).surname.charAt(0) : parseName(clean).first.charAt(0);
  return (letter || fallback).toUpperCase();
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
 * Full name for profile cards and headers. One part of the name is large and the rest is set smaller beside it
 * (wrapping inside its own column when needed), so long full names no longer eat the whole card.
 * `major="first"` (readers): first name large, middle name(s) + surname small after it.
 * `major="last"` (authors, who are usually known by surname, e.g. Dostoyevsky): given names small first, surname large.
 * A leading title (Sir, Madam, Dr…) is always small. `size` is the full-size pixel font of a short large part.
 */
export function NameBlock({ name, size, color = '#fff', restColor = 'rgba(255,255,255,.82)', shadow, className = 'font-serif', style, major = 'first' }: {
  name: string; size: number; color?: string; restColor?: string; shadow?: string; className?: string; style?: CSSProperties; major?: 'first' | 'last';
}) {
  const clean = sanitizeUserText(name, 120);
  const parsed = parseName(clean);
  const sn = parseSurname(clean);
  const bigText = major === 'last' ? sn.surname : parsed.first;
  const smallText = major === 'last' ? sn.given : parsed.rest;
  const bigSize = Math.max(14, size * firstNameScale(bigText));
  const smallSize = Math.max(11, Math.min(size * restScale(smallText), bigSize * 0.62));
  const title = parsed.title && (
    <span key="t" style={{ flex: '0 0 auto', fontSize: Math.max(11, Math.min(size * 0.34, bigSize * 0.4)), fontWeight: 600, letterSpacing: '.04em', lineHeight: 1.1, color: restColor, textShadow: shadow, opacity: .85, alignSelf: 'flex-end', paddingBottom: '.18em' }}>{parsed.title}</span>
  );
  const big = (
    <h2 key="b" style={{ margin: 0, flex: '0 1 auto', minWidth: 0, maxWidth: '100%', fontSize: bigSize, fontWeight: 700, lineHeight: 1.12, color, textShadow: shadow, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingBottom: '.06em' }}>{bigText}</h2>
  );
  const small = smallText && (
    <span key="s" style={{ flex: `1 1 ${Math.round(smallSize * 4.2)}px`, minWidth: 0, fontSize: smallSize, fontWeight: 700, lineHeight: 1.14, color: restColor, textShadow: shadow, overflowWrap: 'anywhere', ...(major === 'last' ? { flexGrow: 0 } : null) }}>{smallText}</span>
  );
  return (
    <div className={className} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: Math.max(6, bigSize * 0.2), rowGap: 0, minWidth: 0, maxWidth: '100%', ...style }}>
      {title}
      {major === 'last' ? [small, big] : [big, small]}
    </div>
  );
}
