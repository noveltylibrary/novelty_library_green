import type { SearchBook } from '@/lib/rankingSearch';
import { cleanTraits } from '@/lib/rankingSearch';
import { readBehaviour } from '@/lib/enigma/behaviour';
import { cosine, vectorOf, type TasteVec } from '@/lib/enigma/taste';

/**
 * Everything the matching engine knows about the reader right now. Built in the browser from: their device, the content
 * preferences and profile they filled in on Novelty Library, their saved and own reviews, and how past puzzles went.
 */
export interface EnigmaInput {
  readerKey: string;
  signedIn: boolean;
  /** Content-preference trait labels the reader ticked in settings. */
  prefLabels: string[];
  /** Profile: favourite book / author / genre, currently reading, shelves, display tags (plain text). */
  profileText: string[];
  /** Reviews the reader saved or wrote (published catalogue rows). */
  history: SearchBook[];
  /** The published catalogue. */
  catalogue: SearchBook[];
  /** Reader's Taste Match controls (Account → Content preferences → Taste Match). Missing means allowed. */
  allow?: { device: boolean; browser: boolean };
}

export interface Signals {
  readerKey: string;
  signedIn: boolean;
  taste: TasteVec;
  /** Search subjects, strongest first (e.g. "thriller", "found family"). */
  subjects: string[];
  catalogue: SearchBook[];
  /** Share of rounds that should lean on book-associated material (never all of them). */
  bookish: number;
  struggling: boolean;
  cruising: boolean;
  device: { lang: string; touch: boolean; hour: number };
  behaviour: ReturnType<typeof readBehaviour>;
}

const MOOD_BY_HOUR = (h: number): string => (h >= 22 || h < 5 ? 'dark mystery' : h < 12 ? 'light adventure' : h < 18 ? 'classic literary' : 'romance drama');

export function buildSignals(input: EnigmaInput, struggling: boolean, cruising: boolean): Signals {
  const behaviour = readBehaviour(input.readerKey);
  const useDevice = input.allow?.device !== false;
  const useBrowser = input.allow?.browser !== false;
  const hour = new Date().getHours();
  // Switched-off sources are replaced with neutral values, so nothing about them reaches the matching.
  const device = {
    lang: useBrowser ? (typeof navigator !== 'undefined' && navigator.language) || 'en' : 'en',
    touch: useDevice && typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0),
    hour: useDevice ? hour : 12,
  };

  const taste: TasteVec = new Map();
  input.prefLabels.forEach((t) => vectorOf(t, 2.2, taste));
  input.profileText.forEach((t) => vectorOf(t, 2.5, taste));
  input.history.forEach((b) => { vectorOf(`${b.genre} ${b.traits}`, 1.6, taste); vectorOf(b.title, 0.4, taste); });
  if (useDevice) vectorOf(MOOD_BY_HOUR(hour), 0.35, taste); // the time of day only nudges
  if (useBrowser) for (const [id, w] of Object.entries(behaviour.concepts)) taste.set(`c:${id}`, (taste.get(`c:${id}`) ?? 0) + w * 0.5);

  // Subjects to search for, strongest first: genre / trait phrases of what they read, then their stated preferences.
  const counts = new Map<string, number>();
  const bump = (s: string, w: number) => { const k = s.trim().toLowerCase(); if (k.length >= 3 && k.length <= 28) counts.set(k, (counts.get(k) ?? 0) + w); };
  input.prefLabels.forEach((t) => bump(t, 3));
  input.history.forEach((b) => { b.genre.split(/[,;/|]+/).forEach((g) => bump(g, 2)); cleanTraits(b.traits).split(/[,;/|]+/).forEach((g) => bump(g, 1.5)); });
  input.profileText.forEach((t) => t.split(/[,;/|]+/).forEach((g) => bump(g, 2)));
  let subjects = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s).slice(0, 8);
  if (!subjects.length) subjects = ['fantasy', 'mystery', 'classic literature', 'romance'].sort(() => Math.random() - 0.5);

  // Book-associated share: leans on books for readers we know well, but never always.
  const known = Math.min(1, taste.size / 40);
  let bookish = 0.45 + 0.25 * known;
  if (struggling) bookish -= 0.1;
  bookish = Math.max(0.3, Math.min(0.72, bookish));

  return { readerKey: input.readerKey, signedIn: input.signedIn, taste, subjects, catalogue: input.catalogue, bookish, struggling, cruising, device, behaviour };
}

export const tasteSimilarity = (s: Signals, text: string): number => cosine(s.taste, vectorOf(text));
