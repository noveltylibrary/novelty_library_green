const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface LetterKeyboardProps {
  /** Per-letter state class suffix: "hit" | "near" | "miss" (LexiWord) or "found" | "used" (HangLex: right / wrong, both locked); letters not listed look untouched. */
  states?: Record<string, string>;
  disabled?: boolean;
  onLetter: (letter: string) => void;
  /** Only LexiWord needs Enter / Backspace keys. */
  onEnter?: () => void;
  onBackspace?: () => void;
}

/** Shared on-screen A–Z keyboard for both Enigma games. */
export function LetterKeyboard({ states = {}, disabled, onLetter, onEnter, onBackspace }: LetterKeyboardProps) {
  return (
    <div className="nl-en-kb" role="group" aria-label="Letter keyboard">
      {ROWS.map((row, r) => (
        <div className="nl-en-kb-row" key={row}>
          {r === 2 && onEnter ? <button type="button" className="nl-en-key is-wide" onClick={onEnter} disabled={disabled}>Enter</button> : null}
          {row.split('').map((l) => (
            <button key={l} type="button" className="nl-en-key" data-state={states[l]} onClick={() => onLetter(l)} disabled={disabled || states[l] === 'used' || states[l] === 'found'} aria-label={l}>{l}</button>
          ))}
          {r === 2 && onBackspace ? <button type="button" className="nl-en-key is-wide" onClick={onBackspace} disabled={disabled} aria-label="Backspace">⌫</button> : null}
        </div>
      ))}
    </div>
  );
}
