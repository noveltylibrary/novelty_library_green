import { useRef, useState, type ReactNode } from 'react';
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

function normalizeUrl(value: string) { return /^https?:\/\//i.test(value) ? value : `https://${value}`; }
function platformLabel(platform: string) { return platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1); }
function platformIcon(platform: string) {
  if (platform === 'instagram') return <Instagram className="w-4 h-4" />;
  if (platform === 'linkedin') return <Linkedin className="w-4 h-4" />;
  return <Link2 className="w-4 h-4" />;
}

export function ProfileCard({ data, download = false }: { data: ProfileCardData; download?: boolean }) {
  const visibleQuestions = data.questions.filter((q) => {
    const value = data.answers[q.key];
    return q.show_in_profile_card !== false && value !== undefined && value !== null && String(value).trim() !== '';
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<(typeof FORMATS)[number]['key']>('9:16');
  const [downloading, setDownloading] = useState(false);
  const selected = FORMATS.find((f) => f.key === format) || FORMATS[0];

  const downloadCard = async () => {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const oldWidth = cardRef.current.style.width;
      const oldHeight = cardRef.current.style.height;
      const oldAspect = cardRef.current.style.aspectRatio;
      cardRef.current.style.width = `${selected.width}px`;
      cardRef.current.style.height = `${selected.height}px`;
      cardRef.current.style.aspectRatio = `${selected.width}/${selected.height}`;
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 1, width: selected.width, height: selected.height, backgroundColor: '#0b6f82' });
      const a = document.createElement('a');
      a.download = `novelty-library-profile-${data.username || 'reader'}-${format.replace(':', 'x')}.png`;
      a.href = dataUrl;
      a.click();
      cardRef.current.style.width = oldWidth;
      cardRef.current.style.height = oldHeight;
      cardRef.current.style.aspectRatio = oldAspect;
    } catch (error) {
      console.error(error);
      window.alert('The profile card could not be exported. Please try again after the images finish loading.');
    } finally { setDownloading(false); }
  };

  return <div className="w-full">
    {download && <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
      <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="input-field !w-auto !py-2 text-sm">
        {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.key} · {f.width}×{f.height}</option>)}
      </select>
      <button type="button" onClick={downloadCard} disabled={downloading} className="btn-primary !w-auto disabled:opacity-50"><Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download Profile Card'}</button>
    </div>}

    <div ref={cardRef} className="nl-profile-card-export relative overflow-hidden rounded-[30px] shadow-xl" style={{ background: 'linear-gradient(155deg,#f3feff 0%,#e5fafc 38%,#b7e9ed 66%,#0a778a 100%)', border: '1px solid rgba(8,145,178,.24)' }}>
      <div className="absolute inset-x-0 top-0 h-[30%] overflow-hidden" style={{ background: 'linear-gradient(135deg,#04576a 0%,#087f91 52%,#35d3d9 100%)' }}>
        {data.headerImageUrl ? <img src={data.headerImageUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" /> : <div className="w-full h-full opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 15% 30%,white 0 2px,transparent 3px), radial-gradient(circle at 70% 20%,white 0 1px,transparent 2px), radial-gradient(circle at 82% 72%,white 0 1px,transparent 2px)' }} />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,42,52,.05), rgba(0,55,65,.52))' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full p-[6%] pt-[20%]">
        <div className="flex items-end gap-[5%]">
          <div className="w-[23%] aspect-square rounded-full p-1 shrink-0 shadow-lg" style={{ background: '#fff' }}>
            {data.avatarUrl ? <img src={data.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" /> : <div className="w-full h-full rounded-full grid place-items-center font-serif text-3xl font-bold" style={{ background: 'linear-gradient(135deg,#0891b2,#5eead4)', color: 'white' }}>{(data.name || 'R').slice(0,1).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 pb-1 flex flex-col items-start">
            <p className="text-[clamp(9px,1.2vw,18px)] uppercase tracking-[.18em] font-bold mb-2" style={{ color: '#0e7490' }}>NOVELTY LIBRARY · READER</p>
            <h2 className="font-serif font-semibold leading-[.98] text-[clamp(24px,4vw,58px)]" style={{ color: '#063845' }}>{data.name || 'Novelty Reader'}</h2>
            <p className="font-semibold text-[clamp(11px,1.6vw,22px)] mt-2" style={{ color: '#0891b2' }}>@{data.username || 'reader'}</p>
          </div>
        </div>

        <div className="mt-[6%] grid grid-cols-2 gap-3">
          {data.booksThisMonth != null && <Metric icon={<BookOpen />} value={String(data.booksThisMonth)} label="books read this month" />}
          {data.totalBooksRead != null && <Metric icon={<BookOpen />} value={String(data.totalBooksRead)} label="total books read" />}
          <Metric icon={<BookOpen />} value={String(data.publishedBooks)} label="published with Novelty Library" />
          {data.avgRating != null && <Metric icon={<Star />} value={data.avgRating.toFixed(1)} label="average rating given" />}
        </div>

        {(data.favoriteBook || data.favoriteAuthor || data.favoriteGenre || data.readingSince) && <div className="mt-4 rounded-[22px] p-4" style={{ background: 'linear-gradient(135deg,rgba(5,87,106,.92),rgba(8,127,145,.82))', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 12px 28px rgba(3,66,78,.16)' }}>
          <div className="flex items-center justify-between gap-3 mb-3"><p className="text-[10px] uppercase tracking-[.18em] font-bold" style={{ color: 'rgba(255,255,255,.72)' }}>Reading journey</p>{data.readingSince && <span className="text-[10px] font-semibold rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>Reading since {data.readingSince}</span>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {data.favoriteBook && <JourneyItem label="Favourite book" value={data.favoriteBook} />}
            {data.favoriteAuthor && <JourneyItem label="Favourite author" value={data.favoriteAuthor} />}
            {data.favoriteGenre && <JourneyItem label="Favourite genre" value={data.favoriteGenre} />}
          </div>
        </div>}

        {data.publishedReviews.length > 0 && <div className="mt-4 rounded-[22px] p-4" style={{ background: 'rgba(255,255,255,.72)', border: '1px solid rgba(8,145,178,.18)', boxShadow: '0 10px 25px rgba(3,66,78,.10)' }}>
          <div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-[10px] uppercase tracking-[.18em] font-bold" style={{ color: '#0e7490' }}>Published shelf</p><p className="font-serif font-semibold text-lg leading-tight" style={{ color: '#063845' }}>Reviews on Novelty Library</p></div><span className="text-xs font-bold rounded-full px-2.5 py-1" style={{ background: 'rgba(8,145,178,.10)', color: '#087f91' }}>{data.publishedReviews.length}</span></div>
          <div className="space-y-2">{data.publishedReviews.slice(0,5).map((review) => <div key={review.id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: 'rgba(8,145,178,.055)' }}>
            <div className="w-10 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: 'rgba(8,145,178,.10)' }}>{review.coverUrl ? <img src={review.coverUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" /> : <div className="w-full h-full grid place-items-center"><BookOpen className="w-4 h-4" style={{color:'#087f91'}} /></div>}</div>
            <div className="min-w-0"><p className="font-semibold text-sm truncate" style={{color:'#063845'}}>{review.title}</p><p className="text-[11px] truncate" style={{color:'#55747b'}}>{review.author}{review.reviewNo ? ` · #${review.reviewNo}` : ''}</p></div>
          </div>)}</div>
          {data.publishedReviews.length > 5 && <p className="text-[10px] mt-2 font-semibold" style={{color:'#087f91'}}>+ {data.publishedReviews.length - 5} more published reviews</p>}
        </div>}

        {visibleQuestions.length > 0 && <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">{visibleQuestions.slice(0,4).map((q) => <div key={q.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.56)', border: '1px solid rgba(8,145,178,.13)' }}><p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#0e7490' }}>{q.question}</p><p className="text-sm font-semibold mt-1 line-clamp-3" style={{ color: '#164e63' }}>{String(data.answers[q.key])}</p></div>)}</div>}

        <div className="mt-auto pt-5 flex items-end justify-between gap-4">
          <div className="flex flex-wrap gap-2">{data.socialLinks.slice(0,3).map((link) => <a key={link.platform} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,.14)', color: '#ffffff', border: '1px solid rgba(255,255,255,.18)' }}>{platformIcon(link.platform)} {platformLabel(link.platform)}</a>)}</div>
          <div className="flex items-center gap-2 shrink-0"><img src={LOGO} alt="Novelty Library" className="w-10 h-10 object-contain drop-shadow-sm" /><div><p className="font-serif font-bold text-sm leading-none" style={{ color: '#ffffff' }}>Novelty Library</p><p className="text-[9px] uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,.72)' }}>Read · Review · Discover</p></div></div>
        </div>
      </div>
    </div>
  </div>;
}

function JourneyItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.12)' }}><p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'rgba(255,255,255,.68)' }}>{label}</p><p className="text-sm font-semibold mt-1 line-clamp-2" style={{ color: '#fff' }}>{value}</p></div>; }

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.58)', border: '1px solid rgba(8,145,178,.16)' }}><div className="flex items-center gap-1.5" style={{ color: '#087f91' }}>{icon}<span className="font-bold text-lg">{value}</span></div><p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: '#4b6970' }}>{label}</p></div>;
}
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.48)' }}><p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#0e7490' }}>{label}</p><p className="text-sm font-semibold mt-1 line-clamp-2" style={{ color: '#164e63' }}>{value}</p></div>; }
