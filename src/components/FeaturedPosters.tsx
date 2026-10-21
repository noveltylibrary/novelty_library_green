import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Search, Megaphone, Trophy } from 'lucide-react';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import { BUILTIN_KEYS, fetchAnnouncements, isBuiltinActive, isPosterLive, peekAnnouncements, type AnnouncementsConfig, type BuiltinKey, type Poster } from '@/lib/announcements';

const BUILTIN_PREFIX = 'builtin-';
const builtinKeyOf = (p: Poster): BuiltinKey | null => (p.id.startsWith(BUILTIN_PREFIX) ? (p.id.slice(BUILTIN_PREFIX.length) as BuiltinKey) : null);

interface FeaturedPostersProps {
  navigate?: (path: string) => void;
  /** Admin preview: render this config instead of the live one. */
  config?: AnnouncementsConfig;
}

/** PES-style featured strip: wide 16:9 poster cards, snap-swipe on phones, arrows + dots on desktop. */
export function FeaturedPosters({ navigate, config }: FeaturedPostersProps) {
  const [live, setLive] = useState<AnnouncementsConfig | null>(() => peekAnnouncements());
  useEffect(() => {
    if (config) return;
    let alive = true;
    fetchAnnouncements().then((c) => { if (alive) setLive(c); }).catch(() => undefined);
    return () => { alive = false; };
  }, [config]);

  const cfg = config ?? live;
  const now = new Date();
  const builtins: Poster[] = cfg
    ? BUILTIN_KEYS.filter((k) => isBuiltinActive(cfg.builtins[k], now)).map((k) => { const b = cfg.builtins[k]; return { id: `${BUILTIN_PREFIX}${k}`, image: '', title: b.title, caption: b.caption, link: b.link, badge: b.badge, from: b.from, until: b.until }; })
    : [];
  const posters: Poster[] = [...builtins, ...(cfg?.posters ?? []).filter((p) => isPosterLive(p, now))];
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: 'smooth' });
  }, []);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0; let bestDist = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const dist = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    setActive(best);
  };

  // Slow auto-advance; paused while hovered / touched, and off for people who prefer reduced motion.
  useEffect(() => {
    if (!cfg?.autoplay || paused || posters.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => goTo((active + 1) % posters.length), Math.max(3, cfg.intervalSec) * 1000);
    return () => window.clearInterval(id);
  }, [cfg?.autoplay, cfg?.intervalSec, paused, posters.length, active, goTo]);

  if (!cfg || (!config && !cfg.enabled) || posters.length === 0) return null;

  const open = (e: MouseEvent, poster: Poster) => {
    if (!poster.link || !navigate || /^https?:/i.test(poster.link)) return; // external links use the normal anchor
    e.preventDefault();
    navigate(poster.link);
  };

  return (
    <section
      className="nl-feat"
      aria-roledescription="carousel"
      aria-label={cfg.heading || 'Featured'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => window.setTimeout(() => setPaused(false), 4000)}
    >
      <div className="nl-feat-head">
        <span className="nl-feat-eyebrow"><Megaphone className="w-3.5 h-3.5" aria-hidden="true" /> {cfg.heading || 'Featured'}</span>
        <span className="nl-feat-rule" aria-hidden="true" />
      </div>

      <div className="nl-feat-stage">
        {posters.length > 1 && <button type="button" className="nl-feat-arrow nl-feat-arrow--prev" onClick={() => goTo((active - 1 + posters.length) % posters.length)} aria-label="Previous poster"><ChevronLeft className="w-5 h-5" /></button>}
        <div ref={trackRef} className="nl-feat-track" onScroll={onScroll} tabIndex={0}>
          {posters.map((p, i) => {
            const builtin = builtinKeyOf(p);
            const body = (
              <>
                {builtin
                  ? (builtin === 'taste' ? (
                    <span className="nl-feat-art is-taste" aria-hidden="true">
                      <span className="nl-lr-glow" />
                      <span className="nl-lr-panel">
                        <span className="nl-tm-moods"><i>Mind-bending</i><i className="is-on">Edge-of-seat</i><i>Emotional</i><i className="is-on">Dark &amp; intense</i></span>
                        <span className="nl-tm-verdicts"><i>Perfection</i><i className="is-on">Go for it</i><i>Timepass</i></span>
                        <span className="nl-tm-pick"><em>1</em><u /><span><b>Your best match</b><s style={{ width: '88%' }} /></span><strong>94%</strong></span>
                        <span className="nl-tm-pick"><em>2</em><u /><span><b>Also a great fit</b><s style={{ width: '71%' }} /></span><strong>81%</strong></span>
                      </span>
                      <span className="nl-lr-orbit"><TasteMatchIcon size={30} /></span>
                    </span>
                  ) : ((
                    <span className="nl-feat-art" aria-hidden="true">
                      <span className="nl-lr-glow" />
                      <span className="nl-lr-panel">
                        <span className="nl-lr-search"><Search /><b>psychological thrillers, twisty…</b></span>
                        <span className="nl-lr-chips"><i>Genre</i><i>Language</i><i>Traits</i><i>Author</i></span>
                        <span className="nl-lr-row"><em>1</em><u /><s style={{ width: '92%' }} /><b>9.4</b></span>
                        <span className="nl-lr-row"><em>2</em><u /><s style={{ width: '78%' }} /><b>9.1</b></span>
                        <span className="nl-lr-row"><em>3</em><u /><s style={{ width: '64%' }} /><b>8.8</b></span>
                      </span>
                      <span className="nl-lr-orbit"><Trophy /></span>
                    </span>
                  )))
                  : <img src={p.image} alt={p.title || 'Featured poster'} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />}
                <span className="nl-feat-shine" aria-hidden="true" />
                {(p.title || p.caption) && (
                  <span className="nl-feat-copy">
                    {p.title && <strong>{p.title}</strong>}
                    {p.caption && <small>{p.caption}</small>}
                  </span>
                )}
                {p.badge && <span className={`nl-feat-badge is-${p.badge.toLowerCase()}`}>{p.badge}</span>}
                <span className="nl-feat-tag" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              </>
            );
            const cls = `nl-feat-card${i === active ? ' is-active' : ''}`;
            return p.link
              ? <a key={p.id} href={p.link} target={/^https?:/i.test(p.link) ? '_blank' : undefined} rel="noopener noreferrer" className={cls} onClick={(e) => open(e, p)} aria-label={p.title || 'Open featured poster'}>{body}</a>
              : <div key={p.id} className={cls}>{body}</div>;
          })}
        </div>
        {posters.length > 1 && <button type="button" className="nl-feat-arrow nl-feat-arrow--next" onClick={() => goTo((active + 1) % posters.length)} aria-label="Next poster"><ChevronRight className="w-5 h-5" /></button>}
      </div>

      {posters.length > 1 && (
        <div className="nl-feat-dots" role="tablist" aria-label="Choose poster">
          {posters.map((p, i) => <button key={p.id} type="button" role="tab" aria-selected={i === active} aria-label={`Poster ${i + 1}`} className={i === active ? 'is-active' : ''} onClick={() => goTo(i)} />)}
        </div>
      )}
    </section>
  );
}
