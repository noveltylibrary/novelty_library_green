import { useState } from 'react';
import { Star } from 'lucide-react';
import { RW_STAR_BANDS, rwRatingToStars } from '@/components/RwStarRating';

/** Five fixed slots (full / half / empty) so every row lines up. */
function StarSlots({ stars, size = 18 }: { stars: number; size?: number }) {
  return (
    <span className="rgc-stars" role="img" aria-label={`${stars} stars`} style={{ ['--s' as string]: `${size}px` }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = stars >= i + 1 ? 'full' : stars >= i + 0.5 ? 'half' : 'empty';
        return (
          <span className="rgc-star" key={i} data-fill={fill} style={{ ['--i' as string]: i }}>
            <Star className="rgc-star-bg" strokeWidth={1.8} aria-hidden="true" />
            {fill !== 'empty' && (
              <span className="rgc-star-fg"><Star strokeWidth={1.8} fill="currentColor" aria-hidden="true" /></span>
            )}
          </span>
        );
      })}
    </span>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

export function RatingGuideCard() {
  const [rw, setRw] = useState(9);
  const stars = rwRatingToStars(rw);

  return (
    <div className="rgc">
      <p className="rgc-kicker">Star rating explained</p>
      <h3 className="rgc-title">How the R/W score becomes stars</h3>
      <p className="rgc-lead">R/W is the reviewer&apos;s personal score out of 10. Novelty shows it as stars (in half-star steps) on review cards and posters.</p>

      <div className="rgc-try" aria-label="Try the R/W to stars converter">
        <div className="rgc-try-top">
          <span className="rgc-try-num"><b>{fmt(rw)}</b><small>/10 R/W</small></span>
          <span className="rgc-try-arrow" aria-hidden="true">→</span>
          <span className="rgc-try-result"><StarSlots stars={stars} size={22} /><small>{fmt(stars)} stars</small></span>
        </div>
        <input
          type="range" min={0} max={10} step={0.1} value={rw}
          onChange={(e) => setRw(Number(e.target.value))}
          aria-label="R/W rating out of 10" className="rgc-range"
          style={{ ['--p' as string]: `${rw * 10}%` }}
        />
        <div className="rgc-scale" aria-hidden="true"><span>0</span><span>5</span><span>10</span></div>
      </div>

      <ul className="rgc-list">
        {RW_STAR_BANDS.map((b) => {
          const active = b.stars === stars;
          return (
            <li key={b.stars} className={`rgc-row${active ? ' is-active' : ''}`}>
              <StarSlots stars={b.stars} size={16} />
              <span className="rgc-bar" aria-hidden="true"><i style={{ left: `${(b.from / 10) * 100}%`, width: `${((b.to - b.from) / 10) * 100 || 2}%` }} /></span>
              <span className="rgc-range-txt">{fmt(b.from)}–{fmt(b.to)}<small> / 10</small></span>
            </li>
          );
        })}
      </ul>

      <p className="rgc-note">Goodreads and Amazon ratings remain 5-point platform ratings. R/W is the reviewer&apos;s personal score out of 10. NL is the cumulative average (out of 10) of the R/W score plus all Novelty Library reader ratings on the community review post.</p>
    </div>
  );
}

export const RATING_GUIDE_CSS = `
  .rgc { box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; margin: 22px 0 0; padding: clamp(16px,3vw,24px); border-radius: 22px; background: var(--novelty-subcard-bg); border: 1px solid var(--novelty-border); box-shadow: 0 12px 28px rgba(1,43,54,.06); overflow: hidden; }
  .rgc * { box-sizing: border-box; }
  .rgc-kicker { margin: 0 0 4px !important; font-size: .7rem; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; color: var(--novelty-teal-main); }
  .rgc-title { margin: 0 0 6px; font: 700 clamp(1.15rem,2.6vw,1.45rem)/1.25 Georgia,serif; color: var(--novelty-text); }
  .rgc-lead { margin: 0 0 16px !important; font-size: .88rem; opacity: .75; line-height: 1.55; }
  .rgc-stars { display: inline-flex; gap: 2px; color: var(--novelty-teal-main); flex: 0 0 auto; }
  .rgc-star { position: relative; width: var(--s); height: var(--s); display: inline-block; }
  .rgc-star svg { width: var(--s); height: var(--s); display: block; }
  .rgc-star-bg { position: absolute; inset: 0; opacity: .3; fill: none; }
  .rgc-star-fg { position: absolute; inset: 0; overflow: hidden; width: 100%; animation: rgc-pop .5s cubic-bezier(.3,1.6,.5,1) both; animation-delay: calc(var(--i) * 60ms); transform-origin: center; }
  .rgc-star[data-fill="half"] .rgc-star-fg { width: 50%; }
  @keyframes rgc-pop { 0% { transform: scale(.2) rotate(-30deg); opacity: 0; } 100% { transform: none; opacity: 1; } }

  .rgc-try { padding: 14px 16px 10px; border-radius: 18px; background: rgba(8,145,178,.07); border: 1px dashed rgba(8,145,178,.3); margin-bottom: 16px; }
  .rgc-try-top { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 12px; }
  .rgc-try-num b { font: 800 2rem/1 Georgia,serif; color: var(--novelty-teal-dark); }
  .rgc-try-num small, .rgc-try-result small { display: block; font-size: .66rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; opacity: .65; }
  .rgc-try-arrow { font-size: 1.3rem; color: var(--novelty-teal-main); animation: rgc-nudge 1.6s ease-in-out infinite; }
  @keyframes rgc-nudge { 50% { transform: translateX(5px); } }
  .rgc-try-result { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .rgc-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 8px; border-radius: 999px; outline: none; cursor: pointer; background: linear-gradient(90deg,#22d3ee var(--p),rgba(8,145,178,.18) var(--p)); }
  .rgc-range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 4px solid #0e9ab5; box-shadow: 0 4px 12px rgba(8,145,178,.4); transition: transform .15s; }
  .rgc-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 4px solid #0e9ab5; box-shadow: 0 4px 12px rgba(8,145,178,.4); }
  .rgc-range:active::-webkit-slider-thumb { transform: scale(1.18); }
  .rgc-range:focus-visible { box-shadow: 0 0 0 3px rgba(34,211,238,.45); }
  .rgc-scale { display: flex; justify-content: space-between; margin-top: 6px; font-size: .66rem; font-weight: 800; opacity: .55; }

  .rgc-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .rgc-row { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; border: 1px solid transparent; transition: background .25s, border-color .25s, transform .25s; }
  .rgc-row:hover { background: rgba(8,145,178,.06); }
  .rgc-row.is-active { background: rgba(34,211,238,.14); border-color: rgba(8,145,178,.4); transform: translateX(3px); }
  .rgc-bar { position: relative; height: 6px; border-radius: 999px; background: rgba(8,145,178,.12); overflow: hidden; }
  .rgc-bar i { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg,#0e9ab5,#22d3ee); }
  .rgc-row.is-active .rgc-bar i { animation: rgc-glow 1.4s ease-in-out infinite; }
  @keyframes rgc-glow { 50% { filter: brightness(1.35); } }
  .rgc-range-txt { font-weight: 800; font-size: .9rem; white-space: nowrap; text-align: right; min-width: 64px; }
  .rgc-range-txt small { font-weight: 600; opacity: .55; }
  .rgc-note { margin: 14px 0 0 !important; font-size: .76rem; line-height: 1.5; opacity: .7; }
  @media (max-width: 460px) { .rgc-row { grid-template-columns: auto minmax(0,1fr); gap: 4px 10px; } .rgc-bar { grid-column: 1 / -1; grid-row: 2; } .rgc-range-txt { grid-column: 2; grid-row: 1; } }
  @media (prefers-reduced-motion: reduce) { .rgc-star-fg, .rgc-try-arrow, .rgc-row.is-active .rgc-bar i { animation: none; } .rgc-row { transition: none; } }
`;
