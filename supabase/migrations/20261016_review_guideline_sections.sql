-- Novelty Library: structured, editable Review Guidelines sections.
-- Public readers can view active sections; admins can add/rename/edit/reorder them.

begin;

create table if not exists public.review_guideline_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_html text not null default '',
  sort_order integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_guideline_sections_sort_idx on public.review_guideline_sections(sort_order);

alter table public.review_guideline_sections enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_guideline_sections' and policyname='review_guideline_sections_public_select') then
    create policy review_guideline_sections_public_select on public.review_guideline_sections for select to anon, authenticated using (active = true or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_guideline_sections' and policyname='review_guideline_sections_admin_insert') then
    create policy review_guideline_sections_admin_insert on public.review_guideline_sections for insert to authenticated with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_guideline_sections' and policyname='review_guideline_sections_admin_update') then
    create policy review_guideline_sections_admin_update on public.review_guideline_sections for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_guideline_sections' and policyname='review_guideline_sections_admin_delete') then
    create policy review_guideline_sections_admin_delete on public.review_guideline_sections for delete to authenticated using (public.is_admin());
  end if;
end $$;

insert into public.review_guideline_sections (slug, title, content_html, sort_order, active)
values ('introduction-the-novelty-library-vision', 'INTRODUCTION: The Novelty Library Vision', $rg10$<p>Are you also tired of typing <em>'Books to read,' 'Bookstores near me,'</em> or <em>'Best book recommendations'</em> on Google? Well, search no more elsewhere, because Novelty Library is all set to bring to your convenience a plethora of Book Reviews, Top Book Recommendations, Must-Read Books, and Literary Reviews, ushering an arena of books to read for every genre lover. Whether you're looking for fiction, non-fiction, mystery, romance, thrillers, or classics, Novelty Library has it all. Visit the website for insightful book critiques, author spotlights, and reading guides.</p>
      
      <p>Novelty Library Reviews is built specifically so that honest reviewers and indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. Novelty greatly admires extending reviewers a hand and letting them be part of Novelty's little hopeful journey!</p>
      
      <p>Novelty has outgrown itself with its new <strong>V4.0 Submit Book Reviews form</strong> that includes an instant downloadable IG Poster for reviewers, light-tone matching, and amongst all, the Quick-Search and Fill Update for fast-paced reviewers! Novelty wants to achieve higher limits by helping more and more authors and reviewers find their voice in a publicity-driven society.</p>
      
      <p style="margin-top: 15px;">
        <strong>SUBMIT YOUR BOOK REVIEW HERE:</strong><br>
        <a href="/submit" target="_blank" class="novelty-btn novelty-btn-sm" style="margin-top: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          Open Review Form
        </a>
      </p>$rg10$, 10, true)
on conflict (slug) do nothing;

insert into public.review_guideline_sections (slug, title, content_html, sort_order, active)
values ('at-a-glance-info-core-rules', 'AT A GLANCE INFO & CORE RULES', $rg20$<ul class="novelty-list">
        <li>Review submissions are <strong>completely free of charge</strong>.</li>
        <li>Nominations must include well-written samples that follow the submission guidelines and the Novelty Review Writing Format.</li>
        <li>Reviewers must be <strong>18 years or older</strong> to fill out the form.</li>
        <li>Reviewers can take as much time as they want and submit any number of reviews with no limits or bounds, and can quit whenever they want.</li>
        <li><strong>Once a review is published, it cannot be taken down</strong> in order to preserve Novelty's review counter.</li>
        <li>Novelty only publishes a review for a specific book once on their channel, and any repetitive nominations will be discarded after notifying the reviewer.</li>
        <li>
          Published reviews are available primarily on the 
          <a href="https://noveltylibrary.blogspot.com" target="_blank" class="novelty-btn novelty-btn-sm">Novelty Reviews Blog</a> and the 
          <a href="http://www.instagram.com/novelty.lib" target="_blank" class="novelty-btn novelty-btn-sm">Instagram Handle</a>.
        </li>
        <li>Accepted book reviews should not be disclosed due to reviewer privacy; it is best to contact a Novelty Volunteer beforehand on social handles to verify submission validity.</li>
        <li>Reviewers have advanced features like the <strong>Quick Auto Search and Fill</strong>, <strong>Save and Load Draft Functions</strong>, <strong>Edit Review Button</strong> (accessible up to 5 minutes since first submission of a draft), and the <strong>instant downloadable IG Story-poster functions</strong> at their immediate disposal in the Novelty Library V4.0 form, making submissions fast, modern, frictionless, and entertaining!</li>
        <li>Reviewers can obtain an <strong>ARS Referral Code (Assisted Referral Sustainability Code)</strong> from a Novelty Consultant via a direct message on social media (preferably Instagram) after 10 successful reviews, subject to Novelty board approval.</li>
      </ul>$rg20$, 20, true)
on conflict (slug) do nothing;

insert into public.review_guideline_sections (slug, title, content_html, sort_order, active)
values ('the-form-guide-step-by-step-breakdown', 'THE FORM GUIDE (Step-by-Step Breakdown)', $rg30$<h4 style="color: var(--novelty-teal-main); border-bottom: 1px solid var(--novelty-border); padding-bottom: 5px;">Section 1 of 2 - Book Review & Details</h4>
      
      <ul class="novelty-list">
        <li><strong>Your Identity & Contact:</strong> Provide your full name, a valid email, and your primary contact method (choose between your Instagram handle or Website as mandatory). <em>Reviewers must be 18 years or older.</em></li>
        <li><strong>Book Details:</strong> Enter the exact Book Title, Author Name, and select your Genre (max 3 words, if chosen as 'other'). Include the Series Name and Book Number if applicable.</li>
        <li><strong>Language Specifications:</strong> Specify the original writing language of the book, along with the translated language if it is a translated edition.</li>
        <li>
          <strong>Book Cover Image:</strong> Upload a high-quality picture of the book that distinctly covers all edges (background-removed preferred). Web-search images, or phone captures, either works! Novelty proudly prefers and acknowledges authentic book cover images from readers.
          <p style="margin-top: 8px; font-style: italic; font-size: 0.95rem;">Our team will add your given picture in our poster and make it fashionable through Graphic Designing. Below is a poster example showing how your review image shall look once you’ve submitted a nomination. The stars at the bottom indicate the reviewer rating on a 5-point scale, and the number indicates the Review number.</p>
          
          <div class="novelty-img-container">
            <a href="https://noveltylibrary.blogspot.com/2024/08/pride-and-prejudice.html" target="_blank">
              <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgIYh1fg3seft0IRlrfDA1lM3kzyBKgEeMB8LBWr2UpYu0SOQy6qGbZR7zSp4Lvkch9dSMYeTBZ1er09s2IKQctFYbcIDfwl-IItNzfA_e5f_HFM-XMrQ_KRnaK1cYRDfpOOW4OUaUy8vF-7VqiXyRguuODL__kw-8gIA0poDKNH250fiOWMwSdQ77vQjw/s16000/23.jpg" alt="Poster Example" style="max-height: 400px;" />
            </a>
          </div>
        </li>
        <li>
          <strong>Ratings Breakdown:</strong>
          <ul style="list-style-type: circle; margin-top: 5px;">
            <li><span class="novelty-highlight">Reviewer's Rating:</span> Scored out of 10 (up to one decimal place).</li>
            <li><strong>Goodreads Rating:</strong> Scored out of 5 (As on date of publishing of post).</li>
            <li><strong>Amazon Rating:</strong> Optional, scored out of 5.</li>
          </ul>
        </li>
        <li><strong>Traits / Keywords:</strong> Add minimum 1 descriptive trait or keyword for the genre (e.g., Emotional, Plot Twist). 5 keywords are preferred that describe the true potential of the book being reviewed.</li>
        <li><strong>Your Review:</strong> Write a concise review in ENGLISH that fits the Instagram caption limit (approximately 250 words, 1800 characters, or 1500 characters max without spaces). Include critical takes if any! The form encapsulates a 100 character minimum bar, however, the upper cap is lifted to allow reviewers to fill it out with their hearts! However, to tether to Instagram caption limits, reviews on Instagram might be shortened depending upon word limit. <span style="color: #ef4444; font-weight: bold;">Please do not resort to using vulgar languages or demeaning any identity in your submissions.</span> Such act would result in Novelty not considering your nominations and in case of extensive fouling, blacklisting your ID.</li>
        <li><strong>Optional Meta:</strong> Include your Amazon book purchase link and the date of review if desired.</li>
        <li><span class="novelty-highlight" style="color: #06b6d4;">AUTO-SEARCH and FILL:</span> Our new V4.0 review form update allows users to just type in book/author name in the designated search bar which uses existing open library search to find the book and display its details, including book name, series, author, genre, language, translations, Goodreads rating, Amazon rating, and book cover. Upon clicking on your book of choice from the search outputs, you shall find all its details to auto-fill all respective form questions.</li>
      </ul>

      <h4 style="color: var(--novelty-teal-main); border-bottom: 1px solid var(--novelty-border); padding-bottom: 5px; margin-top: 25px;">Section 2 of 2 - Acknowledgement & Submission Terms</h4>
      <ul class="novelty-list">
        <li><strong>Discovery Source:</strong> Let us know how you heard about Novelty Reviews (via Google Search, Authors, Social Media, Consultants, or Fellow Reviewers).</li>
        <li><strong>Important Undertaking:</strong> By submitting, you promise not to impersonate any other identity or share details without consent, acknowledging that Novelty branches are not liable for discrepancies.</li>
        <li><strong>Novelty Library <span class="novelty-highlight">Form Score</span>:</strong> We humbly ask all reviewers to rate our form page (and overall reviewer accessibility on the site page) out of 10. We proudly share our average reviewer score on our analytics dashboard to showcase our little hand in extension towards genuine readers.</li>
        <li><strong>Suggestions:</strong> We also ask our reviewers to help us better the book review submission form by suggesting changes.</li>
      </ul>

      <p style="background: var(--novelty-subcard-bg); padding: 12px; border-radius: 6px; margin-top: 15px; font-size: 0.95rem; border: 1px solid var(--novelty-border);">
        <em>Note: The R/W Ratings provided here are limited to the specific reviewer's opinion and do not reflect an accumulative briefing of the book. The book's impression may vary from reader to reader. For an accumulative briefing, the Goodreads rating will guide an answer.</em>
      </p>$rg30$, 30, true)
on conflict (slug) do nothing;

insert into public.review_guideline_sections (slug, title, content_html, sort_order, active)
values ('additionals-v4-0-features', 'ADDITIONALS & V4.0 FEATURES', $rg40$<div class="novelty-grid">
        
        <div class="novelty-card">
          <h4>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><line x1="16.5" y1="7.5" x2="16.5.01" y2="7.5"/></svg>
            IG Story-Poster Download
          </h4>
          <p>An instantly curated 9:16 Instagram story-poster is available to download on a successful submission on our <a href="/submit" target="_blank" class="novelty-btn novelty-btn-sm" style="display:inline-block; margin-top:5px;">Review Form</a>. Includes Book Title, Author Name, Reviewer ID, and Cover.</p>
        </div>

        <div class="novelty-card">
          <h4>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            Light/Dark Mode
          </h4>
          <p>Novelty pages of Book Review Submissions, Analytics, and Contact Info are eye-friendly with light/dark toggles available.</p>
        </div>

        <div class="novelty-card">
          <h4>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Load/Save Draft
          </h4>
          <p>Reviewers can now save and load drafts in/from their browser to edit and recontinue with old review drafts, preserving time, efficiency, and hard work.</p>
        </div>

        <div class="novelty-card">
          <h4>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Draft
          </h4>
          <p>Reviewers can also edit a submitted draft for <strong>up to 5 minutes</strong> since one proper submission. Available only once post review submission.</p>
        </div>

      </div>
      
      <p style="margin-top: 15px;">
        <strong>Analytics Dashboard:</strong> Novelty Library's entire review history is available to view at the 
        <a href="https://noveltylibrary.blogspot.com/p/analytics.html" target="_blank" class="novelty-btn novelty-btn-sm">ANALYTICS Page</a>. 
        It includes total books, reviewers, authors, and review scores!
      </p>$rg40$, 40, true)
on conflict (slug) do nothing;

insert into public.review_guideline_sections (slug, title, content_html, sort_order, active)
values ('review-availability-publishing-queue', 'REVIEW AVAILABILITY & PUBLISHING QUEUE', $rg50$<p>Once a review is submitted, a Novelty administrator will check and let know if the review is received or not. The Novelty team will check the format and picture and let know if any edits are required. The final draft will be added to the queue of reviews. <strong>A reviewer can expect up to a month before the review comes out.</strong></p>
      
      <p>This is primarily due to the fact that Novelty respects every Reviewer’s Review irrespective of any differentiations or advantages one book review might have on another (say matters of popularity, worth, or prospective). Therefore, Novelty tries to share each review on the Instagram page after every 2-3 days allowing every review to gain substantial social media coverage as much as is within the respective platform's power to allow.</p>
      
      <p><strong>Reviews shall be available on:</strong></p>
      <div style="margin: 10px 0;">
        <a href="http://noveltylibrary.blogspot.com" target="_blank" class="novelty-btn novelty-btn-sm">1. Novelty Reviews Blog</a>
        <a href="http://www.instagram.com/novelty.lib" target="_blank" class="novelty-btn novelty-btn-sm">2. Instagram Handle</a>
      </div>
      
      <p style="margin-top: 15px;">Reviewers will be credited on the blog with a suitable revert link as provided in the mail. Reviewers will be sent a collaboration request on Instagram and it is up to them if they want to accept or deny.</p>
      
      <p><strong>Sample Inspiration Links:</strong></p>
      <div style="margin: 10px 0;">
        <a href="https://www.instagram.com/p/DDYn1aYSvIc/" target="_blank" class="novelty-btn novelty-btn-sm">Sample IG: The Seven Husbands of Evelyn Hugo</a>
        <a href="https://noveltylibrary.blogspot.com/2024/08/a-study-in-scarlet.html" target="_blank" class="novelty-btn novelty-btn-sm">Sample Blog: A Study in Scarlet</a>
      </div>

      <p style="margin-top: 15px; font-weight: bold; color: #ef4444;">Please note: Since we assign review numbers accordingly for each of our posted reviews, any review posted shall not be taken down in the future. Be sure to submit your reviews keeping that in mind!</p>
      
      <div style="background: var(--novelty-subcard-bg); border-left: 4px solid var(--novelty-teal-main); padding: 12px; margin-top: 15px; border-radius: 0 8px 8px 0;">
        <h4 style="margin: 0 0 5px 0; color: var(--novelty-teal-main);">Flashpoints:</h4>
        <p style="margin: 0; font-size: 0.95rem;"><strong>Review Permanence:</strong> Once published, reviews cannot be removed to maintain the counter integrity. Repetitive nominations for identical books are automatically discarded.</p>
      </div>$rg50$, 50, true)
on conflict (slug) do nothing;

insert into public.review_guideline_sections (slug, title, content_html, sort_order, active)
values ('contact-newsletter', 'CONTACT & NEWSLETTER', $rg60$<p><strong>How can you contact us?</strong></p>
      <p>You can connect with us via our official channels below:</p>
      
      <div style="margin: 15px 0; display: flex; flex-wrap: wrap; gap: 8px;">
        <a href="https://noveltylibrary.blogspot.com/p/contact-us.html" target="_blank" class="novelty-btn novelty-btn-sm">Contacts Page</a>
        <a href="http://www.instagram.com/novelty.co.in" target="_blank" class="novelty-btn novelty-btn-sm">Instagram</a>
        <a href="mailto:noveltylibrary@gmail.com" class="novelty-btn novelty-btn-sm">Email Support</a>
        <a href="http://www.linktr.ee/novelty.lib" target="_blank" class="novelty-btn novelty-btn-sm">Linktree Hub</a>
      </div>
      
      <div style="background: var(--novelty-subcard-bg); padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px; border: 1px solid var(--novelty-border);">
        <p style="margin: 0 0 15px 0; font-size: 1.1rem;">
          <strong>SUBSCRIBE</strong> to the <strong>Novelty Library Newsletter</strong> to remain updated on all Novelty Library ventures!
        </p>
        <a href="https://noveltylibrary.blogspot.com/p/contact-us.html" target="_blank" class="novelty-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Subscribe via Contacts Page
        </a>
      </div>$rg60$, 60, true)
on conflict (slug) do nothing;

-- Touch rows when edited so sort/changes are reflected immediately.
create or replace function public.touch_review_guideline_sections_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_review_guideline_sections on public.review_guideline_sections;
create trigger trg_touch_review_guideline_sections before update on public.review_guideline_sections for each row execute function public.touch_review_guideline_sections_updated_at();

commit;
