import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Download, Instagram, Linkedin, Link2, BookOpen, RotateCcw, ChevronDown, Camera, ImagePlus, ExternalLink } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { ProfileQuestion } from '@/lib/profileQuestions';
import { NlLogo } from '@/components/NlLogo';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';
import { normalizePosterUrl } from '@/lib/posterUrl';
import { answerImageUrls, answerText, decodeOtherAnswer } from '@/components/ProfileQuestionAnswer';

export type ProfileCardData = {
  name: string | null;
  username: string | null;
  /** Followers count shown beside @username (omit to hide). */
  followerCount?: number | null;
  avatarUrl: string | null;
  headerImageUrl: string | null;
  /** Portrait banner (1336 x 2048) used only by the SuperBlitz card; stored in profile_answers.__superblitz_banner. */
  superBlitzBannerUrl?: string | null;
  socialLinks: { platform: string; url: string }[];
  /** Instagram handle (with or without @ / URL). Shown at the bottom of the card. */
  instagram?: string | null;
  booksThisMonth: number | null;
  totalBooksRead: number | null;
  publishedBooks: number;
  /** Legacy average of the reader's own R/W scores. Only used as a fallback when avgNlRating is not supplied. */
  avgRating: number | null;
  /** Average NL rating across the reader's published reviews (shown big, with a star, in the stats row). */
  avgNlRating?: number | null;
  readingSince: number | null;
  favoriteBook: string | null;
  favoriteAuthor: string | null;
  favoriteGenre: string | null;
  publishedReviews: { id: string; reviewNo: string | null; title: string; author: string; coverUrl: string | null; /** Community Reviews poster (square). Preferred over coverUrl. */ posterUrl?: string | null; /** NL rating of this review (0-10). */ nlRating?: number | null; rating?: number | null }[];
  answers: Record<string, unknown>;
  questions: ProfileQuestion[];
};

const LOGO = '/novelty-library-logo.png';
// SuperBlitz geometry (card-local px). The card is the old frame artwork cropped to the white card: 668 x 1024.
// The white ring + notches are the banner area; PANEL is the inner profile panel (sharp vertices, rounded when drawn).
export const SB_BANNER_SIZE = { width: 1336, height: 2048 } as const; // 2x of the 668 x 1024 card
const SB_PANEL: [number, number, number][] = [[21,20,38],[217,20,0],[345,163,30],[553,163,0],[648,271,26],[648,1002,38],[516,1002,0],[404,884,26],[204,884,0],[104,777,30],[21,777,38]];
function sbPanelPath(): string {
  const pts = SB_PANEL; const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const [x, y, r] = pts[i]; const [px, py] = pts[(i + n - 1) % n]; const [nx, ny] = pts[(i + 1) % n];
    const l1 = Math.hypot(px - x, py - y), l2 = Math.hypot(nx - x, ny - y); const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [x + (px - x) / l1 * rr, y + (py - y) / l1 * rr], b = [x + (nx - x) / l2 * rr, y + (ny - y) / l2 * rr];
    d += `${i === 0 ? 'M' : 'L'}${a[0].toFixed(1)} ${a[1].toFixed(1)}${rr > 0 ? ` Q${x} ${y} ${b[0].toFixed(1)} ${b[1].toFixed(1)}` : ''}`;
  }
  return d + 'Z';
}
const FORMATS = [
  { key: '9:16', width: 1080, height: 1920 },
  { key: '16:9', width: 1600, height: 900 },
  { key: '3:4', width: 1200, height: 1600 },
  { key: '4:5', width: 1080, height: 1350 },
  { key: '1:1', width: 1080, height: 1080 },
  // Banner-framed card: uploaded banner fills the card, profile sits inside the notched panel. Exports at 2x (1336 x 2048).
  { key: 'SuperBlitz', width: 668, height: 1024 },
] as const;
export type FormatKey = (typeof FORMATS)[number]['key'];
export const FORMAT_OPTIONS = FORMATS;
export function asFormatKey(v: unknown): FormatKey | null { return FORMATS.some((f) => f.key === v) ? (v as FormatKey) : null; }
const PREVIEW_FORMAT: FormatKey = '4:5';

/** A 1x1 transparent gif used when a remote image refuses to be exported (no CORS). */
const IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Poster palette: the same deep-teal -> bright-teal family as the Submit-page review poster.
const C = {
  deep: '#012b36',
  deep2: '#013a46',
  teal: '#0097b2',
  cyan: '#5ce1e6',
  mint: '#9ff3f5',
  ink: '#ffffff',
  soft: 'rgba(255,255,255,.74)',
  faint: 'rgba(255,255,255,.58)',
  glass: 'rgba(255,255,255,.10)',
  glassStrong: 'rgba(255,255,255,.16)',
  line: 'rgba(255,255,255,.22)',
};

/**
 * Progressive "make it fit" steps. The card is a fixed-size canvas (exactly the
 * pixel size that gets downloaded). If a reader has a lot of content, we first
 * shrink the type (it starts slightly enlarged so sparse cards fill the canvas),
 * then trim the lists, until nothing overflows.
 */
const FIT_STEPS = (() => {
  const steps: { m: number; reviews: number }[] = [];
  // Start large so sparse cards fill the canvas, then shrink ~5% at a time until nothing overflows.
  for (let m = 1.9; m >= 0.32; m *= 0.95) {
    steps.push({ m: Number(m.toFixed(3)), reviews: m > 0.7 ? 5 : m > 0.55 ? 4 : m > 0.45 ? 3 : m > 0.38 ? 2 : 1 });
  }
  return steps;
})();

/** Reduces '@name', 'instagram.com/name/' or a full URL to a bare handle. */
export function cleanInstagram(value: string | null | undefined): string {
  return (value || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0].replace(/^@+/, '').slice(0, 30);
}
/** Name size steps down with length so long names stay readable and never run off the card. */
function nameScale(name: string): number {
  const n = name.trim().length;
  return n <= 9 ? 1 : n <= 14 ? 0.82 : n <= 20 ? 0.66 : n <= 28 ? 0.54 : 0.46;
}
function normalizeUrl(value: string) { return safeExternalUrl(value) || '#'; }
function platformLabel(platform: string) { return platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1); }
function platformIcon(platform: string, size: number) {
  if (platform === 'instagram') return <Instagram width={size} height={size} />;
  if (platform === 'linkedin') return <Linkedin width={size} height={size} />;
  return <Link2 width={size} height={size} />;
}

/** True when a fit column's content runs past its box. Uses offset* metrics, which ignore the entrance animation's transforms. */
function columnOverflows(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-fit]')).some((col) => {
    const last = col.lastElementChild as HTMLElement | null;
    return !!last && last.offsetTop + last.offsetHeight > col.clientHeight + 1;
  });
}
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function imageAnswerGrid(urls: string[], cols: number): string { return urls.length <= 1 ? '1fr' : cols === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'; }

export function ProfileCard({ data, download = false, onAvatarUpload, onHeaderUpload, onSuperBlitzBannerUpload, onViewPublicProfile, onFollowersClick, layout = 'inline', initialFormat, publicFormat, onPublicFormatChange }: { data: ProfileCardData; onFollowersClick?: () => void; download?: boolean; onAvatarUpload?: () => void; onHeaderUpload?: () => void; onSuperBlitzBannerUpload?: () => void; onViewPublicProfile?: () => void; layout?: 'inline' | 'rows'; initialFormat?: FormatKey; publicFormat?: FormatKey; onPublicFormatChange?: (f: FormatKey) => void | Promise<void> }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<FormatKey>(initialFormat || PREVIEW_FORMAT);
  const [publicSaved, setPublicSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
  const [inView, setInView] = useState(false);
  const [replay, setReplay] = useState(0);
  const selected = FORMATS.find((f) => f.key === format) || FORMATS[3];
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / selected.width) : 1;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setBoxWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start the entrance sequence only once the card is actually on screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const downloadCard = async (formatOverride?: FormatKey) => {
    if (!canvasRef.current || downloading) return;
    const exportFormat = formatOverride || format;
    if (exportFormat !== format) setFormat(exportFormat);
    setDownloading(true); // renders the card in its final, motion-free state
    try {
      await nextFrame();
      await new Promise((r) => window.setTimeout(r, 120));
      if ('fonts' in document) await document.fonts.ready;
      const exportSelected = FORMATS.find((f) => f.key === exportFormat) || selected;
      const options = {
        cacheBust: true,
        pixelRatio: exportFormat === 'SuperBlitz' ? 2 : 1,
        width: exportSelected.width,
        height: exportSelected.height,
        backgroundColor: exportFormat === 'SuperBlitz' ? '#ffffff' : C.deep2,
        imagePlaceholder: IMAGE_PLACEHOLDER,
        // The on-screen preview is scaled down with CSS; export at full size.
        style: { transform: 'none' },
      };
      // First pass warms up image/font loading, second pass is the real export.
      await toPng(canvasRef.current, options).catch(() => undefined);
      const dataUrl = await toPng(canvasRef.current, options);
      const a = document.createElement('a');
      a.download = `novelty-library-profile-${data.username || 'reader'}-${exportFormat.replace(':', 'x')}.png`;
      a.href = dataUrl;
      a.click();
    } catch (error) {
      console.error(error);
      window.alert('The profile card could not be exported. Please try again after the images finish loading.');
    } finally { setDownloading(false); }
  };

  return <div className="w-full">

    {layout !== 'rows' && (download || onAvatarUpload || onHeaderUpload || onViewPublicProfile) && <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
      {onViewPublicProfile && <button type="button" onClick={onViewPublicProfile} className="btn-ghost !w-auto !px-3 !py-2 text-sm"><ExternalLink className="w-4 h-4" /> View public profile</button>}
      {download && <button type="button" onClick={() => setReplay((n) => n + 1)} className="btn-ghost !w-auto !px-3 !py-2 text-sm" title="Replay animation" aria-label="Replay animation"><RotateCcw className="w-4 h-4" /></button>}
      {download && <div className="relative">
        <button type="button" onClick={() => setDownloadMenuOpen(v => !v)} disabled={downloading} className="btn-primary !w-auto disabled:opacity-50"><Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download Profile Card'} <ChevronDown className="w-4 h-4" /></button>
        {downloadMenuOpen && <div className="absolute right-0 top-full mt-2 z-30 min-w-[190px] rounded-2xl p-1.5 shadow-2xl" style={{background:'var(--color-surface)',border:'1px solid var(--color-border)'}}>
          {FORMATS.map((f) => <button key={f.key} type="button" onClick={() => { setFormat(f.key); setDownloadMenuOpen(false); window.setTimeout(() => void downloadCard(f.key), 0); }} className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{f.key} <span className="opacity-60">· {f.width}×{f.height}</span>{format===f.key && <span className="float-right font-bold">✓</span>}</button>)}
        </div>}
      </div>}
    </div>}

    {/* The preview is the exact export canvas, scaled down to fit the page. What you see is what you download. */}
    <div ref={wrapRef} className="relative w-full mx-auto overflow-hidden rounded-[24px] nl-pc-preview" style={{ height: selected.height * scale, maxWidth: selected.width > selected.height ? 560 : 380, boxShadow: '0 26px 60px rgba(0,80,95,.28)', border: '1px solid rgba(8,145,178,.3)' }}>
      <CardCanvas key={`${format}-${replay}`} canvasRef={canvasRef} data={data} width={selected.width} height={selected.height} superBlitz={format === 'SuperBlitz'} scale={scale} play={inView} still={downloading} onAvatarUpload={onAvatarUpload} onHeaderUpload={onHeaderUpload} onSuperBlitzBannerUpload={onSuperBlitzBannerUpload} onFollowersClick={onFollowersClick} />
    </div>

    {layout === 'rows' && (download || onViewPublicProfile) && <div className="nl-pc-dock" style={{ maxWidth: selected.width > selected.height ? 560 : 380 }}>
      {download && <div className="nl-pc-seg" role="radiogroup" aria-label="Card format to preview" style={{ '--n': FORMATS.length, '--idx': Math.max(0, FORMATS.findIndex((f) => f.key === format)) } as CSSProperties}>
        <span className="nl-pc-seg-pill" aria-hidden="true" />
        {FORMATS.map((f) => <button key={f.key} type="button" role="radio" aria-checked={format === f.key} onClick={() => setFormat(f.key)} className="nl-pc-seg-btn" title={`${f.key} · ${f.width}×${f.height}`}>{f.key === 'SuperBlitz' ? 'Blitz' : f.key}</button>)}
      </div>}
      <div className="nl-pc-tiles">
        {download && <div className="nl-pc-tile-wrap" style={{ '--i': 0 } as CSSProperties}>
          <button type="button" onClick={() => setDownloadMenuOpen((v) => !v)} disabled={downloading} aria-haspopup="menu" aria-expanded={downloadMenuOpen} className="nl-pc-tile nl-pc-tile-primary nl-ico-download disabled:opacity-60">
            <span className="nl-pc-tile-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="nl-ico-arrow" d="M12 4v11m0 0l-4-4m4 4l4-4" /><path d="M5 19h14" /></svg></span>
            <span className="nl-pc-tile-txt"><strong>{downloading ? 'Preparing…' : 'Download'}</strong><small>{format} PNG</small></span>
            <ChevronDown className={`nl-pc-tile-chev ${downloadMenuOpen ? 'is-open' : ''}`} aria-hidden="true" />
          </button>
          {downloadMenuOpen && <div className="nl-pc-menu" role="menu">
            {FORMATS.map((f, k) => <button key={f.key} type="button" role="menuitem" style={{ '--k': k } as CSSProperties} onClick={() => { setFormat(f.key); setDownloadMenuOpen(false); window.setTimeout(() => void downloadCard(f.key), 0); }}>{f.key} <span>· {f.width}×{f.height}</span>{format === f.key && <b>✓</b>}</button>)}
          </div>}
        </div>}
        {onViewPublicProfile && <div className="nl-pc-tile-wrap" style={{ '--i': 1 } as CSSProperties}>
          <button type="button" onClick={onViewPublicProfile} className="nl-pc-tile nl-ico-open">
            <span className="nl-pc-tile-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6" className="nl-ico-arrow" /><path d="M20 4l-9 9" className="nl-ico-arrow" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg></span>
            <span className="nl-pc-tile-txt"><strong>Public profile</strong><small>See what others see</small></span>
          </button>
        </div>}
        {download && <div className="nl-pc-tile-wrap" style={{ '--i': 2 } as CSSProperties}>
          <button type="button" onClick={() => setReplay((n) => n + 1)} className="nl-pc-tile nl-ico-replay" aria-label="Replay animation">
            <span className="nl-pc-tile-ico"><svg key={replay} className="nl-ico-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg></span>
            <span className="nl-pc-tile-txt"><strong>Replay</strong><small>Play the intro again</small></span>
          </button>
        </div>}
        {onPublicFormatChange && <div className="nl-pc-tile-wrap" style={{ '--i': 3 } as CSSProperties}>
          <div className={`nl-pc-tile nl-ico-globe nl-pc-tile-select ${publicSaved ? 'is-saved' : ''}`}>
            <span className="nl-pc-tile-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{publicSaved ? <path className="nl-ico-check" d="M5 13l4 4L19 7" /> : <><circle cx="12" cy="12" r="9" /><path className="nl-ico-meridian" d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></>}</svg></span>
            <span className="nl-pc-tile-txt"><strong>{publicSaved ? 'Saved' : 'Public view'}</strong><small>Shown as {publicFormat || PREVIEW_FORMAT}</small></span>
            <ChevronDown className="nl-pc-tile-chev" aria-hidden="true" />
            <select value={publicFormat || PREVIEW_FORMAT} onChange={async (e) => { await onPublicFormatChange(e.target.value as FormatKey); setPublicSaved(true); window.setTimeout(() => setPublicSaved(false), 2200); }} aria-label="Card format other readers see on your public profile">{FORMATS.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}</select>
          </div>
        </div>}
      </div>
    </div>}
  </div>;
}

/** Counts a number up from zero. In `still` mode (export) it shows the final value immediately. */
function CountUp({ value, play, still, delay }: { value: string; play: boolean; still: boolean; delay: number }) {
  const target = parseFloat(value);
  const decimals = value.includes('.') ? value.split('.')[1].length : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still || !play || !Number.isFinite(target)) return;
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, still, target, delay]);
  if (still || !Number.isFinite(target)) return <>{value}</>;
  return <>{shown.toFixed(decimals)}</>;
}

/**
 * Real artwork for a published review: the Community Reviews poster first (upgraded to a high-res URL), then the
 * book cover. The placeholder icon only appears when every source is missing or fails to load.
 */
function Cover({ urls, w, h, radius, iconSize }: { urls: (string | null | undefined)[]; w: number; h: number; radius: number; iconSize: number }) {
  const sources = urls.map((u) => safeExternalUrl(normalizePosterUrl(u))).filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
  const [idx, setIdx] = useState(0);
  const src = sources[idx];
  return <div style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.06))', border: `1px solid ${C.line}`, boxShadow: '0 8px 18px rgba(0,30,40,.35)', display: 'grid', placeItems: 'center' }}>
    <BookOpen width={iconSize} height={iconSize} style={{ color: C.mint, gridArea: '1 / 1' }} />
    {src && <img key={src} src={src} alt="" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async" onError={() => setIdx((i) => i + 1)} style={{ gridArea: '1 / 1', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
  </div>;
}

/** Solid SVG star (same family as the Community Reviews NL star), used big beside the average NL rating. */
function StarIcon({ size, style }: { size: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(0,25,35,.35))', ...style }}>
    <defs><linearGradient id="nlStarFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe58f" /><stop offset="1" stopColor="#ffc233" /></linearGradient></defs>
    <path d="M12 1.9l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.6 1.4-7.1-5.3-5 7.2-.9z" fill="url(#nlStarFill)" stroke="#ffd66b" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>;
}

/** "N followers" pill shown next to @username on the card. Clickable only when a handler is given (never in exports). */
function FollowerPill({ count, fontSize, padX, padY, onClick }: { count?: number | null; fontSize: number; padX: number; padY: number; onClick?: () => void }) {
  if (count == null) return null;
  const style: CSSProperties = { flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', fontSize, fontWeight: 700, padding: `${padY}px ${padX}px`, borderRadius: 999, background: 'rgba(255,255,255,.14)', border: `1px solid ${C.line}`, color: C.ink, cursor: onClick ? 'pointer' : 'default' };
  const label = <><b style={{ color: C.mint }}>{count.toLocaleString()}</b> {count === 1 ? 'follower' : 'followers'}</>;
  return onClick ? <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} style={style} aria-label={`${count} followers — view list`}>{label}</button> : <span style={style}>{label}</span>;
}

function CardCanvas({ canvasRef, data, width: w, height: h, superBlitz = false, scale, play, still, onAvatarUpload, onHeaderUpload, onSuperBlitzBannerUpload, onFollowersClick }: { onFollowersClick?: () => void; canvasRef: RefObject<HTMLDivElement>; data: ProfileCardData; width: number; height: number; superBlitz?: boolean; scale: number; play: boolean; still: boolean; onAvatarUpload?: () => void; onHeaderUpload?: () => void; onSuperBlitzBannerUpload?: () => void }) {
  /*
   * One information architecture, responsive composition.
   * The card keeps the same reading order at every aspect ratio, but the
   * columns change intelligently so no format feels like a squeezed version
   * of another format.
   */
  const ratio = w / h;
  const isWide = ratio >= 1.45;
  const isLandscape = ratio >= 0.95;
  const isSquareish = ratio >= 0.78 && ratio < 0.95;
  const isPortrait = ratio < 0.78;
  // The 4:5 card gets a dedicated editorial composition: the published shelf
  // stays prominent, then profile tags, then a compact 3-column answer grid.
  const isFourFive = Math.abs(ratio - 0.8) < 0.035;
  const isTall = ratio < 0.68;
  const compact = w <= 1080 || h <= 1080;

  const signature = `${w}x${h}|${data.publishedReviews.length}|${data.questions.length}|${JSON.stringify(data.answers).length}|${data.name}|${data.favoriteBook}|${data.favoriteAuthor}|${data.favoriteGenre}|${data.socialLinks.length}`;
  const [step, setStep] = useState(0);
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) { setLastSignature(signature); setStep(0); }
  const fit = FIT_STEPS[Math.min(step, FIT_STEPS.length - 1)];

  useLayoutEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    if (columnOverflows(root) && step < FIT_STEPS.length - 1) setStep(step + 1);
  }, [step, signature, canvasRef]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = canvasRef.current;
      if (!root) return;
      if (columnOverflows(root)) setStep((s) => Math.min(s + 1, FIT_STEPS.length - 1));
    }, 700);
    return () => window.clearTimeout(t);
  }, [signature, step, canvasRef]);

  let clock = 0.15;
  const cue = (gap = 0.1) => { clock += gap; return clock; };
  const mv = (kind: 'drop' | 'slide' | 'pop' | 'fade' | 'rise', delay: number): { className: string; style: CSSProperties } => still
    ? { className: '', style: {} }
    : { className: `nl-pc-a nl-pc-${kind}`, style: { ['--d' as string]: `${delay.toFixed(2)}s` } as CSSProperties };

  const ui = (px: number) => px / Math.max(scale, 0.2);
  // SuperBlitz keeps type close to 1:1 pixel scale: its content panel is only ~560px wide.
  const u = superBlitz ? Math.min(1.05, fit.m) : Math.min(w / 1080, h / 1350) * fit.m;
  const s = (n: number) => n * u;
  const pad = Math.max(w * 0.045, s(isTall ? 34 : 48));
  const bannerH = Math.round(isWide ? h * 0.25 : isLandscape ? h * 0.19 : isTall ? h * 0.13 : h * 0.16);
  const avatar = Math.round(isWide ? h * 0.19 : isLandscape ? h * 0.18 : isTall ? w * 0.18 : w * 0.16);

  const normalizeAnswer = (value: unknown): string => answerText(value).trim();
  const questionValues = (terms: string[]) => {
    const matches = data.questions.filter((item) => {
      const hay = `${item.key} ${item.question}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    });
    const values: string[] = [];
    matches.forEach((q) => {
      const raw = data.answers[q.key];
      if (Array.isArray(raw)) raw.forEach((v) => { const text = normalizeAnswer(v); if (text) values.push(text); });
      else { const text = normalizeAnswer(raw); if (text) values.push(text); }
    });
    return [...new Set(values)];
  };
  const questionValue = (terms: string[]) => {
    const values = questionValues(terms);
    return values.length ? values[0] : null;
  };
  const listValue = (terms: string[]) => questionValues(terms).flatMap((value) => value.split(/[,;|]/).map((v) => v.trim()).filter(Boolean));


  const bio = questionValue(['bio', 'about me', 'about', 'reader bio']);
  const city = questionValue(['city', 'town', 'location', 'residence']);
  const state = questionValue(['state', 'province']);
  const country = questionValue(['country']);
  const gender = questionValue(['gender']);
  const languages = [...new Set(listValue(['languages read', 'language read', 'languages', 'language']))].sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).slice(0, 5);
  const genres = [...new Set(listValue(['preferred genres', 'preferred genre', 'favourite genres', 'favorite genres', 'genres']))].slice(0, 5);
  // Occupation and age are matched on whole words (so "language", "page", "stage" never count as "age") and shown as
  // plain answer tags at the top, next to languages and genres - never with their question text.
  const normQ = (q: ProfileQuestion) => `${q.key} ${q.question}`.toLowerCase().replace(/[_\-]+/g, ' ');
  const isOccupationQ = (q: ProfileQuestion) => /\b(occupation|profession|job)\b/.test(normQ(q));
  const isAgeQ = (q: ProfileQuestion) => /\bage\b/.test(normQ(q)) && !/\b(start|started|first|began|begin|since|when|book|books|read|reading)\b/.test(normQ(q));
  const answersOf = (pred: (q: ProfileQuestion) => boolean) => [...new Set(data.questions.filter(pred).flatMap((q) => {
    if (q.type === 'image_upload') return [];
    const raw = data.answers[q.key];
    return (Array.isArray(raw) ? raw : [raw]).map((v) => normalizeAnswer(v)).filter(Boolean);
  }))];
  const occupation = answersOf(isOccupationQ).slice(0, 3).join(', ');
  const ageRaw = answersOf(isAgeQ)[0] || '';
  const age = /^\d{1,3}$/.test(ageRaw) ? `${ageRaw} yrs` : ageRaw;
  const location = [city, state, country].filter((v): v is string => typeof v === 'string' && !!v).join(', ');

  const answeredQuestions = data.questions.filter((q) => {
    const value = data.answers[q.key];
    return value !== undefined && value !== null && (q.type === 'image_upload' ? answerImageUrls(value).length > 0 : answerText(value).trim() !== '');
  });
  const fixedMeta = new Set(['bio', 'about me', 'about', 'reader bio', 'city', 'town', 'location', 'residence', 'state', 'province', 'country', 'gender', 'languages read', 'language read', 'languages', 'language', 'preferred genres', 'preferred genre', 'favourite genres', 'favorite genres', 'genres']);
  const isFixedQuestion = (q: ProfileQuestion) => isOccupationQ(q) || isAgeQ(q) || Array.from(fixedMeta).some(term => `${q.key} ${q.question}`.toLowerCase().includes(term));
  const tagQuestions = answeredQuestions.filter(q => (q.profile_card_mode === 'tag' || q.profile_card_mode === 'tag_no_question') && !isFixedQuestion(q));
  const answerQuestions = answeredQuestions.filter(q => q.profile_card_mode !== 'tag' && q.profile_card_mode !== 'tag_no_question' && !isFixedQuestion(q));
  const sortValues = (q: ProfileQuestion, value: unknown) => {
    const values = Array.isArray(value) ? value.map(String) : [answerText(value)];
    return q.alphabetical_sort ? values.filter(Boolean).sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' })) : values.filter(Boolean);
  };

  const reviewsLimit = isWide ? 3 : isTall ? 1 : 2;
  const reviews = data.publishedReviews.slice(0, reviewsLimit);
  const moreReviews = Math.max(0, data.publishedReviews.length - reviews.length);

  const tBanner = 0;
  const tAvatar = cue(0.1);
  const tHero = cue(0.2);
  const tMeta = cue(0.12);

  const stats: { value: string; label: string; icon: ReactNode; nl?: boolean }[] = [
    { value: data.booksThisMonth == null ? '—' : String(data.booksThisMonth), label: 'read this month', icon: <BookOpen width={s(18)} height={s(18)} /> },
    { value: data.totalBooksRead == null ? '—' : String(data.totalBooksRead), label: 'books read', icon: <BookOpen width={s(18)} height={s(18)} /> },
    { value: String(data.publishedBooks), label: 'published reviews', icon: <BookOpen width={s(18)} height={s(18)} /> },
    // Average NL rating (not the reader's own R/W scores). Shown as the number plus a big SVG star; no text label.
    { value: (data.avgNlRating ?? data.avgRating) == null ? '—' : Number(data.avgNlRating ?? data.avgRating).toFixed(1), label: 'avg NL rating', icon: <StarIcon size={s(18)} />, nl: true },
  ];

  const statCues = stats.map(() => cue(0.08));
  const statColumns = isTall || isWide ? 2 : 4;
  const metrics = <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statColumns}, minmax(0, 1fr))`, gap: s(isTall ? 8 : 10) }}>
    {stats.map((st, i) => {
      const m = mv('pop', statCues[i]);
      const tileStyle: CSSProperties = { ...m.style, minWidth: 0, textAlign: 'center', borderRadius: s(18), padding: `${s(isTall ? 10 : 13)}px ${s(8)}px`, background: 'linear-gradient(150deg,rgba(255,255,255,.15),rgba(255,255,255,.07))', border: `1px solid ${C.line}`, boxShadow: '0 10px 26px rgba(0,25,35,.22), inset 0 1px 0 rgba(255,255,255,.16)' };
      const bigNum = s(isTall ? 32 : 38);
      if (st.nl) return <div key={st.label} className={m.className} role="img" aria-label={`Average NL rating ${st.value}`} title="Average NL rating" style={{ ...tileStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
        <p className="font-serif" style={{ fontSize: bigNum, fontWeight: 700, lineHeight: 1, color: C.ink }}><CountUp value={st.value} play={play} still={still} delay={statCues[i]} /></p>
        <StarIcon size={bigNum * 0.95} />
      </div>;
      return <div key={st.label} className={m.className} style={tileStyle}>
        <p className="font-serif" style={{ fontSize: bigNum, fontWeight: 700, lineHeight: 1, color: C.ink }}><CountUp value={st.value} play={play} still={still} delay={statCues[i]} /></p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: s(5), marginTop: s(6), color: C.mint }}>{st.icon}<span style={{ fontSize: s(9), letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 800, color: C.soft }}>{st.label}</span></div>
      </div>;
    })}
  </div>;

  // A favourite the reader hid (or left empty) is dropped entirely - no label, no dash placeholder.
  const journeyItems: [string, string][] = ([
    ['Favourite book', data.favoriteBook],
    ['Favourite author', data.favoriteAuthor],
    ['Favourite genre', data.favoriteGenre],
  ] as [string, string | null][]).filter((x): x is [string, string] => !!x[1] && x[1].trim() !== '');
  const journey = journeyItems.length === 0 && !data.readingSince ? null : <div style={{ borderRadius: s(22), padding: s(isTall ? 13 : 17), background: 'linear-gradient(150deg,rgba(1,43,54,.62),rgba(1,58,70,.38))', border: `1px solid ${C.line}`, boxShadow: '0 12px 28px rgba(0,25,35,.22)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(10), marginBottom: s(11) }}>
      <p style={{ fontSize: s(13), letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: C.mint }}>Reading journey</p>
      {data.readingSince && <span style={{ fontSize: s(11), fontWeight: 800, borderRadius: 999, padding: `${s(5)}px ${s(11)}px`, background: C.mint, color: C.deep2, whiteSpace: 'nowrap' }}>Since {data.readingSince}</span>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: isTall ? '1fr' : `repeat(${Math.max(1, journeyItems.length)},minmax(0,1fr))`, gap: s(8) }}>
      {journeyItems.map(([label, value], i) => { const m = mv('slide', cue(0.08)); return <div key={label} className={m.className} style={{ ...m.style, minWidth: 0, borderRadius: s(14), padding: s(11), background: C.glass, border: `1px solid ${C.line}` }}>
        <p style={{ fontSize: s(8), letterSpacing: '.10em', textTransform: 'uppercase', fontWeight: 800, color: C.faint }}>{label}</p>
        <p className="font-serif" style={{ fontSize: s(isTall ? 18 : 20), fontWeight: 600, marginTop: s(4), color: C.ink, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{sanitizeUserText(value, 160)}</p>
      </div>; })}
    </div>
  </div>;

  const shelf = reviews.length > 0 ? <div style={{ borderRadius: s(22), padding: s(isTall ? 13 : 17), background: 'linear-gradient(150deg,rgba(255,255,255,.15),rgba(255,255,255,.07))', border: `1px solid ${C.line}`, boxShadow: '0 14px 32px rgba(0,25,35,.24)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(10), marginBottom: s(11) }}>
      <div><p style={{ fontSize: s(11), letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 800, color: C.mint }}>Published shelf</p><p className="font-serif" style={{ fontSize: s(isTall ? 18 : 22), fontWeight: 700, lineHeight: 1.1, color: C.ink, marginTop: s(2) }}>Reviews on Novelty Library</p></div>
      <span className="font-serif" style={{ fontSize: s(17), fontWeight: 700, minWidth: s(36), textAlign: 'center', borderRadius: 999, padding: `${s(3)}px ${s(8)}px`, background: 'rgba(255,255,255,.16)', border: `1px solid ${C.line}`, color: C.ink }}>{data.publishedReviews.length}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: isTall ? '1fr' : reviews.length > 1 ? 'repeat(2,minmax(0,1fr))' : '1fr', gap: s(8) }}>
      {reviews.map((review) => { const nl = review.nlRating ?? review.rating ?? null; const posterSize = s(isTall ? 72 : 90); return <div key={review.id} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: s(10), borderRadius: s(14), padding: s(8), background: 'rgba(1,43,54,.40)', border: `1px solid ${C.line}` }}>
        <Cover urls={[review.posterUrl, review.coverUrl]} w={posterSize} h={posterSize} radius={s(9)} iconSize={s(22)} />
        <div style={{ minWidth: 0, flex: 1 }}><p className="font-serif" style={{ fontSize: s(15), fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeUserText(review.title, 160)}</p><p style={{ fontSize: s(10), color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeUserText(review.author, 120)}{review.reviewNo ? ` · #${sanitizeUserText(review.reviewNo, 30)}` : ''}</p>{nl != null && nl > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: s(4), marginTop: s(3), fontSize: s(12), fontWeight: 800, color: C.ink }}><StarIcon size={s(14)} />{Number(nl).toFixed(1)}</span>}</div>
      </div>; })}
    </div>
    {moreReviews > 0 && <span style={{ display: 'inline-flex', marginTop: s(9), borderRadius: 999, padding: `${s(4)}px ${s(9)}px`, background: 'rgba(92,225,230,.10)', border: `1px solid rgba(92,225,230,.26)`, color: C.mint, fontSize: s(9), fontWeight: 800 }}>+{moreReviews} more reviews</span>}
  </div> : null;

  const banner = mv('fade', tBanner);
  const avatarMv = mv('pop', tAvatar);
  const heroMv = mv('rise', tHero);
  const metaMv = mv('fade', tMeta);
  const ig = cleanInstagram(data.instagram);
  const otherSocials = data.socialLinks.filter((link) => !(ig && link.platform === 'instagram')).slice(0, 2);
  const tBrand = cue(0.15);
  const footerMv = mv('rise', tBrand);

  const topTag = (label: string, tone: 'neutral' | 'language' | 'genre' = 'neutral') => <span style={{ borderRadius: 999, padding: `${s(5)}px ${s(9)}px`, background: tone === 'language' ? 'rgba(92,225,230,.15)' : tone === 'genre' ? 'rgba(0,151,178,.27)' : C.glass, border: `1px solid ${tone === 'language' ? 'rgba(92,225,230,.40)' : tone === 'genre' ? 'rgba(159,243,245,.22)' : C.line}`, color: tone === 'language' ? C.mint : C.soft, fontSize: s(9), fontWeight: 800, maxWidth: '100%', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{sanitizeUserText(label, 140)}</span>;
  // Languages and genres each collapse into ONE comma-separated tag (like city, state, country).
  const fixedTagList: { label: string; tone: 'neutral' | 'language' | 'genre' }[] = [
    { label: country || '', tone: 'neutral' },
    { label: location && location !== country ? location : '', tone: 'neutral' },
    { label: typeof gender === 'string' ? gender : '', tone: 'neutral' },
    { label: occupation, tone: 'neutral' },
    { label: age, tone: 'neutral' },
    { label: languages.join(', '), tone: 'language' },
    { label: genres.join(', '), tone: 'genre' },
  ].filter(t => !!t.label);
  const fixedTags = fixedTagList;
  const details = (fixedTags.length > 0 || bio || tagQuestions.length || answerQuestions.length) ? <div className={metaMv.className} style={{ ...metaMv.style, minWidth: 0, display: 'flex', flexDirection: 'column', gap: s(8) }}>
    {fixedTags.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: s(6) }}>{fixedTags.map((tag, i) => <Fragment key={i}>{topTag(tag.label, tag.tone)}</Fragment>)}</div>}
    {bio && <div style={{ borderRadius: s(10), padding: `${s(6)}px ${s(9)}px`, background: 'rgba(255,255,255,.055)', border: `1px solid rgba(255,255,255,.12)`, color: C.soft, fontSize: s(8), lineHeight: 1.3 }}><b style={{ color: C.mint }}>Bio:</b> {sanitizeUserText(String(bio), 180)}</div>}
    {!isFourFive && tagQuestions.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: s(6) }}>{tagQuestions.map(q => { if (q.type === 'image_upload') return null; const values = sortValues(q, data.answers[q.key]); return values.map((v,i) => <span key={`${q.id}-${i}`} style={{ maxWidth: '100%', borderRadius: 999, padding: `${s(5)}px ${s(9)}px`, background: 'rgba(255,255,255,.10)', border: `1px solid rgba(255,255,255,.18)`, color: C.soft, fontSize: s(8), lineHeight: 1.2 }}>{q.profile_card_mode !== 'tag_no_question' && <b style={{ color: C.mint }}>{sanitizeUserText(q.question, 54)}: </b>}{sanitizeUserText(v, 120)}</span>); })}</div>}
  </div> : null;

  // On 4:5, question-tags are deliberately collected after the published shelf
  // rather than following their original section order. Answers then use a
  // three-column grid so the card reads like an editorial profile, not a list.
  const questionTags = tagQuestions.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: s(6), width: '100%' }}>
    {tagQuestions.flatMap((q) => {
      if (q.type === 'image_upload') return [];
      return sortValues(q, data.answers[q.key]).map((v, i) => <span key={`${q.id}-${i}`} style={{ maxWidth: '100%', borderRadius: 999, padding: `${s(5)}px ${s(9)}px`, background: 'rgba(255,255,255,.10)', border: `1px solid rgba(255,255,255,.18)`, color: C.soft, fontSize: s(8), lineHeight: 1.2, textAlign: 'center' }}>{q.profile_card_mode !== 'tag_no_question' && q.profile_card_mode !== 'answer_no_question' && <b style={{ color: C.mint }}>{sanitizeUserText(q.question, 54)}: </b>}{sanitizeUserText(v, 120)}</span>);
    })}
  </div> : null;

  const extra = answerQuestions.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: isFourFive ? 'repeat(3,minmax(0,1fr))' : isWide ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: s(isFourFive ? 7 : 7), width: '100%' }}>
    {answerQuestions.map((q) => {
      if (q.type === 'image_upload') return null;
      const values = sortValues(q, data.answers[q.key]);
      if (!values.length) return null;
      return <div key={q.id} style={{ minWidth: 0, borderRadius: s(10), padding: `${s(isFourFive ? 7 : 6)}px ${s(isFourFive ? 8 : 9)}px`, background: 'rgba(255,255,255,.055)', border: `1px solid rgba(255,255,255,.12)`, color: C.soft, fontSize: s(isFourFive ? 7.5 : 8), lineHeight: 1.3, overflow: 'hidden' }}>{q.profile_card_mode !== 'answer_no_question' && <b style={{ color: C.mint }}>{sanitizeUserText(q.question, isFourFive ? 48 : 70)}: </b>}{sanitizeUserText(values.join(', '), isFourFive ? 120 : 180)}</div>;
    })}
  </div> : null;

  const fourFiveQuestions = isFourFive ? <div style={{ display: 'flex', flexDirection: 'column', gap: s(8), width: '100%', borderRadius: s(16), padding: s(9), background: 'rgba(1,43,54,.22)', border: `1px solid rgba(255,255,255,.12)` }}>
    {questionTags}
    {extra}
  </div> : null;

  // ---- SuperBlitz: banner fills the card; profile lives inside the notched panel. ----
  if (superBlitz) {
    const sbAvatar = 136;
    const bannerUrl = safeExternalUrl(data.superBlitzBannerUrl || '');
    const sbStats = <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: s(8) }}>
      {stats.map((st, i) => { const m = mv('pop', statCues[i]); const sbTile: CSSProperties = { ...m.style, minWidth: 0, textAlign: 'center', borderRadius: s(14), padding: `${s(9)}px ${s(4)}px`, background: 'rgba(1,43,54,.30)', border: `1px solid ${C.line}` };
        if (st.nl) return <div key={st.label} className={m.className} role="img" aria-label={`Average NL rating ${st.value}`} title="Average NL rating" style={{ ...sbTile, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: s(4) }}>
          <p className="font-serif" style={{ fontSize: s(30), fontWeight: 700, lineHeight: 1, color: C.ink }}><CountUp value={st.value} play={play} still={still} delay={statCues[i]} /></p>
          <StarIcon size={s(28)} />
        </div>;
        return <div key={st.label} className={m.className} style={sbTile}>
        <p className="font-serif" style={{ fontSize: s(30), fontWeight: 700, lineHeight: 1, color: C.ink }}><CountUp value={st.value} play={play} still={still} delay={statCues[i]} /></p>
        <p style={{ marginTop: s(5), fontSize: s(8), letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800, color: C.soft, lineHeight: 1.2 }}>{st.label}</p>
      </div>; })}
    </div>;
    const panelBg = `linear-gradient(160deg,${C.deep2} 0%,#00687f 45%,${C.teal} 100%)`;
    return <div ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: 'top left', background: '#fff', color: C.ink }}>
      {/* Banner = the "white space" around the panel. */}
      {bannerUrl && <img className={still ? '' : 'nl-pc-a nl-pc-zoom'} src={bannerUrl} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: w, height: h, objectFit: 'cover', display: 'block' }} />}
      {!still && onSuperBlitzBannerUpload && <button type="button" onClick={(e) => { e.stopPropagation(); onSuperBlitzBannerUpload(); }} title={`Change banner (${SB_BANNER_SIZE.width} × ${SB_BANNER_SIZE.height} px)`} aria-label={`Change banner image, ${SB_BANNER_SIZE.width} by ${SB_BANNER_SIZE.height} pixels`} className="nl-pc-edit-chip" style={{ top: ui(28), right: ui(26), height: ui(28), padding: `0 ${ui(5)}px 0 ${ui(11)}px`, gap: ui(7), fontSize: ui(11) }}>{SB_BANNER_SIZE.width} × {SB_BANNER_SIZE.height} px<span className="nl-pc-edit-dot" style={{ width: ui(20), height: ui(20) }}><ImagePlus width={ui(12)} height={ui(12)} /></span></button>}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, display: 'block' }} aria-hidden="true"><defs><linearGradient id="sbp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C.deep2} /><stop offset=".45" stopColor="#00687f" /><stop offset="1" stopColor={C.teal} /></linearGradient></defs><path d={sbPanelPath()} fill="url(#sbp)" /></svg>
      {/* Animated glow traces the inner card edge only; the outer banner is untouched. Static in exports. */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={still ? '' : 'nl-sb-glow'} style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
        <path d={sbPanelPath()} className="nl-sb-glow-edge" fill="none" stroke="rgba(159,243,245,.85)" strokeWidth="2.5" strokeLinejoin="round" />
        {!still && <path d={sbPanelPath()} pathLength={100} className="nl-sb-glow-run" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>

      {/* Avatar sits in the panel's top-left lobe. */}
      <div className={avatarMv.className} style={{ ...avatarMv.style, position: 'absolute', left: 40, top: 30, width: sbAvatar, height: sbAvatar }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: 5, background: '#fff', boxShadow: '0 10px 26px rgba(0,25,35,.35)' }}><div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: C.deep2, display: 'grid', placeItems: 'center', color: C.mint, fontWeight: 800, fontSize: 52 }}>{data.avatarUrl ? <img src={safeExternalUrl(data.avatarUrl) || undefined} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : sanitizeUserText((data.name || data.username || 'N').trim().charAt(0).toUpperCase(), 2)}</div></div>
        {!still && onAvatarUpload && <button type="button" onClick={(e) => { e.stopPropagation(); onAvatarUpload(); }} title="Change profile picture" aria-label="Change profile picture" className="nl-pc-cam" style={{ width: ui(26), height: ui(26), left: sbAvatar * .80 - ui(13), top: sbAvatar * .80 - ui(13) }}><Camera width={ui(13)} height={ui(13)} /></button>}
      </div>

      <div className={heroMv.className} style={{ ...heroMv.style, position: 'absolute', left: 45, width: 579, top: 178, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <h2 className="font-serif" style={{ fontSize: 40 * nameScale(data.name || 'Novelty Reader'), fontWeight: 700, lineHeight: 1.05, color: C.ink, overflow: 'hidden', overflowWrap: 'anywhere', maxHeight: 84, minWidth: 0, flexShrink: 1 }}>{sanitizeUserText(data.name || 'Novelty Reader', 120)}</h2>
        <p style={{ flexShrink: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: C.glassStrong, border: `1px solid ${C.line}`, color: C.mint }}>@{sanitizeUserText(data.username || 'reader', 80)}</p>
        <FollowerPill count={data.followerCount} fontSize={13} padX={10} padY={3} onClick={still ? undefined : onFollowersClick} />
      </div>

      <div data-fit style={{ position: 'absolute', left: 45, width: 579, top: 240, height: 530, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: s(11) }}>
        {details}
        {sbStats}
        {journey}
        {shelf}
        {extra}
      </div>

      {/* Branding (same treatment as the other cards), tucked into the panel's lower lobes. */}
      <div className={footerMv.className} style={{ ...footerMv.style, position: 'absolute', left: 205, width: 419, top: 792, height: 80, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        {ig && <a href={safeExternalUrl(`https://instagram.com/${ig}`) || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', borderRadius: 999, padding: '5px 10px', background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 28%,#d62976 58%,#962fbf 82%,#4f5bd5 100%)', color: '#fff', fontWeight: 800, fontSize: 12, textDecoration: 'none' }}><Instagram width={13} height={13} />@{sanitizeUserText(ig, 40)}</a>}
        {otherSocials.map((link) => <a key={link.platform} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 700, background: C.glassStrong, color: '#fff', border: `1px solid ${C.line}`, textDecoration: 'none' }}>{platformIcon(link.platform, 12)}{sanitizeUserText(platformLabel(link.platform), 40)}</a>)}
      </div>
      <div className={footerMv.className} style={{ ...footerMv.style, position: 'absolute', left: 418, width: 212, top: 894, height: 94, display: 'flex', alignItems: 'center', gap: 9, borderRadius: 16, padding: '8px 10px', background: 'linear-gradient(135deg,rgba(255,255,255,.92),rgba(206,255,255,.78))', border: '1px solid rgba(159,243,245,.72)', boxShadow: '0 10px 24px rgba(0,25,35,.25),inset 0 1px 0 rgba(255,255,255,.85)' }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 58, height: 58, borderRadius: 14, flexShrink: 0, background: '#fff', boxShadow: '0 6px 14px rgba(0,65,80,.28)' }}><img src={LOGO} alt="Novelty Library" style={{ width: 54, height: 54, objectFit: 'contain', display: 'block' }} /></div>
        <div style={{ minWidth: 0 }}><p className="font-serif" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: C.deep2 }}>Novelty Library</p><p style={{ fontSize: 6.5, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 4, color: C.teal, fontWeight: 900, lineHeight: 1.3 }}>Readers&apos; personal archive · branding tool</p></div>
      </div>
    </div>;
  }

  return <div ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: 'top left', background: `linear-gradient(150deg,${C.deep} 0%,${C.deep2} 26%,#00687f 52%,${C.teal} 76%,#3fd3d9 100%)`, color: C.ink }}>
    <div className={still ? '' : 'nl-pc-loop nl-pc-drift'} style={{ position: 'absolute', right: -w * 0.25, top: -h * 0.12, width: w * 0.9, height: w * 0.9, borderRadius: '50%', background: 'radial-gradient(circle, rgba(92,225,230,.42) 0%, rgba(92,225,230,0) 62%)' }} />
    <div style={{ position: 'absolute', right: -w * 0.22, bottom: -w * 0.3, width: w * 0.8, height: w * 0.8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.9) 0%, rgba(255,255,255,.4) 24%, rgba(255,255,255,0) 58%)' }} />
    <div style={{ position: 'absolute', left: -w * 0.2, bottom: h * 0.18, width: w * 0.7, height: w * 0.7, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,151,178,.35) 0%, rgba(0,151,178,0) 65%)' }} />

    <div className={banner.className} style={{ ...banner.style, position: 'absolute', top: 0, left: 0, right: 0, height: bannerH, overflow: 'hidden', background: `linear-gradient(135deg,${C.deep} 0%,#02586b 55%,#16b5c4 100%)` }}>
      {data.headerImageUrl ? <img className={still ? '' : 'nl-pc-a nl-pc-zoom'} src={safeExternalUrl(data.headerImageUrl) || undefined} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <><svg width="100%" height="100%" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} aria-hidden="true">{[120,190,260,330,400].map((r) => <circle key={r} cx="880" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />)}{[[120,70],[260,190],[420,90],[610,210],[730,70]].map(([x,y],i) => <circle key={i} className={still ? '' : 'nl-pc-loop nl-pc-twinkle'} style={{ animationDelay: `${i * .6}s`, transformOrigin: `${x}px ${y}px` }} cx={x} cy={y} r="3" fill="#fff" />)}</svg><NlLogo className={still ? '' : 'nl-pc-loop nl-pc-float'} style={{ position: 'absolute', right: pad, top: '50%', marginTop: -bannerH * .36, height: bannerH * .72, width: bannerH * .72, color: '#fff', opacity: .16 }} /></>}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(1,43,54,.05) 30%,rgba(1,43,54,.55) 100%)' }} />
      {!still && onHeaderUpload && <button type="button" onClick={(e) => { e.stopPropagation(); onHeaderUpload(); }} title="Change banner (1500 × 500 px)" aria-label="Change banner image, 1500 by 500 pixels" className="nl-pc-edit-chip" style={{ top: ui(10), right: ui(10), height: ui(28), padding: `0 ${ui(5)}px 0 ${ui(11)}px`, gap: ui(7), fontSize: ui(11) }}>1500 × 500 px<span className="nl-pc-edit-dot" style={{ width: ui(20), height: ui(20) }}><ImagePlus width={ui(12)} height={ui(12)} /></span></button>}
    </div>

    <div style={{ position: 'absolute', left: pad, right: pad, top: Math.max(bannerH - avatar * .45, s(26)), bottom: pad * .7, display: 'flex', flexDirection: 'column', gap: s(isTall ? 11 : 15) }}>
      {/* Hero identity: same semantic order everywhere, composition changes with ratio. */}
      {(() => { const hero = <div className={heroMv.className} style={{ ...heroMv.style, display: isTall ? 'block' : 'grid', gridTemplateColumns: isWide ? '1fr' : 'minmax(0,1fr) minmax(0,.82fr)', gap: s(18), alignItems: isWide ? 'start' : 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(18), minWidth: 0 }}>
          <div className={avatarMv.className} style={{ ...avatarMv.style, position: 'relative', width: avatar, height: avatar, flexShrink: 0 }}>
            {!still && <div className="nl-pc-a nl-pc-ring" style={{ ['--d' as string]: `${(tAvatar + .5).toFixed(2)}s`, position: 'absolute', inset: 0, borderRadius: '50%' } as CSSProperties} />}
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: s(6), background: `conic-gradient(from 210deg,${C.cyan},#fff,${C.teal},${C.mint},${C.cyan})`, boxShadow: '0 14px 34px rgba(0,25,35,.45)' }}><div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: s(4), background: C.deep2 }}>{data.avatarUrl ? <img src={safeExternalUrl(data.avatarUrl) || undefined} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} /> : <div className="font-serif" style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: avatar * .42, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg,${C.teal},${C.cyan})` }}>{sanitizeUserText(data.name || data.username || 'R',120).slice(0,1).toUpperCase()}</div>}</div></div>
            {!still && onAvatarUpload && <button type="button" onClick={(e) => { e.stopPropagation(); onAvatarUpload(); }} title="Change profile picture" aria-label="Change profile picture" className="nl-pc-cam" style={{ width: ui(26), height: ui(26), left: avatar * .80 - ui(13), top: avatar * .80 - ui(13) }}><Camera width={ui(13)} height={ui(13)} /></button>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: s(10), letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: C.mint, marginBottom: s(5) }}>Novelty Library · Reader</p>
            <h2 className="font-serif" style={{ fontSize: s((isWide ? 54 : 48) * nameScale(data.name || 'Novelty Reader')), fontWeight: 700, lineHeight: 1.04, color: C.ink, textShadow: '0 4px 22px rgba(0,25,35,.5)', overflow: 'hidden', overflowWrap: 'anywhere' }}>{sanitizeUserText(data.name || 'Novelty Reader',120)}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: s(6), marginTop: s(6) }}><p style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: s(17), fontWeight: 700, padding: `${s(4)}px ${s(11)}px`, borderRadius: 999, background: C.glassStrong, border: `1px solid ${C.line}`, color: C.mint }}>@{sanitizeUserText(data.username || 'reader',80)}</p><FollowerPill count={data.followerCount} fontSize={s(14)} padX={s(10)} padY={s(4)} onClick={still ? undefined : onFollowersClick} /></div>
            {bio && isTall && <p style={{ marginTop: s(7), color: C.soft, fontSize: s(11), lineHeight: 1.3 }}>{sanitizeUserText(String(bio), 180)}</p>}
          </div>
        </div>
        {details}
      </div>;

      const body = <div data-fit style={{ position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: s(isTall ? 10 : 13), flex: 1 }}>
        {metrics}
        {journey}
        {shelf}
        {isFourFive ? fourFiveQuestions : <>{extra}</>}
      </div>;

      // 16:9 only: split into two side-by-side sections instead of one
      // stacked column — left holds the top identity content, right holds
      // everything that normally follows underneath it. Every other format
      // keeps the original single-column flow.
      return isWide
        ? <div style={{ display: 'flex', flexDirection: 'row', gap: s(22), flex: 1, minHeight: 0 }}>
            <div style={{ flex: '1 1 46%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{hero}</div>
            <div style={{ flex: '1 1 54%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{body}</div>
          </div>
        : <>{hero}{body}</>;
      })()}

      <div className={footerMv.className} style={{ ...footerMv.style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(12), flexShrink: 0, minHeight: s(isTall ? 52 : 66) }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: s(6), minWidth: 0 }}>
          {ig && <a href={safeExternalUrl(`https://instagram.com/${ig}`) || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: s(7), maxWidth: '100%', borderRadius: 999, padding: `${s(6)}px ${s(10)}px`, background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 28%,#d62976 58%,#962fbf 82%,#4f5bd5 100%)', color: '#fff', fontWeight: 800, fontSize: s(11), boxShadow: '0 8px 20px rgba(0,25,35,.3)', textDecoration: 'none' }}><span style={{ display: 'grid', placeItems: 'center', width: s(23), height: s(23), borderRadius: '50%', background: 'rgba(255,255,255,.24)', flexShrink: 0 }}><Instagram width={s(13)} height={s(13)} /></span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{ig}</span></a>}
          {otherSocials.map((link) => <a key={link.platform} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: s(5), borderRadius: 999, padding: `${s(6)}px ${s(9)}px`, fontSize: s(10), fontWeight: 700, background: C.glassStrong, color: '#fff', border: `1px solid ${C.line}`, textDecoration: 'none' }}>{platformIcon(link.platform,s(12))}{sanitizeUserText(platformLabel(link.platform),40)}</a>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(10), flexShrink: 0, minWidth: isWide ? '42%' : '48%', borderRadius: s(16), padding: `${s(8)}px ${s(11)}px`, background: 'linear-gradient(135deg,rgba(255,255,255,.92),rgba(206,255,255,.78))', border: `1px solid rgba(159,243,245,.72)`, boxShadow: '0 12px 28px rgba(0,25,35,.25),inset 0 1px 0 rgba(255,255,255,.85)' }}>
          <div style={{ display: 'grid', placeItems: 'center', width: s(58), height: s(58), borderRadius: s(14), flexShrink: 0, background: '#ffffff', boxShadow: '0 6px 14px rgba(0,65,80,.28)' }}><img src={LOGO} alt="Novelty Library" style={{ width: s(54), height: s(54), objectFit: 'contain', display: 'block' }} /></div>
          <div style={{ minWidth: 0 }}><p className="font-serif" style={{ fontSize: s(17), fontWeight: 800, lineHeight: 1, color: C.deep2 }}>Novelty Library</p><p style={{ fontSize: s(7), letterSpacing: '.12em', textTransform: 'uppercase', marginTop: s(4), color: C.teal, fontWeight: 900 }}>Readers&apos; personal archive · branding tool</p></div>
        </div>
      </div>
    </div>
  </div>;
}
