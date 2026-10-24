import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';
import { hangKey, pickHangPuzzle, type HangPuzzle } from '@/lib/enigma/hangPicker';
import { markSeen } from '@/lib/enigma/seenStore';
import { recordResult } from '@/lib/enigma/behaviour';
import { GameShell } from '@/components/enigma/GameShell';
import { LetterKeyboard } from '@/components/enigma/LetterKeyboard';
import type { EnigmaContext } from '@/components/enigma/useEnigmaContext';

const LIVES = 7;
/** One tile per try, spelled out along the beam. */
const TILE_LETTERS = 'HANGLEX'.split('');
const isLetter = (c: string) => /^[A-Z]$/.test(c);

/** Seven small letter tiles (H A N G L E X) swinging from a beam, the same mark as the HangLex icon. One drops away with every wrong letter. */
function HangTiles({ left }: { left: number }) {
  return (
    <div className="nl-en-hang" role="img" aria-label={`${left} of ${LIVES} tries left`}>
      {TILE_LETTERS.map((ch, i) => (
        <span key={i} className="nl-en-hang-item" style={{ animationDelay: `${-i * 0.37}s` }}>
          <svg viewBox="0 0 24 34" data-on={i < left ? 'true' : 'false'} aria-hidden="true" focusable="false">
            <path className="nl-en-hang-str" d="M12 0v5M12 5 5.5 12M12 5l6.5 7" />
            <rect x="3" y="12" width="18" height="18" rx="4" />
            <text x="12" y="25" textAnchor="middle">{ch}</text>
          </svg>
        </span>
      ))}
    </div>
  );
}

/**
 * HangLex: hangman with books and authors. One clue only, a specific trope, never the author's name.
 * The puzzle is chosen for this reader by Taste Match SE and is never one they have been given before.
 */
export function HangLex({ onBack, ctx }: { onBack: () => void; ctx: EnigmaContext }) {
  const [puzzle, setPuzzle] = useState<HangPuzzle | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const token = useRef(0);

  const start = useCallback(async () => {
    const mine = ++token.current;
    setPuzzle(null); setPicked([]); setError('');
    try {
      const signals = await ctx.getSignals('hang');
      const next = await pickHangPuzzle(signals);
      if (mine !== token.current) return;
      markSeen(ctx.readerKey, 'hang', hangKey(next), ctx.signedIn);
      setPuzzle(next);
    } catch { if (mine === token.current) setError('Could not set up a puzzle. Please try again.'); }
  }, [ctx]);
  useEffect(() => { void start(); return () => { token.current++; }; }, [start]);

  const answer = puzzle?.answer ?? '';
  const letters = useMemo(() => new Set(answer.split('').filter(isLetter)), [answer]);
  const wrong = picked.filter((l) => !letters.has(l));
  const solved = !!puzzle && [...letters].every((l) => picked.includes(l));
  const lost = !!puzzle && wrong.length >= LIVES;
  const over = solved || lost;
  const live = useRef({ picked, over, puzzle });
  live.current = { picked, over, puzzle };

  const guess = useCallback((l: string) => {
    const { picked: have, over: done, puzzle: p } = live.current;
    if (!p || done || have.includes(l)) return;
    const next = [...have, l];
    setPicked(next);
    const set = new Set(p.answer.split('').filter(isLetter));
    const nowWrong = next.filter((x) => !set.has(x)).length;
    const nowSolved = [...set].every((x) => next.includes(x));
    soundFx.play(nowSolved ? 'win' : nowWrong >= LIVES ? 'lose' : set.has(l) ? 'correct' : 'wrong');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) guess(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guess]);

  const recorded = useRef('');
  useEffect(() => {
    if (!over || !puzzle || recorded.current === hangKey(puzzle)) return;
    recorded.current = hangKey(puzzle);
    recordResult(ctx.readerKey, 'hang', solved, puzzle.concepts);
  }, [over, puzzle, solved, ctx.readerKey]);

  const states = useMemo(() => {
    const out: Record<string, string> = {};
    picked.forEach((l) => { out[l] = letters.has(l) ? 'found' : 'used'; });
    return out;
  }, [picked, letters]);
  const restart = () => { soundFx.play('click'); void start(); };

  return (
    <GameShell title="HangLex" tagline="Name the book or author from one trope clue." onBack={onBack}>
      {puzzle ? (
        <>
          <p className="nl-en-hint"><span>{puzzle.kind === 'book' ? 'Book' : 'Author'}</span><span className="is-trope">Trope</span>{puzzle.trope}</p>
          <HangTiles left={LIVES - wrong.length} />
          <div className="nl-en-word" aria-label="Puzzle">
            {answer.split(' ').map((w, wi) => (
              <span className="nl-en-word-part" key={wi}>
                {w.split('').map((c, i) => {
                  if (!isLetter(c)) return <span key={i} className="nl-en-slot is-mark">{c}</span>;
                  const shown = picked.includes(c) || lost;
                  return <span key={i} className="nl-en-slot" data-miss={lost && !picked.includes(c) ? 'true' : undefined}>{shown ? c : ''}</span>;
                })}
              </span>
            ))}
          </div>
          <p className="nl-en-note" role="status" aria-live="polite">
            {solved ? `Well read!${puzzle.by ? ` By ${puzzle.by}.` : ''}` : lost ? `Out of tries.${puzzle.by ? ` By ${puzzle.by}.` : ''}` : wrong.length ? `Missed: ${wrong.join(' ')}` : ' '}
          </p>
          {over ? <button type="button" className="nl-en-cta" onClick={restart}><RotateCcw size={16} aria-hidden="true" /> Next puzzle</button> : null}
        </>
      ) : (
        <p className="nl-en-note nl-en-loading" role="status" aria-live="polite">{error || 'Finding your next puzzle…'}</p>
      )}
      <LetterKeyboard states={states} disabled={over || !puzzle} onLetter={guess} />
    </GameShell>
  );
}
