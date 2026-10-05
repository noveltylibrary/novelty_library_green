import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Download, Instagram, Linkedin, Link2, BookOpen, RotateCcw, ChevronDown, Camera, ImagePlus, ExternalLink } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { ProfileQuestion } from '@/lib/profileQuestions';
import { NlLogo } from '@/components/NlLogo';
import { rwRatingToStars } from '@/components/RwStarRating';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';
import { answerImageUrls, answerText, decodeOtherAnswer } from '@/components/ProfileQuestionAnswer';

export type ProfileCardData = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  headerImageUrl: string | null;
  socialLinks: { platform: string; url: string }[];
  /** Instagram handle (with or without @ / URL). Shown at the bottom of the card. */
  instagram?: string | null;
  booksThisMonth: number | null;
  totalBooksRead: number | null;
  publishedBooks: number;
  avgRating: number | null;
  readingSince: number | null;
  favoriteBook: string | null;
  favoriteAuthor: string | null;
  favoriteGenre: string | null;
  publishedReviews: { id: string; reviewNo: string | null; title: string; author: string; coverUrl: string | null; rating?: number | null }[];
  answers: Record<string, unknown>;
  questions: ProfileQuestion[];
};

const LOGO = '/novelty-library-logo.png';
const FORMATS = [
  { key: '9:16', width: 1080, height: 1920 },
  { key: '16:9', width: 1600, height: 900 },
  { key: '3:4', width: 1200, height: 1600 },
  { key: '4:5', width: 1080, height: 1350 },
  { key: '1:1', width: 1080, height: 1080 },
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

export function ProfileCard({ data, download = false, onAvatarUpload, onHeaderUpload, onViewPublicProfile, layout = 'inline', initialFormat, publicFormat, onPublicFormatChange }: { data: ProfileCardData; download?: boolean; onAvatarUpload?: () => void; onHeaderUpload?: () => void; onViewPublicProfile?: () => void; layout?: 'inline' | 'rows'; initialFormat?: FormatKey; publicFormat?: FormatKey; onPublicFormatChange?: (f: FormatKey) => void | Promise<void> }) {
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
        pixelRatio: 1,
        width: exportSelected.width,
        height: exportSelected.height,
        backgroundColor: C.deep2,
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
    {layout === 'rows' && (download || onViewPublicProfile) && <div className="nl-pc-rows" style={{ maxWidth: selected.width > selected.height ? 560 : 380 }}>
      {onViewPublicProfile && <button type="button" onClick={onViewPublicProfile} className="nl-pc-row"><span className="nl-pc-row-main"><ExternalLink className="w-4 h-4" /> View public profile</span></button>}
      {download && <label className="nl-pc-row nl-pc-row-select"><span className="nl-pc-row-main">View card</span><span className="nl-pc-select"><select value={format} onChange={(e) => setFormat(e.target.value as FormatKey)} aria-label="Card format to preview">{FORMATS.map((f) => <option key={f.key} value={f.key}>{f.key} · {f.width}×{f.height}</option>)}</select><ChevronDown className="w-4 h-4" aria-hidden="true" /></span></label>}
      {onPublicFormatChange && <label className="nl-pc-row nl-pc-row-select"><span className="nl-pc-row-main">Set public view{publicSaved && <em className="nl-pc-saved">✓ Saved</em>}</span><span className="nl-pc-select"><select value={publicFormat || PREVIEW_FORMAT} onChange={async (e) => { await onPublicFormatChange(e.target.value as FormatKey); setPublicSaved(true); window.setTimeout(() => setPublicSaved(false), 2200); }} aria-label="Card format other readers see on your public profile">{FORMATS.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}</select><ChevronDown className="w-4 h-4" aria-hidden="true" /></span></label>}
      {download && <button type="button" onClick={() => setReplay((n) => n + 1)} className="nl-pc-row" aria-label="Replay animation"><span className="nl-pc-row-main"><RotateCcw className="w-4 h-4" /> Replay animation</span></button>}
      {download && <div className="relative">
        <button type="button" onClick={() => setDownloadMenuOpen(v => !v)} disabled={downloading} className="nl-pc-row nl-pc-row-primary disabled:opacity-50"><span className="nl-pc-row-main"><Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download Profile Card'}</span><ChevronDown className="w-4 h-4" /></button>
        {downloadMenuOpen && <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl p-1.5 shadow-2xl" style={{background:'var(--color-surface)',border:'1px solid var(--color-border)'}}>
          {FORMATS.map((f) => <button key={f.key} type="button" onClick={() => { setFormat(f.key); setDownloadMenuOpen(false); window.setTimeout(() => void downloadCard(f.key), 0); }} className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{f.key} <span className="opacity-60">· {f.width}×{f.height}</span>{format===f.key && <span className="float-right font-bold">✓</span>}</button>)}
        </div>}
      </div>}
    </div>}

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
      <CardCanvas key={`${format}-${replay}`} canvasRef={canvasRef} data={data} width={selected.width} height={selected.height} scale={scale} play={inView} still={downloading} onAvatarUpload={onAvatarUpload} onHeaderUpload={onHeaderUpload} />
    </div>
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

function Cover({ url, w, h, radius, iconSize }: { url: string | null; w: number; h: number; radius: number; iconSize: number }) {
  const [failed, setFailed] = useState(false);
  return <div style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.06))', border: `1px solid ${C.line}`, boxShadow: '0 8px 18px rgba(0,30,40,.35)', display: 'grid', placeItems: 'center' }}>
    <BookOpen width={iconSize} height={iconSize} style={{ color: C.mint, gridArea: '1 / 1' }} />
    {url && !failed && <img src={safeExternalUrl(url) || undefined} alt="" crossOrigin="anonymous" onError={() => setFailed(true)} style={{ gridArea: '1 / 1', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
  </div>;
}

function CardCanvas({ canvasRef, data, width: w, height: h, scale, play, still, onAvatarUpload, onHeaderUpload }: { canvasRef: RefObject<HTMLDivElement>; data: ProfileCardData; width: number; height: number; scale: number; play: boolean; still: boolean; onAvatarUpload?: () => void; onHeaderUpload?: () => void }) {
  const cols = w / h >= 0.95 ? 2 : 1;
  const compactSquare = w / h <= 1.05;
  const signature = `${w}x${h}|${data.publishedReviews.length}|${data.questions.length}|${JSON.stringify(data.answers).length}|${data.name}|${data.favoriteBook}|${data.favoriteAuthor}|${data.favoriteGenre}|${data.socialLinks.length}`;
  const [step, setStep] = useState(0);
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) { setLastSignature(signature); setStep(0); }
  const fit = FIT_STEPS[Math.min(step, FIT_STEPS.length - 1)];

  // After every render, check whether any column spills out of its box and, if so, take the next (smaller) step.
  useLayoutEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    if (columnOverflows(root) && step < FIT_STEPS.length - 1) setStep(step + 1);
  }, [step, signature, canvasRef]);

  // Late-loading images/fonts can change heights; re-check once they settle.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = canvasRef.current;
      if (!root) return;
      if (columnOverflows(root)) setStep((s) => Math.min(s + 1, FIT_STEPS.length - 1));
    }, 700);
    return () => window.clearTimeout(t);
  }, [signature, step, canvasRef]);

  // Entrance choreography. Every animated piece takes the next slot on one timeline.
  // (Only downward-settling motion is used so it never changes the measured layout.)
  let clock = 0.2;
  const cue = (gap = 0.1) => { clock += gap; return clock; };
  const mv = (kind: 'drop' | 'slide' | 'pop' | 'fade' | 'rise', delay: number): { className: string; style: CSSProperties } => still
    ? { className: '', style: {} }
    : { className: `nl-pc-a nl-pc-${kind}`, style: { ['--d' as string]: `${delay.toFixed(2)}s` } as CSSProperties };

  // On-screen edit controls keep a constant ~28px size whatever the preview scale; they never render into the export.
  const ui = (px: number) => px / Math.max(scale, 0.2);
  const u = Math.min(w / 1080, h / 1000) * fit.m;
  const s = (n: number) => n * u;
  const pad = w * 0.055;
  const bannerH = Math.round(cols === 2 ? h * 0.25 : Math.min(h * 0.17, w * 0.34));
  const avatar = Math.round(cols === 2 ? h * 0.2 : w * 0.17);

  // Every answered question is shown (the reader's own eye/privacy choices are already applied to data.answers).
  const questions = data.questions.filter((q) => {
    const value = data.answers[q.key];
    return value !== undefined && value !== null && (q.type === 'image_upload' ? answerImageUrls(value).length > 0 : answerText(value).trim() !== '');
  });
  const reviews = data.publishedReviews.slice(0, fit.reviews);
  const hasJourney = !!(data.favoriteBook || data.favoriteAuthor || data.favoriteGenre || data.readingSince);

  // ---- timeline slots (in reading order) ----
  const tBanner = 0;
  const tAvatar = cue(0.1);
  const tEyebrow = cue(0.25);
  const tName = cue(0.12);
  const tHandle = cue(0.12);
  const stats: { value: string; label: string; icon: ReactNode }[] = [];
  if (data.booksThisMonth != null) stats.push({ value: String(data.booksThisMonth), label: 'read this month', icon: <BookOpen width={s(18)} height={s(18)} /> });
  if (data.totalBooksRead != null) stats.push({ value: String(data.totalBooksRead), label: 'books read', icon: <BookOpen width={s(18)} height={s(18)} /> });
  stats.push({ value: String(data.publishedBooks), label: 'published', icon: <BookOpen width={s(18)} height={s(18)} /> });
  if (data.avgRating != null) stats.push({ value: data.avgRating.toFixed(1), label: 'avg rating given', icon: <span style={{ fontSize: s(18), lineHeight: 1 }}>★</span> });
  const statCues = stats.map(() => cue(0.12));

  const metrics = <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: s(10) }}>
    {stats.map((st, i) => {
      const m = mv('pop', statCues[i]);
      return <div key={st.label} className={m.className} style={{ ...m.style, position: 'relative', overflow: 'hidden', borderRadius: s(20), padding: `${s(12)}px ${s(16)}px`, background: `linear-gradient(150deg,${C.glassStrong},${C.glass})`, border: `1px solid ${C.line}`, boxShadow: '0 10px 26px rgba(0,25,35,.25), inset 0 1px 0 rgba(255,255,255,.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(10), color: C.mint }}>
          {st.icon}
          <span style={{ fontSize: s(13), letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: C.soft }}>{st.label}</span>
        </div>
        <p className="font-serif" style={{ fontSize: s(46), fontWeight: 700, lineHeight: 1.05, marginTop: s(2), color: C.ink, textShadow: '0 3px 14px rgba(0,25,35,.35)' }}><CountUp value={st.value} play={play} still={still} delay={statCues[i]} /></p>
      </div>;
    })}
  </div>;

  const tJourney = cue(0.15);
  const journeyItems: [string, string][] = [];
  if (data.favoriteBook) journeyItems.push(['Favourite book', sanitizeUserText(data.favoriteBook, 200)]);
  if (data.favoriteAuthor) journeyItems.push(['Favourite author', sanitizeUserText(data.favoriteAuthor, 160)]);
  if (data.favoriteGenre) journeyItems.push(['Favourite genre', sanitizeUserText(data.favoriteGenre, 120)]);
  const journeyCues = journeyItems.map(() => cue(0.1));
  const journey = hasJourney ? (() => { const m = mv('drop', tJourney); return <div className={m.className} style={{ ...m.style, borderRadius: s(26), padding: s(20), background: 'linear-gradient(150deg,rgba(1,43,54,.62),rgba(1,58,70,.4))', border: `1px solid ${C.line}`, boxShadow: '0 12px 28px rgba(0,25,35,.28)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(12), marginBottom: s(compactSquare ? 8 : 14) }}>
      <p style={{ fontSize: s(16), letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 800, color: C.mint }}>Reading journey</p>
      {data.readingSince && <span style={{ fontSize: s(17), fontWeight: 700, borderRadius: 999, padding: `${s(5)}px ${s(16)}px`, background: C.mint, color: C.deep2, whiteSpace: 'nowrap' }}>Since {data.readingSince}</span>}
    </div>
    <div style={{ display: 'grid', gap: s(10) }}>
      {journeyItems.map(([label, value], i) => { const mi = mv('slide', journeyCues[i]); return <div key={label} className={mi.className} style={{ ...mi.style, borderRadius: s(16), padding: `${s(12)}px ${s(16)}px`, background: C.glass, border: `1px solid ${C.line}`, borderLeft: `${s(5)}px solid ${C.cyan}` }}>
        <p style={{ fontSize: s(14), letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 800, color: C.faint }}>{label}</p>
        <p className="font-serif" style={{ fontSize: s(24), fontWeight: 600, marginTop: s(2), color: C.ink, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{value}</p>
      </div>; })}
    </div>
  </div>; })() : null;

  const tShelf = cue(0.15);
  const reviewCues = reviews.map(() => cue(0.12));
  const shelf = reviews.length > 0 ? (() => { const m = mv('drop', tShelf); return <div className={m.className} style={{ ...m.style, borderRadius: s(26), padding: s(compactSquare ? 13 : 20), background: 'linear-gradient(150deg,rgba(255,255,255,.17),rgba(255,255,255,.07))', border: `1px solid ${C.line}`, boxShadow: '0 14px 32px rgba(0,25,35,.28), inset 0 1px 0 rgba(255,255,255,.2)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(12), marginBottom: s(14) }}>
      <div><p style={{ fontSize: s(compactSquare ? 11 : 15), letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: C.mint }}>Published shelf</p><p className="font-serif" style={{ fontSize: s(compactSquare ? 19 : 28), fontWeight: 700, lineHeight: 1.1, color: C.ink, marginTop: s(2) }}>Reviews on Novelty Library</p></div>
      <span className="font-serif" style={{ fontSize: s(compactSquare ? 20 : 30), fontWeight: 700, minWidth: s(compactSquare ? 40 : 56), textAlign: 'center', borderRadius: 999, padding: `${s(compactSquare ? 2 : 4)}px ${s(compactSquare ? 9 : 16)}px`, background: C.ink, color: C.deep2 }}>{data.publishedReviews.length}</span>
    </div>
    <div style={{ display: 'grid', gap: s(10) }}>{reviews.map((review, i) => { const mr = mv('slide', reviewCues[i]); const stars = review.rating && review.rating > 0 ? rwRatingToStars(review.rating) : null; return <div key={review.id} className={mr.className} style={{ ...mr.style, display: 'flex', alignItems: 'center', gap: s(compactSquare ? 9 : 16), borderRadius: s(compactSquare ? 13 : 18), padding: s(compactSquare ? 7 : 10), background: 'rgba(1,43,54,.38)', border: `1px solid ${C.line}` }}>
      <Cover url={review.coverUrl} w={s(compactSquare ? 50 : 62)} h={s(compactSquare ? 70 : 86)} radius={s(10)} iconSize={s(compactSquare ? 21 : 26)} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="font-serif" style={{ fontSize: s(compactSquare ? 17 : 24), fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeUserText(review.title, 200)}</p>
        <p style={{ fontSize: s(compactSquare ? 12 : 18), color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeUserText(review.author, 160)}{review.reviewNo ? ` · #${sanitizeUserText(review.reviewNo, 40)}` : ''}</p>
      </div>
      {stars != null && <span style={{ fontSize: s(compactSquare ? 13 : 20), fontWeight: 800, borderRadius: 999, padding: `${s(compactSquare ? 3 : 5)}px ${s(compactSquare ? 8 : 14)}px`, background: 'rgba(255,255,255,.16)', border: `1px solid ${C.line}`, color: C.ink, whiteSpace: 'nowrap', flexShrink: 0 }}><span style={{ color: '#ffd66b' }}>★</span> {stars.toFixed(1)}</span>}
    </div>; })}</div>
    {data.publishedReviews.length > reviews.length && <p style={{ fontSize: s(18), marginTop: s(12), fontWeight: 700, color: C.mint }}>+ {data.publishedReviews.length - reviews.length} more published reviews</p>}
  </div>; })() : null;

  const qaCues = questions.map(() => cue(0.1));
  const qaCols = cols === 2 && w / h > 1.5 ? 4 : 3;
  // CSS columns pack tiles of different heights top-to-bottom with no empty gaps (masonry).
  const qa = questions.length > 0 ? <div style={{ columnCount: qaCols, columnGap: s(10), width: '100%' }}>{questions.map((q, i) => { const mq = mv('pop', qaCues[i]); return <div key={q.id} className={mq.className} style={{ ...mq.style, breakInside: 'avoid', display: 'block', marginBottom: s(10), borderRadius: s(20), padding: `${s(14)}px ${s(16)}px`, background: 'rgba(1,43,54,.5)', border: `1px solid ${C.line}` }}>
    <p style={{ fontSize: s(13), letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800, color: C.mint, overflowWrap: 'anywhere' }}>{sanitizeUserText(q.question, 300)}</p>
    {q.type === 'image_upload' ? <div style={{ display: 'grid', gridTemplateColumns: imageAnswerGrid(answerImageUrls(data.answers[q.key]), 2), gap: s(6), marginTop: s(6) }}>{answerImageUrls(data.answers[q.key]).slice(0, Math.max(1, q.image_count || 1)).map((url, idx) => <img key={`${q.id}-${idx}`} src={safeExternalUrl(url) || undefined} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: s(12), border: `1px solid ${C.line}` }} />)}</div> : q.type === 'select_multiple' && Array.isArray(data.answers[q.key]) ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: s(6), marginTop: s(6) }}>{(data.answers[q.key] as unknown[]).map((v, idx) => { const raw = String(v); const value = decodeOtherAnswer(raw).value || raw; return <span key={`${q.id}-${idx}`} style={{ borderRadius: 999, padding: `${s(6)}px ${s(10)}px`, background: 'rgba(34,211,238,.12)', border: `1px solid ${C.line}`, color: C.ink, fontSize: s(14), fontWeight: 700 }}>{sanitizeUserText(value, 180)}</span>; })}</div> : <p style={{ fontSize: s(24), fontWeight: 600, marginTop: s(4), color: C.ink, overflowWrap: 'anywhere', lineHeight: 1.25 }}>{sanitizeUserText(answerText(data.answers[q.key]), 1200)}</p>}
  </div>; })}</div> : null;

  const ig = cleanInstagram(data.instagram);
  const otherSocials = data.socialLinks.filter((l) => !(ig && l.platform === 'instagram')).slice(0, ig ? 2 : 3);
  const tFooter = cue(0.2);
  const tBrand = cue(0.2);
  const colStyle: CSSProperties = { position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: s(14) };
  const banner = mv('fade', tBanner);
  const avatarMv = mv('pop', tAvatar);
  const eyebrow = mv('drop', tEyebrow);
  const nameMv = mv('drop', tName);
  const handleMv = mv('drop', tHandle);
  const footerMv = mv('fade', tFooter);
  const brandMv = mv('pop', tBrand);

  return <div
    ref={canvasRef}
    className={`nl-profile-card-export${play || still ? '' : ' nl-pc-paused'}`}
    style={{
      position: 'absolute', top: 0, left: 0, width: w, height: h, overflow: 'hidden',
      transform: `scale(${scale})`, transformOrigin: 'top left',
      // Deep teal -> bright teal, like the review poster, with a soft white bloom behind the logo.
      background: `linear-gradient(150deg,${C.deep} 0%,${C.deep2} 26%,#00687f 52%,${C.teal} 76%,#3fd3d9 100%)`,
      color: C.ink,
    }}
  >
    {/* Ambient light (slowly drifting on screen, static in the export) */}
    <div className={still ? '' : 'nl-pc-loop nl-pc-drift'} style={{ position: 'absolute', right: -w * 0.25, top: -h * 0.12, width: w * 0.9, height: w * 0.9, borderRadius: '50%', background: 'radial-gradient(circle, rgba(92,225,230,.42) 0%, rgba(92,225,230,0) 62%)' }} />
    <div style={{ position: 'absolute', right: -w * 0.22, bottom: -w * 0.3, width: w * 0.8, height: w * 0.8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,255,255,.55) 24%, rgba(255,255,255,0) 58%)' }} />
    <div style={{ position: 'absolute', left: -w * 0.2, bottom: h * 0.18, width: w * 0.7, height: w * 0.7, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,151,178,.35) 0%, rgba(0,151,178,0) 65%)' }} />

    {/* Banner */}
    <div className={banner.className} style={{ ...banner.style, position: 'absolute', top: 0, left: 0, right: 0, height: bannerH, overflow: 'hidden', background: `linear-gradient(135deg,${C.deep} 0%,#02586b 55%,#16b5c4 100%)` }}>
      {data.headerImageUrl
        ? <img className={still ? '' : 'nl-pc-a nl-pc-zoom'} src={safeExternalUrl(data.headerImageUrl) || undefined} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <>
          <svg width="100%" height="100%" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} aria-hidden="true">
            {[120, 190, 260, 330, 400].map((r) => <circle key={r} cx="880" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />)}
            {[[120, 70], [260, 190], [420, 90], [610, 210], [730, 70]].map(([x, y], i) => <circle key={i} className={still ? '' : 'nl-pc-loop nl-pc-twinkle'} style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${x}px ${y}px` }} cx={x} cy={y} r="3" fill="#fff" />)}
          </svg>
          <NlLogo className={still ? '' : 'nl-pc-loop nl-pc-float'} style={{ position: 'absolute', right: pad, top: '50%', marginTop: -bannerH * 0.36, height: bannerH * 0.72, width: bannerH * 0.72, color: '#fff', opacity: 0.16 }} />
        </>}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(1,43,54,.05) 30%, rgba(1,43,54,.55) 100%)` }} />
      {!still && onHeaderUpload && <button type="button" onClick={(e) => { e.stopPropagation(); onHeaderUpload(); }} title="Change banner (1500 × 500 px)" aria-label="Change banner image, 1500 by 500 pixels" className="nl-pc-edit-chip" style={{ top: ui(10), right: ui(10), height: ui(28), padding: `0 ${ui(5)}px 0 ${ui(11)}px`, gap: ui(7), fontSize: ui(11) }}>1500 × 500 px<span className="nl-pc-edit-dot" style={{ width: ui(20), height: ui(20) }}><ImagePlus width={ui(12)} height={ui(12)} /></span></button>}
    </div>

    {/* One-off light sweep across the whole card (screen only) */}
    {!still && <div className="nl-pc-a nl-pc-sweep" style={{ ['--d' as string]: `${(tBrand + 0.2).toFixed(2)}s`, position: 'absolute', top: -h * 0.1, bottom: -h * 0.1, width: w * 0.22, left: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.28), rgba(255,255,255,0))', pointerEvents: 'none' } as CSSProperties} />}

    <div style={{ position: 'absolute', left: pad, right: pad, top: bannerH - avatar / 2, bottom: pad * 0.7, display: 'flex', flexDirection: 'column', gap: s(18) }}>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: s(24), flexShrink: 0 }}>
        <div className={avatarMv.className} style={{ ...avatarMv.style, position: 'relative', width: avatar, height: avatar, flexShrink: 0 }}>
          {!still && <div className="nl-pc-a nl-pc-ring" style={{ ['--d' as string]: `${(tAvatar + 0.5).toFixed(2)}s`, position: 'absolute', inset: 0, borderRadius: '50%' } as CSSProperties} />}
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: s(7), background: `conic-gradient(from 210deg, ${C.cyan}, #ffffff, ${C.teal}, ${C.mint}, ${C.cyan})`, boxShadow: '0 14px 34px rgba(0,25,35,.45)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: s(5), background: C.deep2 }}>
              {data.avatarUrl
                ? <img src={safeExternalUrl(data.avatarUrl) || undefined} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
                : <div className="font-serif" style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: avatar * 0.42, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg,${C.teal},${C.cyan})` }}>{sanitizeUserText(data.name || data.username || 'R', 120).slice(0, 1).toUpperCase()}</div>}
            </div>
          </div>
          {!still && onAvatarUpload && <button type="button" onClick={(e) => { e.stopPropagation(); onAvatarUpload(); }} title="Change profile picture" aria-label="Change profile picture" className="nl-pc-cam" style={{ width: ui(26), height: ui(26), left: avatar * 0.853 - ui(26) / 2, top: avatar * 0.853 - ui(26) / 2 }}><Camera width={ui(13)} height={ui(13)} /></button>}
        </div>
        <div style={{ minWidth: 0, flex: 1, paddingTop: avatar / 2 + s(6) }}>
          <p className={eyebrow.className} style={{ ...eyebrow.style, fontSize: s(15), letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 800, color: C.mint, marginBottom: s(6) }}>Novelty Library · Reader</p>
          <h2 className={`font-serif ${nameMv.className}`} style={{ ...nameMv.style, fontSize: s((cols === 2 ? 56 : 62) * nameScale(data.name || 'Novelty Reader')), fontWeight: 700, lineHeight: 1.08, color: C.ink, textShadow: '0 4px 22px rgba(0,25,35,.5)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{sanitizeUserText(data.name || 'Novelty Reader', 120)}</h2>
          <p className={handleMv.className} style={{ ...handleMv.style, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: s(24), fontWeight: 700, marginTop: s(8), padding: `${s(4)}px ${s(18)}px`, borderRadius: 999, background: C.glassStrong, border: `1px solid ${C.line}`, color: C.mint }}>@{sanitizeUserText(data.username || 'reader', 80)}</p>
        </div>
      </div>

      {/* Body (everything in here is auto-fitted) */}
      <div data-fit style={{ ...colStyle, flex: 1, gap: s(14) }}>
        {cols === 2
          ? <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: s(18), alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: s(14), minWidth: 0 }}>{metrics}{journey}</div>
              <div style={{ minWidth: 0 }}>{shelf}</div>
            </div>
            {qa}
          </>
          : <>{metrics}{journey}{shelf}{qa}</>}
      </div>

      {/* Footer: socials on the left, brand lockup (wordmark, then logo) on the right, vertically centred */}
      <div className={footerMv.className} style={{ ...footerMv.style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(16), flexShrink: 0, minHeight: s(84) }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: s(10), minWidth: 0 }}>
          {ig && <a href={safeExternalUrl(`https://instagram.com/${ig}`) || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: s(10), maxWidth: '100%', borderRadius: 999, padding: `${s(9)}px ${s(22)}px ${s(9)}px ${s(10)}px`, background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 28%,#d62976 58%,#962fbf 82%,#4f5bd5 100%)', color: '#fff', fontWeight: 800, fontSize: s(22), boxShadow: '0 10px 24px rgba(0,25,35,.35)', textDecoration: 'none' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: s(34), height: s(34), borderRadius: '50%', background: 'rgba(255,255,255,.24)', flexShrink: 0 }}><Instagram width={s(20)} height={s(20)} /></span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{ig}</span>
          </a>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: s(10) }}>{otherSocials.map((link) => <a key={link.platform} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: s(8), borderRadius: 999, padding: `${s(9)}px ${s(20)}px`, fontSize: s(21), fontWeight: 700, background: C.glassStrong, color: '#fff', border: `1px solid ${C.line}`, textDecoration: 'none' }}>{platformIcon(link.platform, s(20))} {sanitizeUserText(platformLabel(link.platform), 40)}</a>)}</div>
        </div>
        <div className={brandMv.className} style={{ ...brandMv.style, display: 'flex', alignItems: 'center', gap: s(16), flexShrink: 0, borderRadius: 999, padding: `${s(10)}px ${s(14)}px ${s(10)}px ${s(30)}px`, background: '#fff', boxShadow: '0 16px 36px rgba(0,40,50,.35)' }}>
          <div style={{ textAlign: 'right' }}><p className="font-serif" style={{ fontSize: s(26), fontWeight: 700, lineHeight: 1, color: C.deep2 }}>Novelty Library</p><p style={{ fontSize: s(14), letterSpacing: '.18em', textTransform: 'uppercase', marginTop: s(6), color: C.teal, fontWeight: 800 }}>Read · Review · Discover</p></div>
          <img src={LOGO} alt="Novelty Library" style={{ width: s(60), height: s(60), objectFit: 'contain', display: 'block' }} />
        </div>
      </div>
    </div>
  </div>;
}
