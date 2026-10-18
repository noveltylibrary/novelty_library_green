import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Share2, X } from 'lucide-react';
import type { Review } from '@/types/review';
import { NlLogo } from '@/components/NlLogo';
import { normalizePosterUrl } from '@/lib/posterUrl';
import { safeExternalUrl, sanitizeUserText } from '@/lib/sanitize';
import { normalizeVerdict, verdictLabel } from '@/lib/verdict';

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

function loadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = window.setTimeout(() => resolve(false), 6000);
    img.onload = () => { window.clearTimeout(t); resolve(true); };
    img.onerror = () => { window.clearTimeout(t); resolve(false); };
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

function CardFace({ review, nl, cover }: { review: Review; nl: number | null; cover: string | null }) {
  const v = normalizeVerdict(review.verdict);
  const rw = Number.isFinite(review.rw_rating) ? review.rw_rating.toFixed(1) : '—';
  const title = sanitizeUserText(review.title, 120);
  const titleSize = title.length > 46 ? 62 : title.length > 28 ? 74 : 88;
  const pill = { padding: '10px 26px', borderRadius: 999, fontSize: 28, fontWeight: 800, letterSpacing: '.04em', background: C.glass, border: `2px solid ${C.line}`, color: '#fff' } as const;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', borderRadius: RADIUS, color: '#fff', fontFamily: "Inter, system-ui, sans-serif", background: `radial-gradient(120% 70% at 85% 0%, rgba(92,225,230,.45) 0%, rgba(92,225,230,0) 60%), radial-gradient(90% 60% at 0% 100%, rgba(0,151,178,.5) 0%, rgba(0,151,178,0) 60%), linear-gradient(160deg, ${C.deep} 0%, ${C.deep2} 45%, ${C.teal} 130%)`, display: 'flex', flexDirection: 'column', padding: '72px 76px 64px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <NlLogo width={64} height={64} />
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase', color: C.mint }}>Novelty Library</div>
        {v && <div style={{ marginLeft: 'auto', ...pill, background: 'rgba(255,255,255,.95)', color: C.deep2, border: 'none' }}>{verdictLabel(v)}</div>}
      </div>

      <div style={{ display: 'flex', gap: 48, marginTop: 56, alignItems: 'flex-start' }}>
        <div style={{ width: 360, height: 360, flexShrink: 0, borderRadius: 34, overflow: 'hidden', background: 'linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.06))', border: `2px solid ${C.line}`, boxShadow: '0 28px 50px rgba(0,20,28,.5)', display: 'grid', placeItems: 'center', fontSize: 120 }}>
          {cover ? <img src={cover} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span aria-hidden="true">📖</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: C.cyan }}>Review</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 120, fontWeight: 900, lineHeight: 1 }}>{rw}</span><span style={{ fontSize: 36, color: C.faint, fontWeight: 700 }}>/10 R/W</span></div>
          {nl !== null && <div style={{ ...pill, alignSelf: 'flex-start' }}>★ {nl.toFixed(1)} NL</div>}
        </div>
      </div>

      <div style={{ marginTop: 52, fontFamily: "'Playfair Display', Georgia, serif", fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, overflowWrap: 'anywhere' }}>{title}</div>
      <div style={{ marginTop: 16, fontSize: 38, color: C.soft }}>by {sanitizeUserText(review.author, 80)}</div>

      <div style={{ marginTop: 40, padding: '34px 38px', borderRadius: 34, background: C.glass, border: `2px solid ${C.line}`, fontSize: 33, lineHeight: 1.5, color: 'rgba(255,255,255,.92)', fontStyle: 'italic' }}>“{sanitizeUserText(excerpt(review.review_text), 300)}”</div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {review.genre && <span style={pill}>{sanitizeUserText(review.genre, 40)}</span>}
        {review.language && <span style={pill}>{sanitizeUserText(review.language, 30)}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 28, fontWeight: 700, color: C.mint }}>{typeof window !== 'undefined' ? window.location.host : ''}</span>
      </div>
    </div>
  );
}

/** Review page: "Share as card" builds a rounded 4:5 PNG (transparent corners) the same way the profile card is exported. */
export function ReviewShareButton({ review, nl }: { review: Review; nl: number | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
      const ok = src ? await loadImage(src) : false;
      setCover(ok ? src : null);
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

  return (
    <>
      <button type="button" className="nl-share-btn w-full mt-3" onClick={() => void build()}><Share2 className="w-4 h-4" aria-hidden="true" /> Share as card</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="nl-share-title" className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,20,28,.66)', backdropFilter: 'blur(7px)' }} onClick={() => setOpen(false)}>
          <div className="nl-share-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="nl-share-title" className="font-serif text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Share this review</h2>
              <button type="button" className="nl-shelf-x" onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="nl-share-preview">
              {png ? <img src={png} alt={`Share card for ${review.title}`} /> : error ? <p className="text-sm p-6 text-center" style={{ color: '#b91c1c' }} role="alert">{error}</p> : <div className="nl-share-wait"><Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" /><span>Creating your card…</span></div>}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="button" className="btn-primary !w-auto" onClick={download} disabled={!png}><Download className="w-4 h-4" /> Download PNG</button>
              {canShareFile && <button type="button" className="btn-ghost !w-auto" onClick={() => void share()} disabled={!png}><Share2 className="w-4 h-4" /> Share…</button>}
              {error && <button type="button" className="btn-ghost !w-auto" onClick={() => void build()} disabled={busy}>Try again</button>}
            </div>
          </div>
          {/* Off-screen export canvas: fixed pixel size, exactly what is downloaded. */}
          <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
            <div ref={faceRef} style={{ width: W, height: H }}><CardFace review={review} nl={nl} cover={cover} /></div>
          </div>
        </div>
      )}
    </>
  );
}
