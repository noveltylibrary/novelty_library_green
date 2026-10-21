import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Download, Share2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { NameBlock, nameInitial } from '@/components/NameBlock';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';
import type { PeopleStats } from '@/lib/authors';
import { useAuth } from '@/lib/auth';
import { normalizePosterUrl } from '@/lib/posterUrl';

/**
 * Shareable 4:5 card (1080 x 1350) for an author (purple + gold) or a reviewer (teal). Same export
 * method as the reader profile card: a fixed-size canvas scaled to fit, downloaded as a PNG with rounded corners.
 */
const W = 1080;
const H = 1350;
const LOGO = '/novelty-library-logo.png';
const IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const PALETTE = {
  author: {
    bg: 'linear-gradient(155deg,#1a0836 0%,#2e1065 32%,#5b21b6 66%,#8b5cf6 100%)',
    glowA: 'radial-gradient(circle, rgba(245,197,66,.38) 0%, rgba(245,197,66,0) 62%)',
    glowB: 'radial-gradient(circle, rgba(255,233,168,.85) 0%, rgba(255,233,168,.3) 26%, rgba(255,233,168,0) 58%)',
    accent: '#f5c542', accentSoft: '#ffe9a8', text: '#ffffff', soft: 'rgba(255,255,255,.76)',
    glass: 'rgba(255,255,255,.10)', line: 'rgba(245,197,66,.45)', tagBg: 'linear-gradient(135deg,#3b0764,#6d28d9)', tagText: '#f5c542',
    ring: 'conic-gradient(from 210deg,#f5c542,#fff3c4,#8b5cf6,#ffe9a8,#f5c542)', avatarBg: 'linear-gradient(135deg,#5b21b6,#a78bfa)',
    kicker: 'Novelty Library · Author', footer: "Authors' page · branding tool", boxBg: 'linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,240,196,.82))', boxInk: '#3b0764', boxAccent: '#a16207',
  },
  reviewer: {
    bg: 'linear-gradient(150deg,#012b36 0%,#013a46 26%,#00687f 52%,#0097b2 76%,#3fd3d9 100%)',
    glowA: 'radial-gradient(circle, rgba(92,225,230,.42) 0%, rgba(92,225,230,0) 62%)',
    glowB: 'radial-gradient(circle, rgba(255,255,255,.9) 0%, rgba(255,255,255,.4) 24%, rgba(255,255,255,0) 58%)',
    accent: '#9ff3f5', accentSoft: '#d8fcfd', text: '#ffffff', soft: 'rgba(255,255,255,.76)',
    glass: 'rgba(255,255,255,.10)', line: 'rgba(255,255,255,.24)', tagBg: 'linear-gradient(135deg,#013a46,#0097b2)', tagText: '#d8fcfd',
    ring: 'conic-gradient(from 210deg,#5ce1e6,#fff,#0097b2,#9ff3f5,#5ce1e6)', avatarBg: 'linear-gradient(135deg,#0097b2,#5ce1e6)',
    kicker: 'Novelty Library · Reviewer', footer: "Readers' personal archive · branding tool", boxBg: 'linear-gradient(135deg,rgba(255,255,255,.92),rgba(206,255,255,.78))', boxInk: '#013a46', boxAccent: '#0097b2',
  },
} as const;

export interface PeopleCardProps {
  variant: 'author' | 'reviewer';
  name: string;
  /** Real follower count (authors with NL_SQL_200 run). Omit/null to hide the pill. */
  followers?: number | null;
  /** Shown instead of followers, e.g. "@handle". */
  handle?: string | null;
  stats: PeopleStats;
  fileSlug: string;
  shareUrl?: string;
}

const cover = (r: PeopleStats['top'][number]) => safeExternalUrl(normalizePosterUrl(r.poster_url || r.cover_image_url || '')) || null;

/** Poster on the card: loads with CORS first (so the PNG export can include it), then without CORS so it is never a blank box. */
function CardCover({ src }: { src: string }) {
  const [cors, setCors] = useState(true);
  const [dead, setDead] = useState(false);
  if (dead) return null;
  return <img key={cors ? 'cors' : 'plain'} src={src} alt="" referrerPolicy="no-referrer" {...(cors ? { crossOrigin: 'anonymous' as const } : {})} onError={() => (cors ? setCors(false) : setDead(true))} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
}

export function PeopleCard({ variant, name, followers, handle, stats, fileSlug, shareUrl }: PeopleCardProps) {
  // Readers can share the page; the PNG export is an admin tool.
  const { isAdmin } = useAuth();
  const pal = PALETTE[variant];
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / W) : 1;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setBoxWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const download = async () => {
    if (!canvasRef.current || busy) return;
    setBusy(true);
    try {
      if ('fonts' in document) await document.fonts.ready;
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, width: W, height: H, imagePlaceholder: IMAGE_PLACEHOLDER, style: { transform: 'none', borderRadius: '68px' } });
      const a = document.createElement('a');
      a.download = `novelty-library-${variant}-${fileSlug || 'profile'}-4x5.png`;
      a.href = dataUrl;
      a.click();
    } catch (error) {
      console.error(error);
      window.alert('The card could not be exported. Please try again after the images finish loading.');
    } finally { setBusy(false); }
  };

  const share = async () => {
    const url = shareUrl || window.location.href;
    try { if (navigator.share) { await navigator.share({ title: `${name} on Novelty Library`, url }); return; } } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); setShared(true); window.setTimeout(() => setShared(false), 2200); } catch { /* clipboard blocked */ }
  };

  const initial = nameInitial(name, variant === 'author' ? 'A' : 'R', variant === 'author' ? 'last' : 'first');
  const tiles: [string, string][] = [
    [variant === 'author' ? 'Reviews' : 'Reviews written', String(stats.count)],
    ['Avg R/W', stats.avgRw != null ? stats.avgRw.toFixed(1) : '—'],
    ['Genres', String(stats.genres.length)],
    ['Languages', String(stats.languages.length)],
  ];
  const verdictChips: [string, number][] = [['Perfection', stats.verdicts.perfection], ['Go for it', stats.verdicts.go_for_it], ['Timepass', stats.verdicts.timepass]];
  const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', padding: '8px 22px', borderRadius: 999, background: 'rgba(255,255,255,.14)', border: `1.5px solid ${pal.line}`, fontSize: 30, fontWeight: 700, color: pal.text };

  return (
    <div className="nl-people-card">
      <div ref={wrapRef} className="nl-people-card-frame" style={{ height: H * scale, borderRadius: 24 }}>
        <div ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: 'top left', background: pal.bg, color: pal.text }}>
          <div style={{ position: 'absolute', right: -W * 0.25, top: -H * 0.1, width: W * 0.95, height: W * 0.95, borderRadius: '50%', background: pal.glowA }} />
          <div style={{ position: 'absolute', right: -W * 0.22, bottom: -W * 0.3, width: W * 0.85, height: W * 0.85, borderRadius: '50%', background: pal.glowB }} />
          <svg width={W} height={330} viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} aria-hidden="true">
            {[120, 190, 260, 330, 400].map((r) => <circle key={r} cx="880" cy="60" r={r} fill="none" stroke={variant === 'author' ? 'rgba(245,197,66,.28)' : 'rgba(255,255,255,.22)'} strokeWidth="1.5" />)}
            {[[120, 70], [260, 190], [420, 90], [610, 210], [730, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#fff" />)}
          </svg>

          {/* Role tag at the very top, like the "User since" chip on reader cards. */}
          <div style={{ position: 'absolute', zIndex: 5, top: 30, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 38px', borderRadius: 999, background: pal.tagBg, border: `3px solid ${variant === 'author' ? '#f5c542' : '#9ff3f5'}`, boxShadow: '0 10px 28px rgba(0,0,0,.35)', color: pal.tagText, fontSize: 34, fontWeight: 900, letterSpacing: '.28em', textTransform: 'uppercase' }}>
            <span aria-hidden="true">✦</span>{variant === 'author' ? 'Author' : 'Reviewer'}<span aria-hidden="true">✦</span>
          </div>

          <div style={{ position: 'absolute', left: 70, top: 215, width: 230, height: 230, borderRadius: '50%', padding: 12, background: pal.ring, boxShadow: '0 22px 50px rgba(0,0,0,.45)' }}>
            <div className="font-serif" style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 110, fontWeight: 700, color: '#fff', background: pal.avatarBg, border: `8px solid ${variant === 'author' ? '#2e1065' : '#013a46'}` }}>{initial}</div>
          </div>

          <div style={{ position: 'absolute', left: 335, top: 222, width: 675 }}>
            <p style={{ fontSize: 23, letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 800, color: pal.accent, marginBottom: 12 }}>{pal.kicker}</p>
            <NameBlock major={variant === 'author' ? 'last' : 'first'} name={name || (variant === 'author' ? 'Author' : 'Novelty Reader')} size={96} color={pal.text} restColor={pal.accentSoft} shadow="0 4px 22px rgba(0,0,0,.4)" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
              {followers != null && <span style={pill}><b style={{ color: pal.accent }}>{followers.toLocaleString()}</b> {followers === 1 ? 'follower' : 'followers'}</span>}
              {handle && <span style={{ ...pill, color: pal.accentSoft, maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis' }}>@{sanitizeUserText(handle.replace(/^@/, ''), 60)}</span>}
            </div>
          </div>

          <div style={{ position: 'absolute', left: 70, right: 70, top: 505, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {tiles.map(([label, value]) => (
              <div key={label} style={{ borderRadius: 28, padding: '22px 14px', textAlign: 'center', background: pal.glass, border: `1.5px solid ${pal.line}` }}>
                <div className="font-serif" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, color: '#fff' }}>{value}</div>
                <div style={{ marginTop: 10, fontSize: 19, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 800, color: pal.accent }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ position: 'absolute', left: 70, right: 70, top: 668, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {verdictChips.filter(([, n]) => n > 0).map(([label, n]) => <span key={label} style={{ ...pill, fontSize: 26, padding: '7px 20px' }}><b style={{ color: pal.accent }}>{n}</b> {label}</span>)}
            {stats.genres.slice(0, 4).map((g) => <span key={g} style={{ ...pill, fontSize: 26, padding: '7px 20px', background: 'transparent', color: pal.soft }}>{sanitizeUserText(g, 30)}</span>)}
          </div>

          {stats.top.length > 0 && (
            <div style={{ position: 'absolute', left: 70, right: 70, top: 790 }}>
              <p style={{ fontSize: 24, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: pal.accent, marginBottom: 16 }}>{variant === 'author' ? 'Top rated here' : 'Top reviews'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 220px)', gap: 26 }}>
                {stats.top.map((r) => {
                  const src = cover(r);
                  return (
                    <div key={r.id} style={{ minWidth: 0 }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 22, overflow: 'hidden', background: pal.glass, border: `2px solid ${pal.line}`, boxShadow: '0 14px 30px rgba(0,0,0,.35)' }}>
                        {src && <CardCover src={src} />}
                        <span style={{ position: 'absolute', right: 10, bottom: 10, padding: '4px 14px', borderRadius: 999, fontSize: 26, fontWeight: 900, color: '#1a0836', background: pal.accent }}>{Number.isFinite(r.rw_rating) ? r.rw_rating.toFixed(1) : '—'}</span>
                      </div>
                      <p className="font-serif" style={{ marginTop: 12, fontSize: 24, fontWeight: 700, lineHeight: 1.16, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sanitizeUserText(r.title, 90)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ position: 'absolute', right: 70, bottom: 30, display: 'flex', alignItems: 'center', gap: 16, borderRadius: 26, padding: '12px 22px', background: pal.boxBg, border: '1.5px solid rgba(255,255,255,.7)', boxShadow: '0 18px 40px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'grid', placeItems: 'center', width: 84, height: 84, borderRadius: 22, background: '#fff', boxShadow: '0 8px 20px rgba(0,0,0,.25)' }}><img src={LOGO} alt="Novelty Library" style={{ width: 76, height: 76, objectFit: 'contain' }} /></div>
            <div><p className="font-serif" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: pal.boxInk }}>Novelty Library</p><p style={{ marginTop: 8, fontSize: 15, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 900, color: pal.boxAccent }}>{pal.footer}</p></div>
          </div>
        </div>
      </div>
      <div className="nl-people-card-actions">
        {isAdmin && <button type="button" onClick={() => void download()} disabled={busy} className="nl-people-btn is-primary"><Download aria-hidden="true" />{busy ? 'Preparing…' : 'Download card (PNG)'}</button>}
        <button type="button" onClick={() => void share()} className="nl-people-btn">{shared ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}{shared ? 'Link copied' : 'Share page'}</button>
      </div>
    </div>
  );
}
