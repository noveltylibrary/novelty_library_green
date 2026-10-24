/** What this reader has played and how it went; feeds the matching engine so the next puzzle fits them better. */
export interface Behaviour {
  /** concept id → weight, grown by what the reader solved (a loss counts for less). */
  concepts: Record<string, number>;
  /** most recent results first: 1 = solved, 0 = missed. */
  lexi: number[];
  hang: number[];
}

const key = (reader: string) => `nl_en_behaviour:${reader}`;

export function readBehaviour(reader: string): Behaviour {
  try {
    const p = JSON.parse(localStorage.getItem(key(reader)) || '{}') as Partial<Behaviour>;
    return { concepts: p.concepts && typeof p.concepts === 'object' ? p.concepts : {}, lexi: Array.isArray(p.lexi) ? p.lexi.slice(0, 12) : [], hang: Array.isArray(p.hang) ? p.hang.slice(0, 12) : [] };
  } catch { return { concepts: {}, lexi: [], hang: [] }; }
}

export function recordResult(reader: string, game: 'lexi' | 'hang', won: boolean, concepts: string[]) {
  const b = readBehaviour(reader);
  b[game] = [won ? 1 : 0, ...b[game]].slice(0, 12);
  for (const c of concepts) b.concepts[c] = Math.min(8, (b.concepts[c] ?? 0) + (won ? 1 : 0.4));
  try { localStorage.setItem(key(reader), JSON.stringify(b)); } catch { /* ignore */ }
}

/** True after two misses in a row: serve something friendlier next. */
export const isStruggling = (results: number[]): boolean => results.length >= 2 && results[0] === 0 && results[1] === 0;
/** True after four wins in a row: room for something rarer. */
export const isCruising = (results: number[]): boolean => results.length >= 4 && results.slice(0, 4).every((r) => r === 1);
