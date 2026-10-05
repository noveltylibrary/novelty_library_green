import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronDown, X, ZoomIn } from 'lucide-react';
import DOMPurify from 'dompurify';
import { fetchReviewGuidelineSections, type ReviewGuidelineSection } from '@/lib/reviewGuidelines';
import { GUIDE_CSS } from '@/components/ReviewGuidelinesModal';
import AdsterraAdSlot from '@/components/AdsterraAdSlot';
import { RatingGuideCard, RATING_GUIDE_CSS } from '@/components/RatingGuideCard';

interface ReviewGuidelinesPageProps {
  navigate: (path: string) => void;
}

const FALLBACK_SECTIONS: ReviewGuidelineSection[] = [
  { id: 'fallback-introduction', slug: 'introduction', title: 'INTRODUCTION: The Novelty Library Vision', sort_order: 10, active: true, content_html: `<p>Are you also tired of typing <em>'Books to read,' 'Bookstores near me,'</em> or <em>'Best book recommendations'</em> on Google? Well, search no more elsewhere, because Novelty Library is all set to bring to your convenience a plethora of Book Reviews, Top Book Recommendations, Must-Read Books, and Literary Reviews, ushering an arena of books to read for every genre lover. Whether you're looking for fiction, non-fiction, mystery, romance, thrillers, or classics, Novelty Library has it all. Visit the website for insightful book critiques, author spotlights, and reading guides.</p><p>Novelty Library Reviews is built specifically so that honest reviewers and indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. Novelty greatly admires extending reviewers a hand and letting them be part of Novelty's little hopeful journey!</p><p>Novelty has outgrown itself with its new <strong>V4.0 Submit Book Reviews form</strong> that includes an instant downloadable IG Poster for reviewers, light-tone matching, and amongst all, the Quick-Search and Fill Update for fast-paced reviewers! Novelty wants to achieve higher limits by helping more and more authors and reviewers find their voice in a publicity-driven society.</p><p><strong>SUBMIT YOUR BOOK REVIEW HERE:</strong><br><a class="novelty-btn novelty-btn-sm" href="/submit">Open the Novelty review form</a></p>` },
  { id: 'fallback-core-rules', slug: 'core-rules', title: 'AT A GLANCE INFO & CORE RULES', sort_order: 20, active: true, content_html: `<ul class="novelty-list"><li>Review submissions are <strong>completely free of charge</strong>.</li><li>Nominations must include well-written samples that follow the submission guidelines and the Novelty Review Writing Format.</li><li>Reviewers must be <strong>18 years or older</strong> to fill out the form.</li><li>Reviewers can take as much time as they want and submit any number of reviews with no limits or bounds, and can quit whenever they want.</li><li><strong>Once a review is published, it cannot be taken down</strong> in order to preserve Novelty's review counter.</li><li>Novelty only publishes a review for a specific book once on their channel, and any repetitive nominations will be discarded after notifying the reviewer.</li><li>Published reviews are available primarily on the Novelty Reviews Blog and the Instagram Handle.</li><li>Accepted book reviews should not be disclosed due to reviewer privacy; it is best to contact a Novelty Volunteer beforehand on social handles to verify submission validity.</li><li>Reviewers have advanced features like the <strong>Quick Auto Search and Fill</strong>, <strong>Save and Load Draft Functions</strong>, <strong>Edit Review Button</strong>, and <strong>instant downloadable IG Story-poster functions</strong>.</li><li>Reviewers can obtain an <strong>ARS Referral Code</strong> from a Novelty Consultant after 10 successful reviews, subject to Novelty board approval.</li></ul>` },
  { id: 'fallback-form-guide', slug: 'form-guide', title: 'THE FORM GUIDE (Step-by-Step Breakdown)', sort_order: 30, active: true, content_html: `<h4 style="color: var(--novelty-teal-main); border-bottom: 1px solid var(--novelty-border); padding-bottom: 5px;">Section 1 of 2 - Book Review &amp; Details</h4><ul class="novelty-list"><li><strong>Your Identity &amp; Contact:</strong> Provide your full name, a valid email, and your primary contact method (choose between your Instagram handle or Website as mandatory). <em>Reviewers must be 18 years or older.</em></li><li><strong>Book Details:</strong> Enter the exact Book Title, Author Name, and select your Genre. Include the Series Name and Book Number if applicable.</li><li><strong>Language Specifications:</strong> Specify the original writing language of the book, along with the translated language if it is a translated edition.</li><li><strong>Book Cover Image:</strong> Upload a high-quality picture of the book that distinctly covers all edges (background-removed preferred).</li><li><strong>Ratings Breakdown:</strong><ul style="list-style-type: circle; margin-top: 5px;"><li><span class="novelty-highlight">Reviewer's Rating:</span> Scored out of 10 (up to one decimal place).</li><li><strong>Goodreads Rating:</strong> Scored out of 5.</li><li><strong>Amazon Rating:</strong> Optional, scored out of 5.</li></ul></li><li><strong>Traits / Keywords:</strong> Add descriptive traits or keywords for the genre.</li><li><strong>Your Review:</strong> Write a concise review in ENGLISH. Include critical takes if any. Please do not resort to vulgar languages or demeaning any identity in your submissions.</li><li><strong>Optional Meta:</strong> Include your Amazon book purchase link and the date of review if desired.</li><li><span class="novelty-highlight">AUTO-SEARCH and FILL:</span> Search by book/author to auto-fill available book details and cover.</li></ul><h4 style="color: var(--novelty-teal-main); border-bottom: 1px solid var(--novelty-border); padding-bottom: 5px; margin-top: 25px;">Section 2 of 2 - Acknowledgement &amp; Submission Terms</h4><ul class="novelty-list"><li><strong>Discovery Source:</strong> Let us know how you heard about Novelty Reviews.</li><li><strong>Important Undertaking:</strong> By submitting, you promise not to impersonate any other identity or share details without consent.</li><li><strong>Novelty Library Form Score:</strong> We ask all reviewers to rate our form page and reviewer accessibility out of 10.</li><li><strong>Suggestions:</strong> Help us improve the submission form by suggesting changes.</li></ul><p style="background: var(--novelty-subcard-bg); padding: 12px; border-radius: 6px; margin-top: 15px; font-size: 0.95rem; border: 1px solid var(--novelty-border);"><em>Note: The R/W Ratings provided here are limited to the specific reviewer's opinion and do not reflect an accumulative briefing of the book.</em></p>` },
  { id: 'fallback-features', slug: 'features', title: 'ADDITIONALS & V4.0 FEATURES', sort_order: 40, active: true, content_html: `<div class="novelty-grid"><div class="novelty-card"><h4>IG Story-Poster Download</h4><p>An instantly curated 9:16 Instagram story-poster is available to download after a successful submission.</p></div><div class="novelty-card"><h4>Light/Dark Mode</h4><p>Novelty pages of Book Review Submissions, Analytics, and Contact Info are eye-friendly with light/dark toggles.</p></div><div class="novelty-card"><h4>Load/Save Draft</h4><p>Reviewers can save and load drafts to continue old review work efficiently.</p></div><div class="novelty-card"><h4>Edit Draft</h4><p>Reviewers can edit a submitted draft for the available editing window after submission.</p></div></div>` },
  { id: 'fallback-availability', slug: 'availability', title: 'REVIEW AVAILABILITY & PUBLISHING QUEUE', sort_order: 50, active: true, content_html: `<p>Once a review is submitted, a Novelty administrator will check and let know if the review is received or not. The Novelty team will check the format and picture and let know if any edits are required. The final draft will be added to the queue of reviews. <strong>A reviewer can expect up to a month before the review comes out.</strong></p><p>This is primarily due to the fact that Novelty respects every Reviewer's Review irrespective of differentiations or advantages one book review might have on another. Novelty tries to share each review on the Instagram page after every 2-3 days allowing every review to gain substantial social media coverage as much as is within the respective platform's power to allow.</p><p><strong>Reviews shall be available on:</strong></p><div style="margin: 10px 0;"><a href="https://noveltylibrary.blogspot.com" target="_blank" rel="noreferrer" class="novelty-btn novelty-btn-sm">Novelty Reviews Blog</a><a href="https://www.instagram.com/novelty.lib" target="_blank" rel="noreferrer" class="novelty-btn novelty-btn-sm">Instagram Handle</a></div><p style="margin-top: 15px; font-weight: bold; color: #ef4444;">Please note: Since we assign review numbers accordingly for each of our posted reviews, any review posted shall not be taken down in the future.</p>` },
  { id: 'fallback-contact', slug: 'contact', title: 'CONTACT & NEWSLETTER', sort_order: 60, active: true, content_html: `<p><strong>How can you contact us?</strong></p><p>You can connect with us via our official channels below.</p><div style="margin: 15px 0; display: flex; flex-wrap: wrap; gap: 8px;"><a href="https://noveltylibrary.blogspot.com/p/contact-us.html" target="_blank" rel="noreferrer" class="novelty-btn novelty-btn-sm">Contacts Page</a><a href="https://www.instagram.com/novelty.co.in" target="_blank" rel="noreferrer" class="novelty-btn novelty-btn-sm">Instagram</a><a href="https://www.linktr.ee/novelty.lib" target="_blank" rel="noreferrer" class="novelty-btn novelty-btn-sm">Linktree Hub</a></div><div style="background: var(--novelty-subcard-bg); padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px; border: 1px solid var(--novelty-border);"><p style="margin: 0;"><strong>SUBSCRIBE</strong> to the <strong>Novelty Library Newsletter</strong> via the Contacts Page.</p></div>` },
];

const ASSET = (name: string) => `${import.meta.env.BASE_URL}guide/${name}.webp`;

interface GuideImage { file: string; alt: string; caption: string }

// Poster images shown at the end of the matching guide section (matched on slug + title,
// so they still land correctly when an admin renames or re-orders sections).
const SECTION_IMAGES: { match: RegExp; images: GuideImage[] }[] = [
  { match: /introduction|vision/i, images: [
    { file: 'guide-v4-update', alt: 'V4.0 new update: Smart Auto-Fill replaces the V3.0 Smart Form, with Search & Auto-fill, Light/Dark Mode and IG Story Poster', caption: 'V3.0 to V4.0: Smart Auto-Fill' },
  ] },
  { match: /form[\s-]*guide|step[\s-]*by[\s-]*step/i, images: [
    { file: 'guide-picture-guide', alt: 'Picture Addition Guide: upload a clear cover picture, background-removed preferred, and use Quick Search & Add', caption: 'Picture Addition Guide' },
    { file: 'guide-autofill', alt: 'V4.0 Smart Auto-Fill: type a title and genre, cover and Goodreads rating are filled in one click, with Already Added detection', caption: 'Smart Auto-Fill in action' },
  ] },
  { match: /additionals|features/i, images: [
    { file: 'guide-minor-update', alt: 'V4.0 minor update: Preview Mode before final posting and Smart Lock that locks the form on Submit', caption: 'V4.0 minor update: Preview Mode & Smart Lock' },
  ] },
];

const PAGE_CSS = `
  .ng-header { margin: 0 0 22px; display: flex; justify-content: center; }
  .ng-header-frame { position: relative; width: 100%; border-radius: 26px; overflow: hidden; box-shadow: 0 26px 60px rgba(2,6,23,.26); border: 1px solid rgba(103,232,249,.28); background: #04141c; line-height: 0; }
  .ng-header-frame img { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 840; }
  /* Transparent link sitting exactly on the "SUBMIT NOW" pill baked into the header image */
  .ng-submit-cta { position: absolute; left: 64.63%; top: 72.86%; width: 24.25%; height: 9.52%; border-radius: 999px; overflow: hidden; display: block; cursor: pointer; text-decoration: none; -webkit-tap-highlight-color: transparent; animation: ng-cta-pulse 2.2s ease-out infinite; transition: transform .2s ease, filter .2s ease; }
  .ng-submit-cta::after { content: ""; position: absolute; top: 0; bottom: 0; left: -60%; width: 45%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.65), transparent); transform: skewX(-18deg); animation: ng-cta-shine 3s ease-in-out infinite; }
  .ng-submit-cta:hover, .ng-submit-cta:focus-visible { transform: scale(1.06); filter: brightness(1.12); animation-play-state: paused; outline: none; }
  .ng-submit-cta:focus-visible { box-shadow: 0 0 0 3px #fff, 0 0 0 6px #0e7490; }
  .ng-submit-cta:active { transform: scale(.97); }
  @keyframes ng-cta-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,211,238,.65), 0 0 14px rgba(34,211,238,.35); } 70% { box-shadow: 0 0 0 16px rgba(34,211,238,0), 0 0 22px rgba(34,211,238,.45); } 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0), 0 0 14px rgba(34,211,238,.35); } }
  @keyframes ng-cta-shine { 0%, 55% { left: -60%; } 100% { left: 130%; } }
  @media (prefers-reduced-motion: reduce) { .ng-submit-cta, .ng-submit-cta::after { animation: none !important; } .ng-submit-cta { transition: none; } }
  .ng-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .ng-figures { padding: 0 22px 22px; background: rgba(255,255,255,.66); display: grid; grid-template-columns: 1fr; gap: 14px; justify-items: stretch; }
  .dark .novelty-guide-outer-wrapper .ng-figures { background: rgba(3,20,27,.44); }
  .ng-figure { margin: 0; width: 100%; }
  .ng-figure .novelty-img-container { margin: 0; }
  .ng-zoom { position: relative; display: block; width: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; line-height: 0; }
  .ng-zoom img { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 840; background: rgba(8,145,178,.08); }
  .ng-zoom-badge { position: absolute; right: 10px; top: 10px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: rgba(2,20,26,.7); color: #cffafe; opacity: .85; }
  .ng-figure figcaption { margin-top: 8px; text-align: center; font-size: .74rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--novelty-teal-dark); opacity: .8; line-height: 1.4; }

  /* ---------- Dynamic poster layer ---------- */
  .ng-tilt { perspective: 1100px; }
  .ng-tilt-in { position: relative; transform: rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)); transition: transform .35s cubic-bezier(.2,.8,.2,1); will-change: transform; transform-style: preserve-3d; }
  .ng-tilt.is-hot .ng-tilt-in { transition: transform .08s linear; }
  .ng-glare { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s; background: radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.28), transparent 45%); mix-blend-mode: soft-light; border-radius: inherit; }
  .ng-tilt.is-hot .ng-glare { opacity: 1; }

  .ng-header-frame { animation: ng-float 7s ease-in-out infinite; }
  @keyframes ng-float { 50% { transform: translateY(-4px); } }
  .ng-header-frame::before { content: ""; position: absolute; inset: -30%; z-index: 1; pointer-events: none; mix-blend-mode: screen; opacity: .55; background: radial-gradient(40% 35% at 20% 30%, rgba(34,211,238,.45), transparent 70%), radial-gradient(35% 30% at 80% 70%, rgba(94,234,212,.4), transparent 70%); animation: ng-aurora 11s ease-in-out infinite alternate; }
  @keyframes ng-aurora { from { transform: translate3d(-4%,-2%,0) rotate(0deg); } to { transform: translate3d(5%,3%,0) rotate(12deg); } }
  .ng-sheen { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
  .ng-sheen::after { content: ""; position: absolute; top: -20%; bottom: -20%; left: -40%; width: 22%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent); transform: skewX(-18deg); animation: ng-sweep 7s ease-in-out infinite; }
  @keyframes ng-sweep { 0%, 60% { left: -40%; } 100% { left: 140%; } }
  .ng-sparkles { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
  .ng-sparkles span { position: absolute; left: var(--x); top: var(--y); width: var(--z); height: var(--z); border-radius: 50%; background: #cffafe; box-shadow: 0 0 10px 2px rgba(103,232,249,.8); opacity: 0; animation: ng-twinkle var(--d) ease-in-out infinite; animation-delay: var(--dl); }
  @keyframes ng-twinkle { 0%, 100% { opacity: 0; transform: translateY(6px) scale(.4); } 50% { opacity: .9; transform: translateY(-10px) scale(1); } }

  .ng-reveal { opacity: 0; transform: translateY(26px) scale(.97); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1); transition-delay: var(--rd,0ms); }
  .ng-reveal[data-in="1"] { opacity: 1; transform: none; }

  .ng-glow { position: relative; padding: 2px; border-radius: 22px; overflow: hidden; background: rgba(8,145,178,.18); }
  .ng-glow::before { content: ""; position: absolute; inset: -80%; background: conic-gradient(from 0deg, transparent 0 62%, #22d3ee 78%, #5eead4 88%, transparent 100%); animation: ng-spin 7s linear infinite; }
  @keyframes ng-spin { to { transform: rotate(360deg); } }
  .ng-glow .novelty-img-container { position: relative; z-index: 1; margin: 0; border: 0; background: var(--novelty-card-bg); border-radius: 20px; }
  .ng-zoom { overflow: hidden; border-radius: 14px; }
  .ng-zoom img { transition: transform .6s cubic-bezier(.2,.8,.2,1); }
  .ng-zoom:hover img { transform: scale(1.035); }
  .ng-zoom::after { content: ""; position: absolute; top: 0; bottom: 0; left: -50%; width: 30%; pointer-events: none; background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent); transform: skewX(-18deg); transition: left 0s; }
  .ng-zoom:hover::after { left: 130%; transition: left .9s ease; }
  .ng-figure figcaption { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .ng-figure figcaption::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 0 0 rgba(34,211,238,.7); animation: ng-ping 2s ease-out infinite; }
  @keyframes ng-ping { 70% { box-shadow: 0 0 0 9px rgba(34,211,238,0); } 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); } }
  .novelty-section[open] .novelty-content { animation: ng-open .45s cubic-bezier(.2,.8,.2,1); }
  @keyframes ng-open { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

  /* Ad strip inside each dropdown: collapses to one slim line when there is no ad */
  .ng-ad { display: flex; justify-content: center; padding: 6px 22px 14px; background: rgba(255,255,255,.66); }
  .dark .novelty-guide-outer-wrapper .ng-ad { background: rgba(3,20,27,.44); }
  .ng-ad .adsterra-slot { margin: 0 auto; }

  @media (prefers-reduced-motion: reduce) {
    .ng-header-frame, .ng-header-frame::before, .ng-sheen::after, .ng-sparkles span, .ng-glow::before, .ng-figure figcaption::before, .novelty-section[open] .novelty-content { animation: none !important; }
    .ng-reveal { opacity: 1; transform: none; transition: none; }
    .ng-tilt-in { transform: none !important; }
  }
  @media (hover: none) { .ng-tilt-in { transform: none !important; } }

  .ng-lightbox { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 16px; background: rgba(2,10,14,.88); backdrop-filter: blur(6px); animation: fadeIn .2s ease-out; }
  .ng-lightbox img { max-width: 96vw; max-height: 92vh; width: auto; height: auto; border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
  .ng-lightbox button { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: rgba(255,255,255,.14); color: #fff; border: 0; cursor: pointer; }
`;

function sectionImages(section: ReviewGuidelineSection): GuideImage[] {
  const hay = `${section.slug} ${section.title}`;
  // First matching rule wins (form guide is checked before the generic "features" rule).
  const rule = SECTION_IMAGES.find(r => r.match.test(hay));
  return rule ? rule.images : [];
}


const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  x: `${(i * 37 + 7) % 96}%`, y: `${(i * 53 + 11) % 90}%`, z: `${3 + (i % 3) * 2}px`,
  d: `${3.2 + (i % 5) * 0.8}s`, dl: `${(i % 7) * 0.45}s`,
}));

/** Pointer-driven 3D tilt + glare. Mouse only; touch and reduced-motion users get the static poster. */
function Tilt({ children, max = 5, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 2 * max}deg`);
    el.style.setProperty('--rx', `${-(py - 0.5) * 2 * max}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.classList.add('is-hot');
  };
  const leave = () => {
    const el = ref.current; if (!el) return;
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    el.classList.remove('is-hot');
  };
  return <div ref={ref} className={`ng-tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>
    <div className="ng-tilt-in">{children}<span className="ng-glare" aria-hidden="true" /></div>
  </div>;
}

/** Fades/slides content in the first time it scrolls into view. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`ng-reveal ${className}`} data-in={shown ? '1' : '0'} style={{ ['--rd' as string]: `${delay}ms` }}>{children}</div>;
}

function GuideSection({ section, index, navigate, showRating, onZoom }: { section: ReviewGuidelineSection; index: number; navigate: (path: string) => void; showRating: boolean; onZoom: (img: GuideImage) => void }) {
  // The ad is only requested once the dropdown has been opened, and lives inside it.
  const [everOpen, setEverOpen] = useState(index === 0);
  const [open, setOpen] = useState(index === 0);
  const imgs = sectionImages(section);
  return <details className="novelty-section" id={`guide-section-${section.id}`} open={index === 0} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen(o); if (o) setEverOpen(true); }}>
    <summary><span style={{ display:'flex', alignItems:'center', gap:10 }}><span>{section.title}</span></span><svg className="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary>
    <div className="novelty-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content_html, { ADD_ATTR: ['target', 'rel'], FORBID_TAGS: ['script','iframe','object','embed'] }) }} />
    {index === 0 && <div className="novelty-content" style={{ paddingTop: 0 }}><div className="rounded-3xl p-5" style={{background:'linear-gradient(135deg,rgba(8,145,178,.12),rgba(34,211,238,.06))',border:'1px solid rgba(8,145,178,.24)'}}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0"><p className="text-xs uppercase tracking-[.18em] font-bold" style={{color:'var(--color-teal-dark)'}}>Ready when you are</p><h3 className="font-serif text-2xl font-semibold mt-1">Reserve a book or submit your review</h3><p className="text-sm mt-1" style={{color:'var(--color-text-muted)'}}>Reservations are requests only until an admin accepts them. Reviews are checked by Novelty Library before acceptance and publication.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn-ghost !w-auto" onClick={()=>navigate('/submit#reserve')}>Reserve a Book</button><button type="button" className="btn-primary !w-auto" onClick={()=>navigate('/submit')}>Submit Review</button></div>
      </div>
    </div></div>}
    {showRating && <div className="novelty-content" style={{ paddingTop: 0 }}><Reveal><RatingGuideCard /></Reveal></div>}
    {imgs.length > 0 && <div className={`ng-figures${imgs.length > 1 ? ' ng-multi' : ''}`}>
      {imgs.map((img, i) => <Reveal key={img.file} delay={i * 120} className="ng-figure-wrap"><figure className="ng-figure">
        <Tilt max={4}><div className="ng-glow"><div className="novelty-img-container"><button type="button" className="ng-zoom" onClick={() => onZoom(img)} aria-label={`Enlarge image: ${img.caption}`}><img src={ASSET(img.file)} width={1600} height={840} alt={img.alt} loading="lazy" decoding="async" /><span className="ng-zoom-badge" aria-hidden="true"><ZoomIn className="w-4 h-4" /></span></button></div></div></Tilt>
        <figcaption>{img.caption}</figcaption>
      </figure></Reveal>)}
    </div>}
    {everOpen && <div className="ng-ad"><AdsterraAdSlot active={open} /></div>}
  </details>;
}

export function ReviewGuidelinesPage({ navigate }: ReviewGuidelinesPageProps) {
  const [sections, setSections] = useState<ReviewGuidelineSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<GuideImage | null>(null);

  useEffect(() => {
    let active = true;
    fetchReviewGuidelineSections().then((rows) => {
      if (!active) return;
      setSections(rows.length ? rows : FALLBACK_SECTIONS);
    }).catch((e) => {
      if (!active) return;
      setSections(FALLBACK_SECTIONS);
      setError(e instanceof Error ? e.message : 'Using the built-in review guide.');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const safeSections = useMemo(() => sections.filter(s => s.active).sort((a,b) => a.sort_order - b.sort_order), [sections]);

  // Show the R/W star explainer once, in the form-guide (Ratings Breakdown) section.
  const ratingIndex = useMemo(() => {
    const hay = (x: ReviewGuidelineSection) => `${x.slug} ${x.title}`;
    const i = safeSections.findIndex(x => /form[\s-]*guide|step[\s-]*by[\s-]*step|rating/i.test(hay(x)));
    return i >= 0 ? i : safeSections.findIndex(x => /core[\s-]*rules|at a glance/i.test(hay(x)));
  }, [safeSections]);

  return <div className="pt-20 sm:pt-24 pb-20 px-3 sm:px-5 animate-fade-in">
    <style dangerouslySetInnerHTML={{ __html: GUIDE_CSS + PAGE_CSS + RATING_GUIDE_CSS }} />
    <div className="max-w-6xl mx-auto">
      <button type="button" onClick={() => navigate('/submit')} className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Back to Submit Reviews</button>
      <div className="novelty-guide-outer-wrapper">
        <div className="novelty-guide-wrapper">
          <header className="ng-header">
            <Tilt max={3} className="w-full">
              <div className="ng-header-frame">
                <img src={ASSET('guide-header')} width={1600} height={840} alt="Novelty Library review guidelines: free, unlimited, no deadline" fetchPriority="high" decoding="async" />
                <span className="ng-sheen" aria-hidden="true" />
                <span className="ng-sparkles" aria-hidden="true">{SPARKLES.map((p, i) => <span key={i} style={{ ['--x' as string]: p.x, ['--y' as string]: p.y, ['--z' as string]: p.z, ['--d' as string]: p.d, ['--dl' as string]: p.dl }} />)}</span>
                <a className="ng-submit-cta" href="#/submit" aria-label="Submit now: open the Submit Reviews page" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigate('/submit'); }}><span className="ng-sr-only">Submit now</span></a>
              </div>
            </Tilt>
          </header>

          {error && <div className="mb-4 rounded-2xl px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.16)', color: '#b91c1c' }}>The saved guide could not be loaded, so the built-in guide is being shown.</div>}

          <div className="novelty-guide-toolbar" id="guide-sections">
            <div className="guide-kicker"><ChevronDown className="w-4 h-4" /> {loading ? 'Loading sections…' : `${safeSections.length} guide sections`}</div>
            <select aria-label="Jump to guideline section" className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--color-paper)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} defaultValue="" onChange={(e) => { if (e.target.value) document.getElementById(`guide-section-${e.target.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <option value="">Jump to a section…</option>
              {safeSections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </div>

          {safeSections.map((section, index) => <GuideSection key={section.id} section={section} index={index} navigate={navigate} showRating={index === ratingIndex} onZoom={setZoom} />)}
        </div>
      </div>
    </div>
    {zoom && <div className="ng-lightbox" role="dialog" aria-modal="true" aria-label={zoom.caption} onClick={() => setZoom(null)}>
      <img src={ASSET(zoom.file)} alt={zoom.alt} onClick={(e) => e.stopPropagation()} />
      <button type="button" aria-label="Close enlarged image" onClick={() => setZoom(null)}><X className="w-5 h-5" /></button>
    </div>}
  </div>;
}
