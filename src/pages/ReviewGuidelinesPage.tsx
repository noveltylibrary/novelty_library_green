import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronDown, FileText, Sparkles } from 'lucide-react';
import DOMPurify from 'dompurify';
import { fetchReviewGuidelineSections, type ReviewGuidelineSection } from '@/lib/reviewGuidelines';
import { GUIDE_CSS } from '@/components/ReviewGuidelinesModal';

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

export function ReviewGuidelinesPage({ navigate }: ReviewGuidelinesPageProps) {
  const [sections, setSections] = useState<ReviewGuidelineSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const safeSections = useMemo(() => sections.filter(s => s.active).sort((a,b) => a.sort_order - b.sort_order), [sections]);

  return <div className="pt-20 sm:pt-24 pb-20 px-3 sm:px-5 animate-fade-in">
    <style dangerouslySetInnerHTML={{ __html: GUIDE_CSS }} />
    <div className="max-w-6xl mx-auto">
      <button type="button" onClick={() => navigate('/submit')} className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Back to Submit Reviews</button>
      <div className="novelty-guide-outer-wrapper">
        <div className="novelty-guide-wrapper">
          <section className="novelty-hero">
            <div className="flex items-center gap-2 mb-4 text-cyan-100/75 text-xs uppercase tracking-[.18em] font-bold"><BookOpen className="w-4 h-4" /> Novelty Library · Reader guide</div>
            <h2>“Got a book that broke your brain?”</h2>
            <p>Everything you need to know before submitting a Novelty Library book review — rebuilt as a native web-app reading page.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="novelty-btn" onClick={() => navigate('/submit')}><Sparkles className="w-4 h-4" /> Submit Your Review</button>
              <a className="novelty-btn novelty-btn-sm" href="#guide-sections"><FileText className="w-4 h-4" /> Browse the guide</a>
            </div>
          </section>

          {error && <div className="mb-4 rounded-2xl px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.16)', color: '#b91c1c' }}>The saved guide could not be loaded, so the built-in guide is being shown.</div>}

          <div className="novelty-guide-toolbar" id="guide-sections">
            <div className="guide-kicker"><ChevronDown className="w-4 h-4" /> {loading ? 'Loading sections…' : `${safeSections.length} guide sections`}</div>
            <select aria-label="Jump to guideline section" className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--color-paper)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} defaultValue="" onChange={(e) => { if (e.target.value) document.getElementById(`guide-section-${e.target.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <option value="">Jump to a section…</option>
              {safeSections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </div>

          {safeSections.map((section, index) => <details className="novelty-section" key={section.id} id={`guide-section-${section.id}`} open={index === 0}>
            <summary><span style={{ display:'flex', alignItems:'center', gap:10 }}><span>{section.title}</span></span><svg className="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary>
            <div className="novelty-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content_html, { ADD_ATTR: ['target', 'rel'], FORBID_TAGS: ['script','iframe','object','embed'] }) }} />
          </details>)}
        </div>
      </div>
    </div>
  </div>;
}
