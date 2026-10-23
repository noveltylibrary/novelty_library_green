import { useState, type CSSProperties } from 'react';
import { RotateCcw } from 'lucide-react';
import { MOODS } from '@/lib/rankingSearch';
import { VERDICTS, type Verdict } from '@/lib/verdict';

/** One short column label per mood (cosmetic). Unknown ids fall back to the first word of the mood name. */
const SHORT: Record<string, string> = {
  mind: 'Mind', thrill: 'Thrill', emotional: 'Heart', romantic: 'Love', epic: 'Epic', dark: 'Dark', light: 'Light', think: 'Ideas', grow: 'Spark',
};
/** Resting heights of the unchosen columns, so the fingerprint looks organic rather than flat. */
const REST = [20, 12, 17, 10, 15, 19, 11, 16, 13];

/**
 * Small, data-free taste of Taste Match SE for the Discovery tab: pick up to three moods (same rule as the real page) and an
 * optional verdict, and watch the taste fingerprint take shape. Real matches come from the published reviews on /taste-match.
 */
export function TasteMatchPreview() {
  const [moods, setMoods] = useState<string[]>(['mind', 'thrill']);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const toggleMood = (id: string) => setMoods((cur) => (cur.includes(id) ? cur.filter((m) => m !== id) : cur.length >= 3 ? [...cur.slice(1), id] : [...cur, id]));
  const toggleVerdict = (v: Verdict) => setVerdicts((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const reset = () => { setMoods([]); setVerdicts([]); };

  const chosen = moods.map((id) => MOODS.find((m) => m.id === id)?.label).filter((x): x is string => !!x);
  const kept = verdicts.map((v) => VERDICTS.find((x) => x.value === v)?.label).filter((x): x is string => !!x);
  const caption = chosen.length
    ? `Your taste: ${chosen.join(' + ')}${kept.length ? ` · keeping only ${kept.join(' or ')} reads` : ''}`
    : 'Choose up to three moods and watch your taste fingerprint take shape.';

  return (
    <div className="nl-tmp" role="group" aria-label="Taste Match SE preview">
      <div className="nl-tmp-top">
        <span className="nl-tmp-title">Try it · live preview</span>
        {(moods.length > 0 || verdicts.length > 0) && <button type="button" className="nl-tmp-reset" onClick={reset}><RotateCcw aria-hidden="true" size={13} /> Reset</button>}
      </div>

      <div className="nl-tmp-moods" role="group" aria-label="Moods">
        {MOODS.map((m) => (
          <button key={m.id} type="button" className={moods.includes(m.id) ? 'is-on' : ''} aria-pressed={moods.includes(m.id)} title={m.hint} onClick={() => toggleMood(m.id)}>{m.label}</button>
        ))}
      </div>

      <div className="nl-tmp-verdicts" role="group" aria-label="Reviewer verdict">
        <span className="nl-tmp-verdicts-label">Verdict <em>· optional</em></span>
        {VERDICTS.map((v) => (
          <button key={v.value} type="button" className={verdicts.includes(v.value) ? 'is-on' : ''} aria-pressed={verdicts.includes(v.value)} title={v.blurb} onClick={() => toggleVerdict(v.value)}>{v.label}</button>
        ))}
      </div>

      <div className={`nl-tmp-fp${kept.length ? ' is-gated' : ''}`} aria-hidden="true">
        {MOODS.map((m, i) => {
          const on = moods.includes(m.id);
          const style = { ['--h' as string]: `${on ? 88 : REST[i % REST.length]}%` } as CSSProperties;
          return (
            <span key={m.id} className={`nl-tmp-col${on ? ' is-on' : ''}`} style={style}>
              <i className="nl-tmp-bar" />
              <small>{SHORT[m.id] ?? m.label.split(/[\s&-]+/)[0]}</small>
            </span>
          );
        })}
      </div>

      <p className="nl-tmp-caption" aria-live="polite">{caption}</p>
      <p className="nl-tmp-note">A taste of the idea. Real matches come from the published reviews inside Taste Match SE.</p>
    </div>
  );
}
