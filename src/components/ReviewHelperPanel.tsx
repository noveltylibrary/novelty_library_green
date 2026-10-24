import { useMemo, useState } from 'react';
import { ClipboardCheck, EyeOff, ShieldAlert, Sparkles, Undo2 } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';
import { polishReviewDeep } from '@/lib/reviewPolish';
import { checkFoul, foulSummary, maskFoul } from '@/lib/foulCheck';

const MAX_LEN = 2000;
const POINTS = [
  'Corrects misspelt and half-typed words, grammar slips and punctuation',
  'Flags foul language the moment it appears',
  'Keeps your voice, opinions and slang',
  'Runs on your device; polish runs only when you press the button',
];

interface ReviewHelperPanelProps {
  value: string;
  onChange: (value: string) => void;
  /** Set by the parent when the reviewer types after a polish, so Undo never throws their new typing away. */
  undoText: string | null;
  setUndoText: (value: string | null) => void;
  /** Gentle writing tips (length, sentences, repeated words). */
  tips?: string[];
  words?: number;
}

/**
 * Review Helper · Taste Match: the one helper that sits under the review box.
 * Live foul-language alert, writing tips, and the Polish button. Polish and masking only ever run when pressed.
 */
export function ReviewHelperPanel({ value, onChange, undoText, setUndoText, tips = [], words = 0 }: ReviewHelperPanelProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ lines: string[]; hints: string[]; tone: 'ok' | 'info' } | null>(null);
  const hits = useMemo(() => checkFoul(value), [value]);
  const foul = foulSummary(hits);
  const strong = foul.strong > 0;

  const polish = async () => {
    if (busy) return;
    if (!value.trim()) { setNote({ lines: ['Write or paste your review first.'], hints: [], tone: 'info' }); return; }
    setBusy(true);
    const r = await polishReviewDeep(value);
    setBusy(false);
    if (r.text === value) { setNote({ lines: ['Nothing to fix. Your review already reads cleanly.'], hints: r.hints, tone: 'info' }); return; }
    if (r.text.length > MAX_LEN) { setNote({ lines: [`Polishing would push the review past ${MAX_LEN} characters. Trim it a little first.`], hints: [], tone: 'info' }); return; }
    setUndoText(value);
    onChange(r.text);
    soundFx.play('chime');
    setNote({ lines: r.changes, hints: r.hints, tone: 'ok' });
  };
  const mask = () => {
    const masked = maskFoul(value, hits);
    if (masked === value) return;
    setUndoText(value);
    onChange(masked);
    setNote({ lines: [`Masked ${hits.length} flagged ${hits.length === 1 ? 'word' : 'words'}`], hints: [], tone: 'ok' });
  };
  const undo = () => {
    if (undoText == null) return;
    onChange(undoText);
    setUndoText(null);
    setNote({ lines: ['Restored your original wording.'], hints: [], tone: 'info' });
  };

  return (
    <div className="nl-rh">
      <div className="nl-rh-head">
        <div className="min-w-0">
          <p className="nl-rh-title">Review Helper <span>· Taste Match</span></p>
          <ul className="nl-rh-points">{POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="nl-rh-actions">
          <button type="button" className="nl-rh-polish" onClick={polish} disabled={busy}><Sparkles size={16} aria-hidden="true" /> {busy ? 'Proofreading…' : 'Polish with Review Helper / Taste Match'}</button>
          {undoText != null ? <button type="button" className="nl-rh-undo" onClick={undo}><Undo2 size={14} aria-hidden="true" /> Undo</button> : null}
        </div>
      </div>

      {hits.length ? (
        <div className="nl-rh-foul" data-level={strong ? 'strong' : 'mild'} role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <div className="min-w-0">
            <strong>{strong ? 'Foul language spotted' : 'Strong language noticed'}</strong>
            <p>{strong
              ? `Taste Match found ${foul.strong} offensive ${foul.strong === 1 ? 'word' : 'words'} (${foul.words.map((w) => `“${w}”`).join(', ')}). Reviews with vulgar or demeaning language are not accepted and can lead to blacklisting. Please reword it before submitting.`
              : `“${foul.mildWords.join('”, “')}” may read as harsh to other readers. You can keep it, but a calmer word usually lands better.`}</p>
          </div>
          <button type="button" className="nl-rh-mask" onClick={mask}><EyeOff size={14} aria-hidden="true" /> Mask flagged words</button>
        </div>
      ) : null}

      <div className="nl-rh-tips">
        <div className="nl-rh-tips-head"><span><ClipboardCheck size={14} aria-hidden="true" /> Writing tips</span><b data-ok={words >= 20}>{words} {words === 1 ? 'word' : 'words'}</b></div>
        <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>

      {note ? (
        <div className="nl-rh-note" data-tone={note.tone} role="status">
          {note.lines.length ? <p>{note.lines.join(' · ')}</p> : null}
          {note.hints.map((h) => <p key={h} className="nl-rh-hint">Tip: {h}</p>)}
        </div>
      ) : null}
    </div>
  );
}
