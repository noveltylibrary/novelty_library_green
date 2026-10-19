import { useEffect, useState } from 'react';
import { Mail, Route } from 'lucide-react';
import { DEFAULT_ROADMAP, STATUS_LABELS, fetchRoadmap, type RoadmapConfig } from '@/lib/roadmap';
import { useSupportEmail } from '@/lib/siteSettings';

/** "What's live, what's next" table. Shown on About; `config` renders an admin preview instead of the saved copy. */
export function RoadmapTable({ config, scrollTarget = false }: { config?: RoadmapConfig; scrollTarget?: boolean }) {
  const [saved, setSaved] = useState<RoadmapConfig>(DEFAULT_ROADMAP);
  const email = useSupportEmail();

  useEffect(() => {
    if (config) return;
    let alive = true;
    fetchRoadmap().then((c) => { if (alive) setSaved(c); }).catch(() => undefined);
    return () => { alive = false; };
  }, [config]);

  const cfg = config ?? saved;

  // Links like #/about#roadmap land here.
  useEffect(() => {
    if (!scrollTarget || !window.location.hash.endsWith('#roadmap')) return;
    const id = window.setTimeout(() => document.getElementById('roadmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => window.clearTimeout(id);
  }, [scrollTarget]);

  if (!config && !cfg.enabled) return null;
  if (!cfg.rows.length) return null;

  const subject = encodeURIComponent('Idea for Novelty Library');
  const body = encodeURIComponent('What should Novelty Library build next?\n\n');

  return (
    <section id="roadmap" className="nl-road" aria-labelledby="nl-road-title">
      <header className="nl-road-head">
        <span className="nl-road-icon"><Route className="w-5 h-5" aria-hidden="true" /></span>
        <div>
          <h2 id="nl-road-title">{cfg.heading}</h2>
          {cfg.intro && <p>{cfg.intro}</p>}
        </div>
      </header>

      <div className="nl-road-table" role="table" aria-label={cfg.heading}>
        <div className="nl-road-tr nl-road-thead" role="row">
          <span role="columnheader">Feature</span><span role="columnheader">Status</span><span role="columnheader">What it means</span>
        </div>
        {cfg.rows.map((row) => (
          <div key={row.id} className="nl-road-tr" role="row">
            <strong role="cell" data-label="Feature">{row.feature}</strong>
            <span role="cell" data-label="Status"><em className={`nl-road-pill is-${row.status}`}>{STATUS_LABELS[row.status]}</em></span>
            <span role="cell" data-label="What it means" className="nl-road-note">{row.note}</span>
          </div>
        ))}
      </div>

      <div className="nl-road-foot">
        <p>Have an idea or a request? We read every message.</p>
        <a href={`mailto:${email}?subject=${subject}&body=${body}`} className="nl-road-cta"><Mail className="w-4 h-4" aria-hidden="true" /> Tell us what to build next</a>
      </div>
    </section>
  );
}
