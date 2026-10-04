import { useEffect } from 'react';
import { X, FileText } from 'lucide-react';

export const GUIDE_CSS = `
  :root {
    --novelty-bg: #f5fbfc;
    --novelty-text: #102b33;
    --novelty-card-bg: rgba(255,255,255,.92);
    --novelty-border: rgba(8,145,178,.16);
    --novelty-summary-bg: linear-gradient(135deg,rgba(1,43,54,.06),rgba(34,211,238,.08));
    --novelty-summary-hover: linear-gradient(135deg,rgba(8,145,178,.12),rgba(94,234,212,.12));
    --novelty-teal-main: #0e7490;
    --novelty-teal-dark: #075985;
    --novelty-cyan-accent: #22d3ee;
    --novelty-cyan-light: #cffafe;
    --novelty-hero-bg: linear-gradient(135deg,#031b22 0%,#063f50 48%,#0e7490 100%);
    --novelty-hero-text: #ecfeff;
    --novelty-subcard-bg: linear-gradient(145deg,rgba(236,254,255,.86),rgba(255,255,255,.94));
  }

  .novelty-guide-app-shell { max-width: 1180px; margin: 0 auto; }
  .novelty-guide-html { min-height: 100%; }
  .novelty-guide-outer-wrapper {
    background: radial-gradient(circle at 0% 0%,rgba(34,211,238,.12),transparent 24%),var(--novelty-bg);
    color: var(--novelty-text);
    padding: clamp(10px,2vw,26px);
    border-radius: 30px;
    border: 1px solid var(--novelty-border);
    margin: 0 auto;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 28px 80px rgba(1,43,54,.10);
  }

  .novelty-guide-wrapper { line-height: 1.75; }

  .novelty-hero {
    position: relative; overflow: hidden;
    background: var(--novelty-hero-bg);
    color: var(--novelty-hero-text);
    padding: clamp(34px,6vw,66px) clamp(20px,5vw,54px);
    border-radius: 26px;
    text-align: left;
    margin-bottom: 22px;
    box-shadow: 0 26px 60px rgba(2,6,23,.26);
    border: 1px solid rgba(103,232,249,.28);
  }
  .novelty-hero::before { content:""; position:absolute; width:260px; height:260px; right:-70px; top:-90px; border-radius:50%; background:radial-gradient(circle,rgba(94,234,212,.38),transparent 67%); }
  .novelty-hero::after { content:"NOVELTY / SUBMISSION PLAYBOOK"; position:absolute; right:20px; bottom:18px; font-size:.63rem; letter-spacing:.2em; font-weight:800; color:rgba(207,250,254,.55); }
  .novelty-hero h2 { position:relative; z-index:1; max-width:780px; font-size:clamp(1.45rem,3vw,2.35rem); line-height:1.18; margin:0 0 14px; font-family: Georgia,serif; font-weight:700; color:#e6fffe; }
  .novelty-hero p { position:relative; z-index:1; max-width:720px; font-size:1.05rem; margin:0 0 20px; color:rgba(236,254,255,.82); }

  .novelty-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(135deg,#22d3ee,#5eead4); color:#062d36 !important; font-weight:900; padding:10px 18px; border-radius:14px; text-decoration:none !important; font-size:.92rem; transition:.22s ease; box-shadow:0 10px 24px rgba(34,211,238,.18); border:none; cursor:pointer; margin:3px 3px 3px 0; }
  .novelty-btn:hover { transform:translateY(-2px); box-shadow:0 14px 28px rgba(34,211,238,.26); filter:saturate(1.04); }
  .novelty-btn-sm { padding:7px 12px; font-size:.8rem; border-radius:11px; }

  .novelty-img-container { margin:22px 0; padding:10px; border:1px solid var(--novelty-border); border-radius:20px; background:rgba(255,255,255,.42); box-shadow:0 16px 34px rgba(1,43,54,.06); }
  .novelty-img-container img { display:block; max-width:100%; height:auto; margin:auto; border-radius:14px; border:1px solid rgba(8,145,178,.18); box-shadow:0 12px 26px rgba(1,43,54,.10); }

  h3[style] { font-family:Georgia,serif !important; letter-spacing:-.02em; }
  .novelty-section { counter-increment:guide-section; position:relative; background:var(--novelty-card-bg); border:1px solid var(--novelty-border); border-radius:20px; margin-bottom:14px; overflow:hidden; box-shadow:0 10px 26px rgba(1,43,54,.05); }
  .novelty-section summary { position:relative; background:var(--novelty-summary-bg); color:var(--novelty-teal-dark); font-weight:900; font-size:1rem; padding:16px 18px 16px 58px; cursor:pointer; outline:none; display:flex; align-items:center; justify-content:space-between; gap:12px; transition:.18s ease; list-style:none; }
  .novelty-section summary::before { content:counter(guide-section, decimal-leading-zero); position:absolute; left:18px; top:14px; display:grid; place-items:center; width:29px; height:29px; border-radius:10px; background:rgba(8,145,178,.12); color:var(--novelty-teal-dark); font-size:.7rem; letter-spacing:.08em; }
  .novelty-section summary:hover { background:var(--novelty-summary-hover); }
  .novelty-section summary::-webkit-details-marker { display:none; }
  .novelty-section summary .arrow-icon { width:18px; height:18px; flex:none; fill:var(--novelty-teal-main); transition:.22s ease; }
  .novelty-section[open] summary .arrow-icon { transform:rotate(180deg); }
  .novelty-content { padding:22px; background:rgba(255,255,255,.66); color:var(--novelty-text); }
  .novelty-content p { margin:0 0 13px; }

  .novelty-grid { display:grid; grid-template-columns:1fr; gap:13px; margin:14px 0; }
  @media(min-width:680px){ .novelty-grid { grid-template-columns:1fr 1fr; } }
  .novelty-card { background:var(--novelty-subcard-bg); border:1px solid rgba(8,145,178,.12); border-left:4px solid #0e7490; padding:16px; border-radius:16px; box-shadow:0 10px 22px rgba(1,43,54,.05); }
  .novelty-card h4 { color:var(--novelty-teal-dark); margin:0 0 8px; font-size:1rem; font-weight:900; display:flex; align-items:center; gap:8px; }
  .novelty-card h4 svg { stroke:var(--novelty-teal-main); flex-shrink:0; }
  .novelty-highlight { color:#0e7490; font-weight:900; }
  ul.novelty-list { padding-left:21px; }
  ul.novelty-list li { margin-bottom:11px; }

  .dark .novelty-guide-outer-wrapper { --novelty-bg:#07161b; --novelty-text:#ecfeff; --novelty-card-bg:rgba(10,31,38,.94); --novelty-border:rgba(103,232,249,.14); --novelty-summary-bg:linear-gradient(135deg,rgba(255,255,255,.04),rgba(34,211,238,.06)); --novelty-summary-hover:linear-gradient(135deg,rgba(34,211,238,.08),rgba(94,234,212,.08)); --novelty-teal-main:#22d3ee; --novelty-teal-dark:#67e8f9; --novelty-subcard-bg:linear-gradient(145deg,rgba(8,47,73,.72),rgba(15,23,42,.88)); }
  .dark .novelty-guide-outer-wrapper .novelty-content { background:rgba(3,20,27,.44); }
  .dark .novelty-guide-outer-wrapper .novelty-img-container { background:rgba(2,20,26,.36); }
  .dark .novelty-guide-outer-wrapper .novelty-section summary::before { background:rgba(34,211,238,.10); }

  .novelty-guide-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:0 0 16px; padding:12px 14px; border:1px solid var(--novelty-border); border-radius:18px; background:linear-gradient(135deg,rgba(8,145,178,.07),rgba(94,234,212,.10)); backdrop-filter:blur(12px); }
  .novelty-guide-toolbar .guide-kicker { display:flex; align-items:center; gap:9px; font-size:.74rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--novelty-teal-dark); }
  .novelty-guide-toolbar .guide-pill { padding:7px 10px; border-radius:999px; background:rgba(8,145,178,.10); color:var(--novelty-teal-dark); font-size:.72rem; font-weight:800; }
  .novelty-guide-hero-meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
  .novelty-guide-hero-meta span { display:inline-flex; align-items:center; gap:6px; padding:7px 10px; border-radius:999px; border:1px solid rgba(165,243,252,.18); background:rgba(255,255,255,.06); color:rgba(236,254,255,.8); font-size:.72rem; font-weight:800; }
  .novelty-guide-outer-wrapper { position:relative; }
  .novelty-guide-section-intro { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin:0 0 20px; }
  .novelty-guide-stat { padding:13px 14px; border-radius:16px; background:linear-gradient(145deg,rgba(255,255,255,.8),rgba(236,254,255,.65)); border:1px solid var(--novelty-border); }
  .novelty-guide-stat strong { display:block; font:700 1.35rem Georgia,serif; color:var(--novelty-teal-dark); }
  .novelty-guide-stat span { display:block; margin-top:3px; font-size:.72rem; font-weight:800; letter-spacing:.04em; color:var(--novelty-text); opacity:.7; }
  .novelty-content a:not(.novelty-btn) { color:var(--novelty-teal-dark); font-weight:800; text-decoration:underline; text-underline-offset:3px; }
  .novelty-content strong { font-weight:900; }
  .novelty-section[open] { box-shadow:0 18px 38px rgba(1,43,54,.09); }
  @media(max-width:680px){ .novelty-guide-section-intro { grid-template-columns:1fr; } .novelty-hero::after { display:none; } }
  .dark .novelty-guide-stat { background:linear-gradient(145deg,rgba(8,47,73,.7),rgba(15,23,42,.86)); }

`

const GUIDE_HTML = `<div class="novelty-guide-outer-wrapper">
<div class="novelty-guide-wrapper">

  <div class="novelty-guide-toolbar">
    <span class="guide-kicker"><span aria-hidden="true">✦</span> Novelty Library · Reader Guide</span>
    <span class="guide-pill">V4.0 Submission Playbook</span>
  </div>

  <div class="novelty-hero">
    <h2>"Got a book that broke your brain but this guide is just 'Too long to read?'"</h2>
    <p>Been there! Skip the essays and submit your review directly right now.</p>
    <a href="/submit" target="_blank" class="novelty-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      Submit Your Review Here!
    </a>
    <p style="font-size: 0.95rem; margin-top: 20px; color: var(--novelty-cyan-light); font-style: italic;">
      No essays, no emails. We’ll turn your take into a Novelty Review, post it within a probable month, and tag you on IG!<br>Want the full master format? Explore below.
    </p>
  </div>

  <div class="novelty-img-container">
    <a href="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj5ailGmnjvpR5JI4pny8Y-XMbjQ23yFvYgY8Sdp5soU0c5q3_Eb1Bt1wppYz23cT4kzuBzuZjddxtwTOKQAWjNqXQlK52EN0JNWvkbmz-vgEiqroA30p1TqqtLQQoht3p3pVQFCU3ZYHalspQCxVfOzDBuDQmcH04j5YZ90l97iffVsXJ49ncRtIJRqCE/s859/Screenshot%202026-07-17%20004302.png" target="_blank">
      <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj5ailGmnjvpR5JI4pny8Y-XMbjQ23yFvYgY8Sdp5soU0c5q3_Eb1Bt1wppYz23cT4kzuBzuZjddxtwTOKQAWjNqXQlK52EN0JNWvkbmz-vgEiqroA30p1TqqtLQQoht3p3pVQFCU3ZYHalspQCxVfOzDBuDQmcH04j5YZ90l97iffVsXJ49ncRtIJRqCE/w640-h482/Screenshot%202026-07-17%20004302.png" alt="Novelty Review Preview" />
    </a>
  </div>

  <div class="novelty-img-container">
    <a href="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiGuq_cueRIOJT1GSLOC1oQSLpvCV2GFrd1uk7id72Dj1Tp23RXnF3AOfqxA4BNTANrn17b6Kb850IrR6XOy2o2gg5AmGfq8qq7TN6JeGuSAfTeGAyoaSEKs99BmRp9ENilvWW3l6nuZKaMGV3pxxFVCXfzZSCvwN2JhKBFpINofEN0-tIPhbBqcWPaP2Y/s2000/Review%20with%20Form%20V4.0%20.png" target="_blank">
      <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiGuq_cueRIOJT1GSLOC1oQSLpvCV2GFrd1uk7id72Dj1Tp23RXnF3AOfqxA4BNTANrn17b6Kb850IrR6XOy2o2gg5AmGfq8qq7TN6JeGuSAfTeGAyoaSEKs99BmRp9ENilvWW3l6nuZKaMGV3pxxFVCXfzZSCvwN2JhKBFpINofEN0-tIPhbBqcWPaP2Y/s1600/Review%20with%20Form%20V4.0%20.png" alt="Review with Form V4.0" />
    </a>
  </div>

  <div class="novelty-guide-section-intro">
    <div class="novelty-guide-stat"><strong>Free</strong><span>Submission cost</span></div>
    <div class="novelty-guide-stat"><strong>18+</strong><span>Reviewer age requirement</span></div>
    <div class="novelty-guide-stat"><strong>V4.0</strong><span>Current form experience</span></div>
  </div>

  <h3 style="text-align: center; font-size: 1.75rem; margin: 10px 0 8px 0; color: var(--novelty-teal-main);">REVIEW SUBMISSION GUIDELINES</h3>
  <p style="text-align: center; margin-bottom: 25px;">Here's Novelty's comprehensive manual at a glance. Expand the sections below to find every query answered in detail!</p>

  <details class="novelty-section" open>
    <summary>
      <span style="display: flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        INTRODUCTION: The Novelty Library Vision
      </span>
      <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="novelty-content">
      <p>Are you also tired of typing <em>'Books to read,' 'Bookstores near me,'</em> or <em>'Best book recommendations'</em> on Google? Well, search no more elsewhere, because Novelty Library is all set to bring to your convenience a plethora of Book Reviews, Top Book Recommendations, Must-Read Books, and Literary Reviews, ushering an arena of books to read for every genre lover. Whether you're looking for fiction, non-fiction, mystery, romance, thrillers, or classics, Novelty Library has it all. Visit the website for insightful book critiques, author spotlights, and reading guides.</p>
      
      <p>Novelty Library Reviews is built specifically so that honest reviewers and indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. Novelty greatly admires extending reviewers a hand and letting them be part of Novelty's little hopeful journey!</p>
      
      <p>Novelty has outgrown itself with its new <strong>V4.0 Submit Book Reviews form</strong> that includes an instant downloadable IG Poster for reviewers, light-tone matching, and amongst all, the Quick-Search and Fill Update for fast-paced reviewers! Novelty wants to achieve higher limits by helping more and more authors and reviewers find their voice in a publicity-driven society.</p>
      
      <p style="margin-top: 15px;">
        <strong>SUBMIT YOUR BOOK REVIEW HERE:</strong><br>
        <a href="/submit" target="_blank" class="novelty-btn novelty-btn-sm" style="margin-top: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          Open Review Form
        </a>
      </p>
    </div>
  </details>

  <details class="novelty-section">
    <summary>
      <span style="display: flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        AT A GLANCE INFO & CORE RULES
      </span>
      <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="novelty-content">
      <ul class="novelty-list">
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
      </ul>
    </div>
  </details>

  <details class="novelty-section">
    <summary>
      <span style="display: flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        THE FORM GUIDE (Step-by-Step Breakdown)
      </span>
      <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="novelty-content">
      <h4 style="color: var(--novelty-teal-main); border-bottom: 1px solid var(--novelty-border); padding-bottom: 5px;">Section 1 of 2 - Book Review & Details</h4>
      
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
      </p>
    </div>
  </details>

  <details class="novelty-section">
    <summary>
      <span style="display: flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ADDITIONALS & V4.0 FEATURES
      </span>
      <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="novelty-content">
      <div class="novelty-grid">
        
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
      </p>
    </div>
  </details>

  <details class="novelty-section">
    <summary>
      <span style="display: flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        REVIEW AVAILABILITY & PUBLISHING QUEUE
      </span>
      <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="novelty-content">
      <p>Once a review is submitted, a Novelty administrator will check and let know if the review is received or not. The Novelty team will check the format and picture and let know if any edits are required. The final draft will be added to the queue of reviews. <strong>A reviewer can expect up to a month before the review comes out.</strong></p>
      
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
      </div>
    </div>
  </details>

  <details class="novelty-section">
    <summary>
      <span style="display: flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        CONTACT & NEWSLETTER
      </span>
      <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="novelty-content">
      <p><strong>How can you contact us?</strong></p>
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
      </div>
    </div>
  </details>

</div>
</div>`;

interface ReviewGuidelinesModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReviewGuidelinesModal({ open, onClose }: ReviewGuidelinesModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-5 bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-guidelines-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-6xl h-[94vh] rounded-[28px] overflow-hidden flex flex-col shadow-2xl"
        style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}
      >
        <style dangerouslySetInnerHTML={{ __html: GUIDE_CSS }} />
        <div className="relative flex items-center justify-between gap-4 px-5 sm:px-7 py-4 shrink-0" style={{ background: 'linear-gradient(135deg,#031b22,#075985 65%,#0097b2)', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 text-cyan-100"><FileText className="w-4 h-4" /></span>
              <h2 id="review-guidelines-title" className="font-serif text-xl sm:text-2xl font-semibold truncate text-white">Review Submission Guidelines</h2>
            </div>
            <p className="text-xs mt-1 text-cyan-100/70">A fully native reading guide — no Blogger page inside the modal.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/15" aria-label="Close review guidelines">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-5" style={{ background: 'var(--color-bg)' }}>
          <div className="mx-auto mb-4 grid max-w-6xl grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}><p className="text-[10px] uppercase tracking-[.18em] font-bold" style={{ color: 'var(--color-teal-dark)' }}>01 · Read smart</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Use the expandable sections to jump between the parts that matter.</p></div>
            <div className="rounded-2xl px-4 py-3" style={{ background: 'linear-gradient(135deg,rgba(8,145,178,.10),rgba(94,234,212,.12))', border: '1px solid rgba(8,145,178,.18)' }}><p className="text-[10px] uppercase tracking-[.18em] font-bold" style={{ color: 'var(--color-teal-dark)' }}>02 · Know the format</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Cover, ratings, review length and submission terms are all in one place.</p></div>
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}><p className="text-[10px] uppercase tracking-[.18em] font-bold" style={{ color: 'var(--color-teal-dark)' }}>03 · Then submit</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Ready? Close this guide and use the web-app review form.</p></div>
          </div>
          <div className="novelty-guide-app-shell">
            <div className="novelty-guide-html" dangerouslySetInnerHTML={{ __html: GUIDE_HTML }} />
          </div>
        </div>
      </div>
    </div>
  );
}
