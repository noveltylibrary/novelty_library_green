import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Download, Instagram, Linkedin, Link2, BookOpen, Star } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { ProfileQuestion } from '@/lib/profileQuestions';

export type ProfileCardData = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  headerImageUrl: string | null;
  socialLinks: { platform: string; url: string }[];
  booksThisMonth: number | null;
  totalBooksRead: number | null;
  publishedBooks: number;
  avgRating: number | null;
  readingSince: number | null;
  favoriteBook: string | null;
  favoriteAuthor: string | null;
  favoriteGenre: string | null;
  publishedReviews: { id: string; reviewNo: string | null; title: string; author: string; coverUrl: string | null }[];
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
type FormatKey = (typeof FORMATS)[number]['key'];
const PREVIEW_FORMAT: FormatKey = '4:5';

/** A 1x1 transparent gif used when a remote image refuses to be exported (no CORS). */
const IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Progressive "make it fit" steps. The card is a fixed-size canvas (exactly the
 * pixel size that gets downloaded). If a reader has a lot of content, we first
 * shrink the type (it starts slightly enlarged so sparse cards fill the canvas),
 * then trim the lists, until nothing overflows.
 */
const FIT_STEPS = [
  { m: 1.3, reviews: 5, qs: 4 },
  { m: 1.2, reviews: 5, qs: 4 },
  { m: 1.1, reviews: 5, qs: 4 },
  { m: 1, reviews: 5, qs: 4 },
  { m: 1, reviews: 4, qs: 3 },
  { m: 0.94, reviews: 4, qs: 3 },
  { m: 0.9, reviews: 3, qs: 2 },
  { m: 0.85, reviews: 3, qs: 2 },
  { m: 0.8, reviews: 2, qs: 2 },
  { m: 0.75, reviews: 2, qs: 1 },
  { m: 0.7, reviews: 2, qs: 0 },
  { m: 0.64, reviews: 1, qs: 0 },
  { m: 0.58, reviews: 1, qs: 0 },
];

function normalizeUrl(value: string) { return /^https?:\/\//i.test(value) ? value : `https://${value}`; }
function platformLabel(platform: string) { return platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1); }
function platformIcon(platform: string, size: number) {
  if (platform === 'instagram') return <Instagram width={size} height={size} />;
  if (platform === 'linkedin') return <Linkedin width={size} height={size} />;
  return <Link2 width={size} height={size} />;
}

export function ProfileCard({ data, download = false }: { data: ProfileCardData; download?: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<FormatKey>(PREVIEW_FORMAT);
  const [downloading, setDownloading] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
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

  const downloadCard = async () => {
    if (!canvasRef.current || downloading) return;
    setDownloading(true);
    try {
      if ('fonts' in document) await document.fonts.ready;
      const options = {
        cacheBust: true,
        pixelRatio: 1,
        width: selected.width,
        height: selected.height,
        backgroundColor: '#0a8296',
        imagePlaceholder: IMAGE_PLACEHOLDER,
        // The on-screen preview is scaled down with CSS; export at full size.
        style: { transform: 'none' },
      };
      // First pass warms up image/font loading, second pass is the real export.
      await toPng(canvasRef.current, options).catch(() => undefined);
      const dataUrl = await toPng(canvasRef.current, options);
      const a = document.createElement('a');
      a.download = `novelty-library-profile-${data.username || 'reader'}-${format.replace(':', 'x')}.png`;
      a.href = dataUrl;
      a.click();
    } catch (error) {
      console.error(error);
      window.alert('The profile card could not be exported. Please try again after the images finish loading.');
    } finally { setDownloading(false); }
  };

  return <div className="w-full">
    {download && <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
      <select value={format} onChange={(e) => setFormat(e.target.value as FormatKey)} className="input-field !w-auto !py-2 text-sm" aria-label="Card format">
        {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.key} · {f.width}×{f.height}</option>)}
      </select>
      <button type="button" onClick={downloadCard} disabled={downloading} className="btn-primary !w-auto disabled:opacity-50"><Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download Profile Card'}</button>
    </div>}

    {/* The preview is the exact export canvas, scaled down to fit the page. What you see is what you download. */}
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-[28px] shadow-xl" style={{ height: selected.height * scale, border: '1px solid rgba(8,145,178,.24)' }}>
      <CardCanvas canvasRef={canvasRef} data={data} width={selected.width} height={selected.height} scale={scale} />
    </div>
  </div>;
}

function CardCanvas({ canvasRef, data, width: w, height: h, scale }: { canvasRef: RefObject<HTMLDivElement>; data: ProfileCardData; width: number; height: number; scale: number }) {
  const cols = w / h >= 0.95 ? 2 : 1;
  const signature = `${w}x${h}|${data.publishedReviews.length}|${data.questions.length}|${JSON.stringify(data.answers).length}|${data.name}|${data.favoriteBook}|${data.favoriteAuthor}|${data.favoriteGenre}|${data.socialLinks.length}`;
  const [step, setStep] = useState(0);
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) { setLastSignature(signature); setStep(0); }
  const fit = FIT_STEPS[Math.min(step, FIT_STEPS.length - 1)];

  // After every render, check whether any column spills out of its box and, if so, take the next (smaller) step.
  useLayoutEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    const overflowing = Array.from(root.querySelectorAll<HTMLElement>('[data-fit]')).some((el) => el.scrollHeight > el.clientHeight + 1);
    if (overflowing && step < FIT_STEPS.length - 1) setStep(step + 1);
  }, [step, signature, canvasRef]);

  // Late-loading images/fonts can change heights; re-check once they settle.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = canvasRef.current;
      if (!root) return;
      const overflowing = Array.from(root.querySelectorAll<HTMLElement>('[data-fit]')).some((el) => el.scrollHeight > el.clientHeight + 1);
      if (overflowing) setStep((s) => Math.min(s + 1, FIT_STEPS.length - 1));
    }, 700);
    return () => window.clearTimeout(t);
  }, [signature, step, canvasRef]);

  const u = Math.min(w / 1080, h / 1000) * fit.m;
  const s = (n: number) => n * u;
  const pad = w * 0.055;
  const bannerH = Math.round(cols === 2 ? h * 0.27 : Math.min(h * 0.2, w * 0.4));
  const avatar = Math.round(cols === 2 ? h * 0.22 : w * 0.21);

  const questions = data.questions.filter((q) => {
    const value = data.answers[q.key];
    return q.show_in_profile_card !== false && value !== undefined && value !== null && String(value).trim() !== '';
  }).slice(0, fit.qs);
  const reviews = data.publishedReviews.slice(0, fit.reviews);
  const hasJourney = !!(data.favoriteBook || data.favoriteAuthor || data.favoriteGenre || data.readingSince);

  const metrics = <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: s(14) }}>
    {data.booksThisMonth != null && <Metric s={s} icon={<BookOpen width={s(24)} height={s(24)} />} value={String(data.booksThisMonth)} label="books read this month" />}
    {data.totalBooksRead != null && <Metric s={s} icon={<BookOpen width={s(24)} height={s(24)} />} value={String(data.totalBooksRead)} label="total books read" />}
    <Metric s={s} icon={<BookOpen width={s(24)} height={s(24)} />} value={String(data.publishedBooks)} label="published with us" />
    {data.avgRating != null && <Metric s={s} icon={<Star width={s(24)} height={s(24)} />} value={data.avgRating.toFixed(1)} label="average rating given" />}
  </div>;

  const journey = hasJourney ? <div style={{ borderRadius: s(26), padding: s(20), background: 'linear-gradient(135deg,rgba(4,78,96,.94),rgba(8,121,139,.9))', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 12px 28px rgba(3,66,78,.22)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(12), marginBottom: s(14) }}>
      <p style={{ fontSize: s(17), letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: 'rgba(255,255,255,.78)' }}>Reading journey</p>
      {data.readingSince && <span style={{ fontSize: s(17), fontWeight: 700, borderRadius: 999, padding: `${s(5)}px ${s(14)}px`, background: 'rgba(255,255,255,.16)', color: '#fff', whiteSpace: 'nowrap' }}>Reading since {data.readingSince}</span>}
    </div>
    <div style={{ display: 'grid', gap: s(10) }}>
      {data.favoriteBook && <JourneyItem s={s} label="Favourite book" value={data.favoriteBook} />}
      {data.favoriteAuthor && <JourneyItem s={s} label="Favourite author" value={data.favoriteAuthor} />}
      {data.favoriteGenre && <JourneyItem s={s} label="Favourite genre" value={data.favoriteGenre} />}
    </div>
  </div> : null;

  const shelf = reviews.length > 0 ? <div style={{ borderRadius: s(26), padding: s(20), background: 'rgba(255,255,255,.9)', border: '1px solid rgba(8,145,178,.2)', boxShadow: '0 10px 25px rgba(3,66,78,.14)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(12), marginBottom: s(12) }}>
      <div><p style={{ fontSize: s(16), letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: '#0e7490' }}>Published shelf</p><p className="font-serif" style={{ fontSize: s(30), fontWeight: 700, lineHeight: 1.1, color: '#063845' }}>Reviews on Novelty Library</p></div>
      <span style={{ fontSize: s(22), fontWeight: 800, borderRadius: 999, padding: `${s(4)}px ${s(16)}px`, background: 'rgba(8,145,178,.12)', color: '#087f91' }}>{data.publishedReviews.length}</span>
    </div>
    <div style={{ display: 'grid', gap: s(10) }}>{reviews.map((review) => <div key={review.id} style={{ display: 'flex', alignItems: 'center', gap: s(14), borderRadius: s(16), padding: s(10), background: 'rgba(8,145,178,.07)' }}>
      <div style={{ width: s(60), height: s(82), borderRadius: s(10), overflow: 'hidden', flexShrink: 0, background: 'rgba(8,145,178,.14)', display: 'grid', placeItems: 'center' }}>{review.coverUrl ? <img src={review.coverUrl} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen width={s(24)} height={s(24)} style={{ color: '#087f91' }} />}</div>
      <div style={{ minWidth: 0 }}><p style={{ fontSize: s(24), fontWeight: 700, color: '#063845', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{review.title}</p><p style={{ fontSize: s(19), color: '#4b6970', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{review.author}{review.reviewNo ? ` · #${review.reviewNo}` : ''}</p></div>
    </div>)}</div>
    {data.publishedReviews.length > reviews.length && <p style={{ fontSize: s(18), marginTop: s(10), fontWeight: 700, color: '#087f91' }}>+ {data.publishedReviews.length - reviews.length} more published reviews</p>}
  </div> : null;

  const qa = questions.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: cols === 2 ? '1fr' : '1fr 1fr', gap: s(10) }}>{questions.map((q) => <div key={q.id} style={{ borderRadius: s(20), padding: s(14), background: 'rgba(255,255,255,.82)', border: '1px solid rgba(8,145,178,.16)' }}>
    <p style={{ fontSize: s(15), letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800, color: '#0e7490' }}>{q.question}</p>
    <p style={{ fontSize: s(21), fontWeight: 600, marginTop: s(4), color: '#164e63', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(data.answers[q.key])}</p>
  </div>)}</div> : null;

  const colStyle = { minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: s(14) } as const;

  return <div
    ref={canvasRef}
    className="nl-profile-card-export"
    style={{
      position: 'absolute', top: 0, left: 0, width: w, height: h, overflow: 'hidden',
      transform: `scale(${scale})`, transformOrigin: 'top left',
      // Teal everywhere, melting to white in the bottom-right corner where the logo sits.
      background: 'radial-gradient(120% 62% at 100% 100%, #ffffff 0%, rgba(255,255,255,.94) 24%, rgba(255,255,255,0) 66%), linear-gradient(165deg,#065a6d 0%,#09808f 36%,#14a4b4 68%,#52cdd3 100%)',
      color: '#063845',
    }}
  >
    {/* Banner */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: bannerH, overflow: 'hidden', background: 'linear-gradient(135deg,#04495a 0%,#087f91 52%,#35d3d9 100%)' }}>
      {data.headerImageUrl
        ? <img src={data.headerImageUrl} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', opacity: 0.3, backgroundImage: 'radial-gradient(circle at 15% 30%,white 0 2px,transparent 3px), radial-gradient(circle at 70% 20%,white 0 1px,transparent 2px), radial-gradient(circle at 82% 72%,white 0 1px,transparent 2px)' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,42,52,.05), rgba(0,55,65,.45))' }} />
    </div>

    <div style={{ position: 'absolute', left: pad, right: pad, top: bannerH - avatar / 2, bottom: pad * 0.7, display: 'flex', flexDirection: 'column', gap: s(18) }}>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: s(26), flexShrink: 0 }}>
        <div style={{ width: avatar, height: avatar, borderRadius: '50%', padding: s(7), background: '#fff', boxShadow: '0 10px 28px rgba(3,66,78,.3)', flexShrink: 0 }}>
          {data.avatarUrl
            ? <img src={data.avatarUrl} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : <div className="font-serif" style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: avatar * 0.42, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0891b2,#5eead4)' }}>{(data.name || data.username || 'R').slice(0, 1).toUpperCase()}</div>}
        </div>
        <div style={{ minWidth: 0, paddingTop: avatar / 2 + s(8) }}>
          <p style={{ fontSize: s(18), letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 800, color: 'rgba(255,255,255,.82)', marginBottom: s(6) }}>Novelty Library · Reader</p>
          <h2 className="font-serif" style={{ fontSize: s(cols === 2 ? 58 : 66), fontWeight: 700, lineHeight: 1, color: '#fff', textShadow: '0 2px 12px rgba(0,50,62,.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name || 'Novelty Reader'}</h2>
          <p style={{ fontSize: s(30), fontWeight: 700, marginTop: s(8), color: '#c9f7f9' }}>@{data.username || 'reader'}</p>
        </div>
      </div>

      {/* Body (everything in here is auto-fitted) */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr', gap: s(18) }}>
        {cols === 2
          ? <>
            <div data-fit style={colStyle}>{metrics}{journey}</div>
            <div data-fit style={colStyle}>{shelf}{qa}</div>
          </>
          : <div data-fit style={colStyle}>{metrics}{journey}{shelf}{qa}</div>}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: s(16), flexShrink: 0, minHeight: s(72) }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: s(10) }}>{data.socialLinks.slice(0, 3).map((link) => <a key={link.platform} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: s(8), borderRadius: 999, padding: `${s(8)}px ${s(18)}px`, fontSize: s(20), fontWeight: 700, background: '#fff', color: '#087f91', border: '1px solid rgba(8,145,178,.35)', textDecoration: 'none' }}>{platformIcon(link.platform, s(20))} {platformLabel(link.platform)}</a>)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(14), flexShrink: 0 }}>
          <img src={LOGO} alt="Novelty Library" style={{ width: s(72), height: s(72), objectFit: 'contain' }} />
          <div><p className="font-serif" style={{ fontSize: s(30), fontWeight: 700, lineHeight: 1, color: '#063845' }}>Novelty Library</p><p style={{ fontSize: s(15), letterSpacing: '.16em', textTransform: 'uppercase', marginTop: s(6), color: '#0e7490', fontWeight: 700 }}>Read · Review · Discover</p></div>
        </div>
      </div>
    </div>
  </div>;
}

function JourneyItem({ s, label, value }: { s: (n: number) => number; label: string; value: string }) {
  return <div style={{ borderRadius: s(16), padding: s(12), background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.14)' }}>
    <p style={{ fontSize: s(15), letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800, color: 'rgba(255,255,255,.7)' }}>{label}</p>
    <p style={{ fontSize: s(24), fontWeight: 700, marginTop: s(3), color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{value}</p>
  </div>;
}

function Metric({ s, icon, value, label }: { s: (n: number) => number; icon: ReactNode; value: string; label: string }) {
  return <div style={{ borderRadius: s(22), padding: s(16), background: 'rgba(255,255,255,.9)', border: '1px solid rgba(8,145,178,.2)', boxShadow: '0 8px 20px rgba(3,66,78,.12)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: s(8), color: '#087f91' }}>{icon}<span style={{ fontWeight: 800, fontSize: s(40), lineHeight: 1 }}>{value}</span></div>
    <p style={{ fontSize: s(16), letterSpacing: '.08em', textTransform: 'uppercase', marginTop: s(8), color: '#3f6068', fontWeight: 700 }}>{label}</p>
  </div>;
}
