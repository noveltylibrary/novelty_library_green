import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, Check, ChevronRight, Facebook, ImageDown, Instagram, Link2, MessageCircle, Newspaper, Share2, X } from 'lucide-react';
import type { Review } from '@/types/review';
import { useSavedReviews } from '@/lib/readerTools';
import { useReviewShareCard } from '@/components/ReviewShareCard';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { safeExternalUrl, sanitizeUserText } from '@/lib/sanitize';

/**
 * Single-post "Shared actions" row: Copy link · Share · Save · Blog, as four SVG-only icons.
 * "Share" opens an action sheet where "Share as card" is the primary option.
 */
export function PostShareBar({ review, nl, onPrefetchBlog }: { review: Review; nl: number | null; onPrefetchBlog?: () => void }) {
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const card = useReviewShareCard(review, nl);
  const { isSaved, toggle } = useSavedReviews();
  const saved = isSaved(review.id);
  const blogUrl = safeExternalUrl(review.blog_url);
  const title = sanitizeUserText(review.title, 200);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  useOverlayHistory(sheet, () => setSheet(false));

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [sheet]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt('Copy this review link:', url); }
  };
  const open = (href: string) => { window.open(href, '_blank', 'noopener,noreferrer'); setSheet(false); };
  const nativeShare = async () => {
    try { await navigator.share({ title, text: `${title} — reviewed on Novelty Library`, url }); setSheet(false); }
    catch (e) { if ((e as { name?: string })?.name !== 'AbortError') void copyLink(); }
  };
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const sheetEl = sheet ? (
    <div className="nl-ss-overlay" role="dialog" aria-modal="true" aria-label="Share this review" onClick={() => setSheet(false)}>
      <div className="nl-ss-sheet" onClick={(e) => e.stopPropagation()}>
        <span className="nl-ss-grab" aria-hidden="true" />
        <div className="nl-ss-head">
          <div className="min-w-0"><span className="nl-ss-kicker">SHARE</span><h2 className="nl-ss-title">{title}</h2></div>
          <button type="button" className="nl-ss-x" onClick={() => setSheet(false)} aria-label="Close"><X aria-hidden="true" /></button>
        </div>

        <button type="button" className="nl-ss-hero" onClick={() => { setSheet(false); card.start(); }}>
          <span className="nl-ss-hero-ic"><ImageDown aria-hidden="true" /></span>
          <span className="nl-ss-hero-copy"><strong>Share as card</strong><small>A polished 4:5 image of this review, ready for Instagram, stories and chats.</small></span>
          <ChevronRight className="nl-ss-hero-go" aria-hidden="true" />
        </button>

        <p className="nl-ss-label">Share link via</p>
        <div className="nl-ss-grid">
          {canNative && <button type="button" onClick={() => void nativeShare()}><span><Share2 aria-hidden="true" /></span>More…</button>}
          <button type="button" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`)}><span><MessageCircle aria-hidden="true" /></span>WhatsApp</button>
          <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}><span><Facebook aria-hidden="true" /></span>Facebook</button>
          <button type="button" onClick={() => { void copyLink(); open('https://www.instagram.com/'); }}><span><Instagram aria-hidden="true" /></span>Instagram</button>
          <button type="button" onClick={() => void copyLink()}><span>{copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}</span>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="nl-sa" role="group" aria-label="Share actions">
        <button type="button" className={`nl-sa-btn${copied ? ' is-on' : ''}`} onClick={() => void copyLink()} aria-label={copied ? 'Link copied' : 'Copy link'} title="Copy link">
          {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        </button>
        <button type="button" className="nl-sa-btn" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label="Share" title="Share">
          <Share2 aria-hidden="true" />
        </button>
        <button type="button" className={`nl-sa-btn${saved ? ' is-on' : ''}`} onClick={() => toggle(review.id)} aria-pressed={saved} aria-label={saved ? 'Remove from My Reviews' : 'Save to My Reviews'} title={saved ? 'Saved' : 'Save'}>
          {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        </button>
        {blogUrl
          ? <a className="nl-sa-btn" href={blogUrl} target="_blank" rel="noopener noreferrer" onMouseEnter={onPrefetchBlog} onFocus={onPrefetchBlog} aria-label="View in Blog" title="Blog"><Newspaper aria-hidden="true" /></a>
          : <span className="nl-sa-btn is-disabled" aria-disabled="true" aria-label="Blog post not available" title="No blog post yet"><Newspaper aria-hidden="true" /></span>}
      </div>
      {sheetEl && createPortal(sheetEl, document.body)}
      {card.popup}
    </>
  );
}
