import { VERDICTS, VERDICT_RATING_RULES } from '@/lib/verdict';

const range = (v: (typeof VERDICTS)[number]['value']): string => {
  const r = VERDICT_RATING_RULES[v];
  if (r.min !== undefined && r.max === undefined) return `${r.min.toFixed(1)}+`;
  if (r.max !== undefined && r.min === undefined) return `up to ${r.max.toFixed(1)}`;
  return '—';
};

/** About page: what the verdicts and the two ratings mean. Static, no data needed. */
export function HowWeRate({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="surface-card nl-howrate" aria-labelledby="nl-howrate-title">
      <span className="nl-live-kicker">HOW WE RATE</span>
      <h2 id="nl-howrate-title" className="font-serif text-2xl font-semibold mt-1" style={{ color: 'var(--color-text)' }}>What the labels and numbers mean</h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>Every review on Novelty Library is written by a reader and carries a verdict, a personal score and, over time, a score from other readers.</p>
      <table className="nl-shelf-table nl-howrate-table">
        <thead><tr><th scope="col">Verdict</th><th scope="col">Meaning</th><th scope="col">Usual R/W</th></tr></thead>
        <tbody>{VERDICTS.map((v) => <tr key={v.value}><td><strong>{v.label}</strong></td><td>{v.blurb}</td><td>{range(v.value)}</td></tr>)}</tbody>
      </table>
      <ul className="nl-howrate-list">
        <li><b>R/W</b> is the reviewer’s own score out of 10. It is shown as stars (in half-star steps) on cards and posters.</li>
        <li><b>NL</b> is the running average of the reviewer’s score and every rating readers give on that review.</li>
        <li><b>Goodreads / Amazon</b> scores are shown only for context and are never mixed into R/W or NL.</li>
        <li>The “usual R/W” column is a gentle check, not a rule — a reviewer can always keep the verdict they chose.</li>
      </ul>
      <button type="button" className="nl-qv-link" onClick={() => navigate('/review-guidelines')}>Read the full review guide →</button>
    </section>
  );
}
