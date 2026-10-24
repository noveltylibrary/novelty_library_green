export type Mark = 'hit' | 'near' | 'miss';
export const WORD_LEN = 5;
export const MAX_TRIES = 6;

/** Wordle-style scoring that handles repeated letters: greens first, then yellows from the remaining letters. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(WORD_LEN).fill('miss');
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] === 'hit') continue;
    if (left[guess[i]] > 0) { marks[i] = 'near'; left[guess[i]] -= 1; }
  }
  return marks;
}

const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };

/** Best known mark per letter, for colouring the on-screen keyboard. */
export function keyMarks(guesses: string[], answer: string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    scoreGuess(g, answer).forEach((m, i) => { if (!out[g[i]] || RANK[m] > RANK[out[g[i]]]) out[g[i]] = m; });
  }
  return out;
}
