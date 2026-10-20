import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, Link2, Loader2, Share2, X } from 'lucide-react';
import type { Review } from '@/types/review';
import { NlLogo } from '@/components/NlLogo';
import { extractDriveId, normalizePosterUrl } from '@/lib/posterUrl';
import { safeExternalUrl, sanitizeUserText } from '@/lib/sanitize';
import { normalizeVerdict, verdictLabel } from '@/lib/verdict';
import { useOverlayHistory } from '@/lib/overlayHistory';

// Same palette, export recipe and rounded transparent corners as the profile card export (ProfileCard.tsx).
const C = { deep: '#012b36', deep2: '#013a46', teal: '#0097b2', cyan: '#5ce1e6', mint: '#9ff3f5', soft: 'rgba(255,255,255,.78)', faint: 'rgba(255,255,255,.6)', glass: 'rgba(255,255,255,.10)', line: 'rgba(255,255,255,.24)' };
const IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const W = 1080;
const H = 1350;
const RADIUS = 68;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function excerpt(text: string, max = 260): string {
  const first = (text || '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(' '))).replace(/[,.;:\s]+$/, '')}…`;
}

/**
 * Returns the cover as an inline data URL (so the export can never lose it), or null when the image host does not
 * allow reading it (no CORS). The card then draws its own cover instead of an empty box.
 */
async function inlineCover(src: string, extraSources: string[] = []): Promise<string | null> {
  const attempt = (url: string) => new Promise<string | null>((resolve) => {
    const img = new Image();
    const t = window.setTimeout(() => resolve(null), 7000);
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      window.clearTimeout(t);
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.92));
      } catch { resolve(null); }
    };
    img.onerror = () => { window.clearTimeout(t); resolve(null); };
    img.src = url;
  });
  // Blog-connected covers (Google Drive / Blogger) often refuse to be read by a page, so a few address forms are tried.
  // Covers stored in Supabase always allow it.
  const candidates = [src, ...extraSources];
  for (const url of candidates) {
    const got = await attempt(url);
    if (got) return got;
  }
  return null;
}

/** Own-drawn cover for books whose image can't be exported: initials on a deep-teal jacket. */
function DrawnCover({ title }: { title: string }) {
  const initials = title.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'NL';
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: `linear-gradient(155deg, ${C.teal} 0%, ${C.deep2} 100%)`, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 26, top: 0, bottom: 0, width: 6, background: 'rgba(255,255,255,.28)' }} />
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 128, fontWeight: 700, lineHeight: 1, letterSpacing: '.02em' }}>{initials}</div>
      <div style={{ width: 90, height: 4, borderRadius: 2, background: C.cyan }} />
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase', color: C.mint }}>Novelty</div>
    </div>
  );
}

function CardFace({ review, nl, cover }: { review: Review; nl: number | null; cover: string | null }) {
  const v = normalizeVerdict(review.verdict);
  const rw = Number.isFinite(review.rw_rating) ? review.rw_rating.toFixed(1) : '—';
  const title = sanitizeUserText(review.title, 120);
  const titleSize = title.length > 46 ? 64 : title.length > 28 ? 76 : 90;
  const pill = { padding: '10px 26px', borderRadius: 999, fontSize: 28, fontWeight: 800, letterSpacing: '.03em', background: C.glass, border: `2px solid ${C.line}`, color: '#fff', whiteSpace: 'nowrap' } as const;
  // One column, one set of edges: every block is exactly the card's inner width and the gaps between blocks are equal.
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', borderRadius: RADIUS, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', background: `radial-gradient(120% 70% at 85% 0%, rgba(92,225,230,.45) 0%, rgba(92,225,230,0) 60%), radial-gradient(90% 60% at 0% 100%, rgba(0,151,178,.5) 0%, rgba(0,151,178,0) 60%), linear-gradient(160deg, ${C.deep} 0%, ${C.deep2} 45%, ${C.teal} 130%)`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '76px 84px', boxSizing: 'border-box' }}>
      {/* 1 · brand + verdict, always on one line */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <NlLogo width={72} height={72} style={{ flex: 'none' }} />
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: '.01em' }}>Novelty Library</span>
        </div>
        {v && <span style={{ ...pill, background: 'rgba(255,255,255,.96)', color: C.deep2, border: 'none', flex: 'none' }}>{verdictLabel(v)}</span>}
      </div>

      {/* 2 · cover + scores */}
      <div style={{ display: 'flex', gap: 52, alignItems: 'center' }}>
        <div style={{ width: 340, height: 340, flex: 'none', borderRadius: 34, overflow: 'hidden', background: 'linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.06))', border: `2px solid ${C.line}`, boxShadow: '0 28px 50px rgba(0,20,28,.5)', display: 'grid', placeItems: 'center' }}>
          {cover ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <DrawnCover title={title} />}
        </div>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: C.cyan }}>Reviewer score</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, whiteSpace: 'nowrap' }}><span style={{ fontSize: 132, fontWeight: 900, lineHeight: 1 }}>{rw}</span><span style={{ fontSize: 38, color: C.faint, fontWeight: 700 }}>/ 10</span></div>
          {nl !== null && <span style={{ ...pill, alignSelf: 'flex-start' }}>★ {nl.toFixed(1)} · readers</span>}
        </div>
      </div>

      {/* 3 · title + author */}
      <div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, overflowWrap: 'anywhere' }}>{title}</div>
        <div style={{ marginTop: 18, fontSize: 38, color: C.soft }}>by {sanitizeUserText(review.author, 80)}</div>
      </div>

      {/* 4 · excerpt */}
      <div style={{ padding: '34px 40px', borderRadius: 34, background: C.glass, border: `2px solid ${C.line}`, fontSize: 32, lineHeight: 1.5, color: 'rgba(255,255,255,.93)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>“{sanitizeUserText(excerpt(review.review_text, 230), 260)}”</div>

      {/* 5 · tags + site */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap' }}>
        {review.genre && <span style={pill}>{sanitizeUserText(review.genre, 28)}</span>}
        {review.language && <span style={pill}>{sanitizeUserText(review.language, 20)}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 28, fontWeight: 700, color: C.mint, whiteSpace: 'nowrap' }}>{typeof window !== 'undefined' ? window.location.host : ''}</span>
      </div>
    </div>
  );
}

/** Review page: "Share as card" builds a rounded 4:5 PNG (transparent corners) the same way the profile card is exported. */
export function ReviewShareButton({ review, nl }: { review: Review; nl: number | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useOverlayHistory(open, () => setOpen(false));
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const canShareFile = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  const fileName = `novelty-library-${(review.slug || review.title || 'review').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}.png`;

  const build = async () => {
    setOpen(true); setBusy(true); setError(null); setPng(null);
    try {
      const src = safeExternalUrl(normalizePosterUrl(review.poster_url || review.cover_image_url));
      const raw = review.poster_url || review.cover_image_url || '';
      const driveId = extractDriveId(raw);
      const extra = [driveId ? `https://lh3.googleusercontent.com/d/${driveId}=w900` : '', raw.trim()].filter((u) => u && u !== src && /^https:/i.test(u));
      setCover(src ? await inlineCover(src, extra) : null);
      await nextFrame();
      await new Promise((r) => window.setTimeout(r, 160));
      if ('fonts' in document) await document.fonts.ready;
      if (!faceRef.current) throw new Error('Card not ready');
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(faceRef.current, { cacheBust: true, pixelRatio: 1, width: W, height: H, imagePlaceholder: IMAGE_PLACEHOLDER, style: { transform: 'none', borderRadius: `${RADIUS}px` } });
      setPng(dataUrl);
    } catch (e) {
      console.error(e);
      setError('The card could not be created. Please try again after the page finishes loading.');
    } finally { setBusy(false); }
  };

  const toFile = async (): Promise<File | null> => {
    if (!png) return null;
    const blob = await (await fetch(png)).blob();
    return new File([blob], fileName, { type: 'image/png' });
  };

  const download = () => {
    if (!png) return;
    const a = document.createElement('a');
    a.href = png; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  };

  const share = async () => {
    try {
      const file = await toFile();
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: review.title, text: `${review.title} — reviewed on Novelty Library` }); return; }
    } catch (e) { if ((e as { name?: string })?.name === 'AbortError') return; }
    download();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  // Lock the page behind the popup so it can't scroll through it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const popup = open ? (
    <div role="dialog" aria-modal="true" aria-labelledby="nl-share-title" className="nl-share-overlay" onClick={() => setOpen(false)}>
      <div className="nl-share-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="nl-share-close" onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4" /></button>
        <div className="nl-share-stage">
          <div className="nl-share-preview">
            {png ? <img src={png} alt={`Share card for ${review.title}`} /> : error ? <p className="text-sm p-6 text-center" style={{ color: '#b91c1c' }} role="alert">{error}</p> : <div className="nl-share-wait"><Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" /><span>Creating your card…</span></div>}
          </div>
        </div>
        <div className="nl-share-side">
          <span className="nl-live-kicker">SHARE</span>
          <h2 id="nl-share-title" className="nl-share-title">{sanitizeUserText(review.title, 90)}</h2>
          <p className="nl-share-sub">A rounded 1080×1350 card, made for Instagram posts, stories and chats.</p>
          <div className="nl-share-actions">
            <button type="button" className="nl-share-primary" onClick={download} disabled={!png}><Download className="w-4 h-4" /> Download PNG</button>
            {canShareFile && <button type="button" className="nl-share-secondary" onClick={() => void share()} disabled={!png}><Share2 className="w-4 h-4" /> Share…</button>}
            <button type="button" className="nl-share-secondary" onClick={() => void copyLink()}>{copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />} {copied ? 'Link copied' : 'Copy review link'}</button>
            {error && <button type="button" className="nl-share-secondary" onClick={() => void build()} disabled={busy}><Copy className="w-4 h-4" /> Try again</button>}
          </div>
        </div>
      </div>
      {/* Off-screen export canvas: fixed pixel size, exactly what is downloaded. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
        <div ref={faceRef} style={{ width: W, height: H }}><CardFace review={review} nl={nl} cover={cover} /></div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className="nl-share-btn w-full mt-3" onClick={() => void build()}><Share2 className="w-4 h-4" aria-hidden="true" /> Share as card</button>
      {popup && createPortal(popup, document.body)}
    </>
  );
}
