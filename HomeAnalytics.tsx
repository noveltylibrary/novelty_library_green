import { useState, type ReactNode } from 'react';
import {
  Award, BookCheck, BookOpen, Check, CheckCircle2, Copy, Globe2, Instagram, Library,
  MessageCircle, PenTool, Star, Trophy, Users, ArrowRight, ShieldCheck,
} from 'lucide-react';
import type { Review } from '@/types/review';
import { RwStarRating } from '@/components/RwStarRating';
import {
  contributorLink, formatFloor10, formatLangCount, milestone, useCountUp,
  type HomeAnalytics as Data,
} from '@/lib/homeAnalytics';

interface Props {
  navigate: (path: string) => void;
  published: Review[];
  data: Data | null;
  failed: boolean;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export function HomeAnalytics({ navigate, published, data, failed }: Props) {
  const [copied, setCopied] = useState(false);

  const accepted = data?.accepted_total ?? 0;
  const publishedCount = Math.max(data?.published_total ?? 0, published.length);
  const ms = milestone(accepted);
  const trust = data?.avg_form_rating ?? null;

  const curated = useCountUp(ms.floored);
  const acceptedAnim = useCountUp(ms.floored);
  const publishedAnim = useCountUp(publishedCount);
  const trustAnim = useCountUp(trust ?? 0, 1);
  const topCount = useCountUp(data?.top_contributor?.count ?? 0);

  const langs = data?.languages ?? [];
  const langLabel = formatLangCount(langs.length);
  const top3 = langs.slice(0, 3).map((l) => l.name.substring(0, 2).toUpperCase()).join(', ');
  const english = data?.english_reviews ?? 0;
  const leader = data?.top_contributor ? contributorLink(data.top_contributor) : null;
  const leaderPct = data?.top_contributor ? pct(data.top_contributor.count, accepted) : 0;
  const recentAccepted = data?.recent_accepted ?? [];
  const readerRatings = data?.community_ratings ?? 0;
  const readerRatingAvg = readerRatings > 0 ? (data?.community_rating_sum ?? 0) / readerRatings : null;
  const recentPublished = [...published]
    .sort((a, b) => new Date(b.published_on || b.published_at).getTime() - new Date(a.published_on || a.published_at).getTime())
    .slice(0, 4);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const waHref = `https://wa.me/?text=${encodeURIComponent(`We have curated ${ms.floored}+ book reviews across ${langLabel} languages! Next milestone ${ms.next}+ - Join us: ${shareUrl}`)}`;

  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(shareUrl);
      else {
        const t = document.createElement('textarea');
        t.value = shareUrl; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <section className="nl-an" aria-label="Novelty Library analytics">
      <div className="nl-an-bridge">
        <div className="nl-an-bridge-copy">
          <span className="nl-an-bridge-kicker"><span className="nl-an-live" /> LIVE LIBRARY SIGNAL</span>
          <strong>Every review leaves a measurable trace.</strong>
          <p>Accepted reviews, published reads and reader ratings flow into the library below.</p>
        </div>
        <div className="nl-an-bridge-metrics" aria-hidden="true">
          <span><b>{acceptedAnim}</b><small>accepted</small></span>
          <i />
          <span><b>{publishedAnim}</b><small>published</small></span>
          <i />
          <span><b>{trust === null ? '—' : trustAnim.toFixed(1)}</b><small>trust / 10</small></span>
        </div>
      </div>

      <p className="nl-an-eyebrow"><span className="nl-an-live" /> NOVELTY LIBRARY ANALYTICS • LIVE</p>

      <div className="nl-an-top">
        <h2 className="nl-an-title">
          We have curated<br />
          <span className="nl-an-accent">{curated}+</span> Reviews
        </h2>
        <div className="nl-an-trust">
          <div className="nl-an-trust-icon"><Trophy className="h-4 w-4" /></div>
          <div className="nl-an-trust-text">
            <span>Trust Score</span>
            <b>{trust === null ? '—' : `${trustAnim.toFixed(1)}/10`}</b>
          </div>
        </div>
      </div>

      <p className="nl-an-sub">
        Across <b>{langs.length ? langLabel : '10+'}</b> Languages • Next milestone <b>{ms.next}+</b> • <b>{ms.remain} to go</b>
      </p>

      {failed && <p className="nl-an-note">Live stats are temporarily unavailable. Please refresh in a moment.</p>}

      {/* Discrete blocks: Accepted Reviews (master directory) and Published Reviews */}
      <div className="nl-an-grid">
        <div className="nl-an-card">
          <div className="nl-an-card-head"><BookCheck className="h-4 w-4" /><span>ACCEPTED REVIEWS</span></div>
          <h3 className="nl-an-big">{acceptedAnim}<small>+</small></h3>
          <div className="nl-an-bar-meta"><span>{Math.round(ms.progress)}% TO NEXT</span><span>{accepted} / {ms.next}</span></div>
          <div className="nl-an-bar"><i style={{ width: `${ms.progress}%` }} /></div>
          <ul className="nl-an-list">
            {recentAccepted.slice(0, 4).map((r) => (
              <li key={r.review_no}>
                <span className="nl-an-no">#{r.review_no}</span>
                <span className="nl-an-li-title">{r.book_title}</span>
                {r.reviewers_rating && <span className="nl-an-li-rate nl-an-rw-stars" title={`R/W ${Number(r.reviewers_rating).toFixed(1)}/10`}><RwStarRating value={Number(r.reviewers_rating)} size={14} /></span>}
              </li>
            ))}
            {!data && !failed && <li className="nl-an-skel" />}
          </ul>
        </div>

        <div className="nl-an-card">
          <div className="nl-an-card-head"><Library className="h-4 w-4" /><span>PUBLISHED REVIEWS</span></div>
          <h3 className="nl-an-big">{publishedAnim}</h3>
          <div className="nl-an-bar-meta"><span>{pct(publishedCount, accepted)}% OF ACCEPTED LIVE</span><span>{publishedCount} / {accepted}</span></div>
          <div className="nl-an-bar"><i style={{ width: `${Math.min(100, pct(publishedCount, accepted))}%` }} /></div>
          <ul className="nl-an-list">
            {recentPublished.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => navigate(`/review/${r.slug}`)}>
                  <span className="nl-an-no">#{r.master_review_no ?? r.review_number ?? '·'}</span>
                  <span className="nl-an-li-title">{r.title}</span>
                  <span className="nl-an-li-rate nl-an-rw-stars" title={`R/W ${Number(r.rw_rating).toFixed(1)}/10`}><RwStarRating value={Number(r.rw_rating)} size={14} /></span>
                </button>
              </li>
            ))}
            {recentPublished.length === 0 && <li className="nl-an-empty">Newly published reviews appear here.</li>}
          </ul>
        </div>
      </div>

      <div className="nl-an-grid nl-an-feature-grid">
        <div className="nl-an-feature-stack">
          <div className="nl-an-contrib">
            <span className="nl-an-badge"><Award className="h-3 w-3" /> TOP CONTRIBUTOR</span>
            <div className="nl-an-contrib-main">
              <div>
                <p className="nl-an-contrib-label">MOST BOOKS REVIEWED BY</p>
                {leader?.href ? (
                  <a className="nl-an-handle" href={leader.href} target="_blank" rel="noopener noreferrer">{leader.text}</a>
                ) : (
                  <span className="nl-an-handle">{leader?.text ?? '—'}</span>
                )}
              </div>
              <div className="nl-an-contrib-bottom">
                <b className="nl-an-contrib-count">{topCount}</b>
                <span className="nl-an-pill">~{leaderPct}% of total</span>
              </div>
            </div>
          </div>

          <div className="nl-an-sequence nl-an-trust-panel">
            <div className="nl-an-sequence-icon"><ShieldCheck className="h-4 w-4" /></div>
            <div className="nl-an-sequence-copy">
              <span>TRUST SCORE</span>
              <strong>{trust === null ? '—' : `${trustAnim.toFixed(1)}/10`}</strong>
              <small>Average reviewer trust score</small>
              <div className="nl-trust-bar"><i style={{ width: `${Math.min(100, Math.max(0, (trust ?? 0) * 10))}%` }} /></div>
            </div>
          </div>

          <div className="nl-an-sequence nl-an-community-activity">
            <div className="nl-an-sequence-icon"><MessageCircle className="h-4 w-4" /></div>
            <div className="nl-an-sequence-copy w-full">
              <span>COMMUNITY ACTIVITY</span>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div><strong className="!text-xl">{data?.community_likes ?? 0}</strong><small>likes</small></div>
                <div><strong className="!text-xl">{data?.community_reader_reviews ?? 0}</strong><small>reader reviews</small></div>
                <div><strong className="!text-xl">{readerRatingAvg === null ? '—' : readerRatingAvg.toFixed(1)}</strong><small>reader avg / 10</small></div>
              </div>
            </div>
          </div>

          <div className="nl-an-sequence nl-an-total-users">
            <div className="nl-an-sequence-icon"><Users className="h-4 w-4" /></div>
            <div className="nl-an-sequence-copy w-full">
              <span>TOTAL USERS</span>
              <strong className="nl-total-users-number">{data?.total_users ?? 0}</strong>
              <small>Registered Novelty Library accounts</small>
            </div>
          </div>
        </div>

        <div className="nl-an-card">
          <div className="nl-an-card-head"><Star className="h-4 w-4" /><span>TOP RATED IN THE DIRECTORY</span></div>
          <ul className="nl-an-list nl-an-list-tight">
            {(data?.top_rated_accepted ?? []).map((r, i) => (
              <li key={r.review_no}>
                <span className="nl-an-rank">{i + 1}</span>
                <span className="nl-an-li-title">{r.book_title}<em>{r.author}</em></span>
                <span className="nl-an-li-rate nl-an-rw-stars" title={`R/W ${Number(r.reviewers_rating).toFixed(1)}/10`}><RwStarRating value={Number(r.reviewers_rating)} size={14} /></span>
              </li>
            ))}
            {!data && !failed && <li className="nl-an-skel" />}
          </ul>
          {data?.avg_book_rating != null && <p className="nl-an-chip"><CheckCircle2 className="h-3 w-3" /> Avg book rating {data.avg_book_rating}/10</p>}
        </div>
      </div>

      <div className="nl-an-stats">
        <Stat icon={<Globe2 />} value={langs.length ? langLabel : '—'} label="LANGUAGES" sub={langs.length ? `${top3} +${Math.max(0, langs.length - 3)}` : ''} />
        <Stat icon={<BookOpen />} value={accepted ? `${((english / accepted) * 100).toFixed(1)}%` : '—'} label="ENGLISH" sub={`${english} Reviews`} />
        <Stat icon={<Users />} value={data ? formatFloor10(data.reviewers) : '—'} label="REVIEWERS" sub={data ? `${data.reviewers} Reviewers added` : ''} />
        <Stat icon={<PenTool />} value={data ? formatFloor10(data.authors) : '—'} label="AUTHORS" sub={data ? `${data.authors} Authors added` : ''} />
      </div>

      <div className="nl-an-ticks">
        <span><ShieldCheck className="h-3.5 w-3.5" /> 100% Human Reviews</span><i>•</i>
        <span><ShieldCheck className="h-3.5 w-3.5" /> No AI Generated Reviews</span><i>•</i>
        <span><ShieldCheck className="h-3.5 w-3.5" /> Since 2024</span>
      </div>

      <div className="nl-an-action-dock">
        <div className="nl-an-action-copy">
          <span className="nl-an-action-kicker"><PenTool className="h-3.5 w-3.5" /> YOUR NEXT CONTRIBUTION</span>
          <strong>Turn your next read into a review.</strong>
          <p>Share a human perspective and add the next signal to the library.</p>
        </div>
        <button type="button" className="nl-an-submit" onClick={() => navigate('/submit')}>
          <span>Write a review</span>
          <b>SUBMIT NOW <ArrowRight className="h-4 w-4" /></b>
        </button>
      </div>

      <div className="nl-an-share">
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="is-wa"><MessageCircle className="h-4 w-4" /> <span>Share on WhatsApp</span><ArrowRight className="nl-an-share-arrow h-3.5 w-3.5" /></a>
        <a href="https://instagram.com/novelty.co.in" target="_blank" rel="noopener noreferrer" className="is-ig"><Instagram className="h-4 w-4" /> <span>Follow @novelty.co.in</span><ArrowRight className="nl-an-share-arrow h-3.5 w-3.5" /></a>
        <button type="button" onClick={() => void copy()} className={copied ? 'is-done' : ''}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} <span>{copied ? 'Link copied' : 'Copy page link'}</span><ArrowRight className="nl-an-share-arrow h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

function Stat({ icon, value, label, sub }: { icon: ReactNode; value: string; label: string; sub: string }) {
  return (
    <div className="nl-an-stat">
      <div className="nl-an-stat-icon">{icon}</div>
      <h4>{value}</h4>
      <p>{label}</p>
      <small>{sub}</small>
    </div>
  );
}
