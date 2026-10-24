import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';
import { MAX_TRIES, WORD_LEN, keyMarks, scoreGuess } from '@/lib/enigma/lexiLogic';
import { pickLexiWord, warmLexiSources, type LexiPick } from '@/lib/enigma/lexiPicker';
import { isRealWord, loadValidWords } from '@/lib/enigma/wordBank';
import { markSeen } from '@/lib/enigma/seenStore';
import { recordResult } from '@/lib/enigma/behaviour';
import { GameShell } from '@/components/enigma/GameShell';
import { LetterKeyboard } from '@/components/enigma/LetterKeyboard';
import type { EnigmaContext } from '@/components/enigma/useEnigmaContext';

const FLIP_STEP = 280;
const CHEERS = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];

/**
 * LexiWord: the classic five-letter word game. Six tries, every guess must be a real English word, tiles flip to show
 * a correct spot (deep teal), a letter elsewhere in the word (bright cyan) or no match (slate).
 * The answer is chosen for this reader by Taste Match SE and is never one they have been given recently.
 */
export function LexiWord({ onBack, ctx }: { onBack: () => void; ctx: EnigmaContext }) {
  const [round, setRound] = useState<LexiPick | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [note, setNote] = useState('');
  const [shake, setShake] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [settled, setSettled] = useState(0);
  const token = useRef(0);
  const answer = round?.word ?? '';
  const won = !!answer && guesses[guesses.length - 1] === answer;
  const lost = !!answer && !won && guesses.length >= MAX_TRIES;
  const over = won || lost;
  const live = useRef({ current, over, busy: true, guesses, answer });

  const start = useCallback(async () => {
    const mine = ++token.current;
    setRound(null); setGuesses([]); setCurrent(''); setNote(''); setSettled(0); setRevealing(false);
    try {
      const signals = await ctx.getSignals('lexi');
      const pick = await pickLexiWord(signals);
      if (mine !== token.current) return;
      markSeen(ctx.readerKey, 'lexi', pick.word.toLowerCase(), ctx.signedIn);
      setRound(pick);
    } catch {
      if (mine === token.current) setNote('Could not set up a puzzle. Please try again.');
    }
  }, [ctx]);

  useEffect(() => { void loadValidWords(); void ctx.getSignals('lexi').then(warmLexiSources).catch(() => undefined); void start(); return () => { token.current++; }; }, [start, ctx]);

  live.current = { current, over, busy: !round || revealing, guesses, answer };

  const letter = useCallback((l: string) => {
    const s = live.current;
    if (s.over || s.busy) return;
    setNote('');
    setCurrent((c) => { if (c.length >= WORD_LEN) return c; soundFx.play('key'); return c + l; });
  }, []);
  const back = useCallback(() => { if (!live.current.busy) { setNote(''); setCurrent((c) => c.slice(0, -1)); } }, []);
  const enter = useCallback(async () => {
    const s = live.current;
    if (s.over || s.busy) return;
    const guess = s.current;
    const reject = (msg: string) => { setNote(msg); setShake(true); soundFx.play('wrong'); window.setTimeout(() => setShake(false), 500); };
    if (guess.length < WORD_LEN) return reject('Not enough letters');
    live.current.busy = true;
    const ok = await isRealWord(guess);
    if (!ok) { live.current.busy = false; return reject('Not in word list'); }
    const next = [...s.guesses, guess];
    setGuesses(next); setCurrent(''); setRevealing(true);
    window.setTimeout(() => {
      setSettled(next.length); setRevealing(false);
      soundFx.play(guess === s.answer ? 'win' : next.length >= MAX_TRIES ? 'lose' : 'correct');
    }, WORD_LEN * FLIP_STEP + 350);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); void enter(); }
      else if (e.key === 'Backspace') back();
      else if (/^[a-zA-Z]$/.test(e.key)) letter(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enter, back, letter]);

  // Record how the round went, once the last tile has flipped.
  const recorded = useRef<string>('');
  useEffect(() => {
    if (!over || revealing || !round || recorded.current === round.word + guesses.length) return;
    recorded.current = round.word + guesses.length;
    recordResult(ctx.readerKey, 'lexi', won, round.concepts);
  }, [over, revealing, round, guesses.length, won, ctx.readerKey]);

  const states = useMemo(() => (answer ? keyMarks(guesses.slice(0, settled), answer) : {}), [guesses, settled, answer]);
  const finished = over && !revealing;
  const restart = () => { soundFx.play('click'); void start(); };

  return (
    <GameShell title="LexiWord" tagline="Guess the hidden five-letter word in six tries." onBack={onBack}>
      <div className={`nl-en-grid${round ? '' : ' is-loading'}`} role="grid" aria-label="LexiWord grid" aria-busy={!round}>
        {Array.from({ length: MAX_TRIES }, (_, row) => {
          const guess = guesses[row];
          const typing = row === guesses.length && !over;
          const marks = guess && answer ? scoreGuess(guess, answer) : null;
          const fresh = row === guesses.length - 1 && revealing;
          return (
            <div className={`nl-en-grid-row${shake && typing ? ' is-shake' : ''}`} role="row" key={row}>
              {Array.from({ length: WORD_LEN }, (_, col) => {
                const ch = guess ? guess[col] : typing ? current[col] : '';
                return (
                  <span key={col} role="gridcell" className={`nl-en-tile${fresh ? ' is-flip' : ''}`} data-mark={marks?.[col]} data-filled={ch ? 'true' : undefined}
                    style={fresh ? { animationDelay: `${col * FLIP_STEP}ms`, transitionDelay: `${col * FLIP_STEP + 220}ms` } : undefined}>{ch}</span>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="nl-en-note" role="status" aria-live="polite">
        {!round && !note ? 'Choosing your word…' : finished ? (won ? `${CHEERS[Math.min(guesses.length, 6) - 1]} “${answer}” in ${guesses.length}.` : `The word was “${answer}”.`) : note || ' '}
      </p>
      <ul className="nl-en-legend" aria-label="Colour key">
        <li><i data-mark="hit" aria-hidden="true" />Correct spot</li>
        <li><i data-mark="near" aria-hidden="true" />Wrong spot</li>
        <li><i data-mark="miss" aria-hidden="true" />Not in word</li>
      </ul>
      {finished ? <button type="button" className="nl-en-cta" onClick={restart}><RotateCcw size={16} aria-hidden="true" /> Play again</button> : null}
      <LetterKeyboard states={states} disabled={over || !round} onLetter={letter} onEnter={() => void enter()} onBackspace={back} />
    </GameShell>
  );
}
