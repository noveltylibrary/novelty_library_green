import { datamuseCheck } from '@/lib/enigma/sources';

/** The built-in English lists are separate chunks, loaded the first time a game needs them. */
let validP: Promise<Set<string>> | null = null;
let commonP: Promise<Set<string>> | null = null;

export const loadValidWords = (): Promise<Set<string>> => (validP ??= import('@/lib/enigma/data/validWords').then((m) => new Set(m.WORDS.split(' '))));
export const loadCommonWords = (): Promise<Set<string>> => (commonP ??= import('@/lib/enigma/data/commonWords').then((m) => new Set(m.WORDS.split(' '))));

/** Word-list check for guesses: the built-in list first, then an open dictionary for rarer words. */
export async function isRealWord(word: string): Promise<boolean> {
  const w = word.toLowerCase();
  if ((await loadValidWords()).has(w)) return true;
  return !!(await datamuseCheck(w));
}

/** Words we never choose as an answer. */
export const BLOCKED = new Set(['whore', 'bitch', 'slut', 'cunts', 'dicks', 'penis', 'pussy', 'nazis', 'rapes', 'raped', 'rapist', 'bimbo', 'fagot', 'wanks']);
