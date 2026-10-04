import { supabase } from '@/lib/supabase';

export type FinanceCategory = 'b2b' | 'b2c';

export interface FinanceModule {
  id: string;
  category: FinanceCategory;
  name: string;
  description: string | null;
  dashboard_url: string;
  active: boolean;
  sort_order: number;
}

export interface EditablePage {
  slug: string;
  title: string;
  content: string;
  updated_at: string | null;
}

export const PAGE_DEFAULTS: Record<string, { title: string; content: string }> = {
  'review-guidelines': {
    title: 'NOVELTY LIBRARY BOOK REVIEW SUBMISSION GUIDELINES',
    content: `Got a book that broke your brain but this guide is just 'Too long to read?' Been there! So you know what? Skip it and submit your review directly here at our Review Form! 😃

That’s it. No essays, no emails.

We’ll turn your take into a Novelty Review, post it within a probable month, and tag you on IG so your followers see it.

Want the full format? Scroll down.

Just want to submit fast? Hit the link above!

Are you also tired of typing 'Books to read,' 'Bookstores near me,' or 'Best book recommendations' on Google? Well, search no more elsewhere, because Novelty Library is all set to bring to your convenience a plethora of Book Reviews, Top Book Recommendations, Must-Read Books, and Literary Reviews, ushering an arena of books to read for every genre lover. Whether you're looking for fiction, non-fiction, mystery, romance, thrillers, or classics, Novelty Library has it all. Visit the website for insightful book critiques, author spotlights, and reading guides.

EASE OF ACCESS

Novelty Library Review Submission Form

Click the above link to be redirected to the Review Submission Form. You can read the guidelines below to be better informed about your form filling processes and injuncted acknowledgements and timelines.

REVIEW SUBMISSION GUIDELINES

Here's Novelty's book review submission guidelines at a glance. You can find more details as you proceed to read the article onwards!

Ø     INTRODUCTION

Reviewers willing to nominate their book submissions to Novelty Library Reviews are welcome to do so absolutely free of any charges whatsoever. Nominations must include well written samples following our submission guidelines, and the Novelty Review Writing Format, as below. Willing reviewers are requested to fill the Reviewer Form before they proceed. Click here to fill the Reviewer form. To get an ARS Referral code from your Novelty Consultant, drop in a direct message on your choice of social platform on any of our handles. A reviewer is offered a Novelty ARS Code (Assisted Referral Sustainability Code) after 10 successful reviews by the aforementioned reviewer, provided the Novelty board allows it. (Preferred contact route: Instagram) Please fill the form up only if you are 18 years or older!

There is no limit to the time you, as a reviewer, take in providing your reviews or the number of reviews you want to submit with Novelty Reviews! Since there is no bound, you can quit whenever you want. However, once a review is published, it cannot be taken down to preserve Novelty's review counter.

Please note that Novelty only publishes review of a specific book once on their channel. Any repetitive nomination shall be let known to respective reviewer and discarded. The published reviews are available over Novelty Reviews Blog and the Reviews Instagram handle primarily. Accepted book reviews are not supposed to be disclosed considering reviewer privacy. Best is to contact a Novelty Volunteer beforehand on any of the social handles to know if the submission shall become valid or not!

Ø    GUIDELINES TO FOLLOW

A review submission to Novelty must be a concise writeup written in the Novelty Review Submission Form with Novelty's Writing Format included in it.

The writeup must fit Instagram caption limit. The word count includes 250 words, or 1800 characters, or 1500 characters (without spaces) approximately. Since this is an approximate, and works for maximum of the times, reviewers are still requested to check in on their Instagram app if their final review form suits the limit. Otherwise, in case of discrepancies, a Novelty Admin will approach reviewer via mail for edits, if required. For reviewers wanting to provide a longer version of a review, reviewers can send in another longer sample in addition to this aforementioned shorter one in the suited space, so that Novelty can put the shorter one on Instagram, and the longer one on the blog. One short writeup is however, enough for a submission.

Please do not resort to using vulgar languages or demeaning any identity in your submissions. Such act would consequence in Novelty not considering your nominations and in case of extensive fouling, blacklisting your ID.

Please add a picture of the book following our Picture addition guidelines as has been instructed below.

Ø    PICTURE ADDITION

Do not forget to add a picture of the book that distinctly covers all edges and is in good quality of use. Images can be taken from Google, or phone or camera captures of good quality and edge visibility. A background-removed picture will be preferred.

Our team will add your given picture in our poster and make it fashionable through Graphic Designing. Following is a poster example, one of those that Novelty Library tends to use: a show of how your review image shall look once you’ve submitted a nomination. The stars at the bottom indicates the reviewer rating suited on a five-metre scale, and the number indicates the Review number.

Ø    WRITING FORMAT

Please do stick to the points in the format below, while you submit your nomination. Be sure to place the points as and where they exist in the format. Here is an abstraction of our writing format, as included in the Novelty Library Review Submission Form.

*Novelty Reviews format*

Title of Book*

Series name* (if any. Add Book number in the series. A late book in the series will only be published the review of, when all previous books in the series have been reviewed on our channel, unless the review book can be read and understood without reading the other books in the series, in which case, add ‘Stand-alone sufficed’.)

Author Name*

Genre of the Book* (one worded, or a couple, 3 words max.; eg., Self Help Non-fiction, Suspense Thriller, Action Tragedy, etc.) You can pick from the options available in the google form or write in your own.

Traits* (keywords describing the genre, maximum 5)

Publisher (optional)

Year of launch (optional)

Language* (original writing language of book, not translations)

Translated in* (if the reviewed book is a translation, then add the language of translation).

Translated by (optional: name of translator, if available. Ignore if the translator and Author are the same person.)

<Review> (Mandatory to be in English) (length should suffice instagram caption limit, including all other points in the format, saving space for extraneous keywords and tags)

Include critical takes in review, if any!

R/W Rating* (reviewer’s rating out of 10, up to one decimal place.)

(Keep critical thoughts while rating.)

Amazon Rating (optional)

Goodreads rating* (out of 5) (include 'as on date of publishing of post' within brackets as given.)

Reviewed by*: include your name followed by

A> instagram handle for instagram post
B> website or any other handle you want to give for website post (In case not provided, instagram is default).

_Date of review (optional)_

Note:

i. Fields include the heading marked in a shade of cyan colour. The heading must be written in the final print of the review followed by a ‘colon’ mark giving the answer.

ii. Fields marked * are compulsory to fill out!

iii. Fields marked * are compulsory to fill out, when applicable!

iv. Adjust to a line gap after each paragraph as is above.

Here's to let all readers know that the R/W Ratings as provided in here is limited to the specific reviewer's opinion and doesn't reflect an accumulative briefing of the book. The book's impression may vary from reader to reader, and substantially so in certain cases. For an accumulative briefing, the Goodreads rating will guide an answer.

Ø   REVIEW AVAILABILITY

Once a review is submitted, a Novelty administrator will check and let know if the review is received or not. Novelty team will check the format and picture and let know if any edits are required. The final draft will be added to the queue of reviews. A reviewer can except upto a month before the review comes out.

Reviews shall be available on:

1. Novelty Reviews Blog (noveltylibrary.blogspot.com)

2. Novelty Reviews Instagram Handle (www.instagram.com/novelty.lib)

Reviewers will be credited on the blog with suitable revert link as provided in the mail. Reviewers will be sent a collaboration request on Instagram and it is upto them if they want to accept or deny.

Here is how a review shall look like once it’s published. You can take inception and inspiration from here.

• Sample Review on Instagram: The Seven Husbands of Evelyn Hugo
• Sample Review on Blog: A Study in Scarlet

Note: Please note that since we assign review numbers accordingly for each of our posted reviews, any review posted shall not be taken down in the future. Be sure to submit your reviews keeping that in mind!

Ø   CONTACT

How can you contact us?

You can connect with us over social media handles like Facebook, Instagram, X (formerly Twitter), Telegram, and Youtube, and most prominently e-mails. You can drop in a message and our support team will be more than happy to answer your questions. All respective links can be found here: linktr.ee/novelty.lib

Click here to DOWNLOAD a copy of our guidelines!`,
  },
  about: {
    title: 'About Novelty Library',
    content: `Novelty Library exists so indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds.

About Novelty Library

What mission do we serve?
Novelty Library Reviews is built specifically so honest reviewers and indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. We want to help more authors and reviewers find their voice in a publicity-driven world.

What's new on the platform?
The Submit Book Reviews form includes live progress, preview, Quick Search and Fill, saved drafts, a short editing window after submitting, and an Instagram-story poster workflow.

Tired of the mediocre?
Novelty Library brings together book reviews, recommendations, must-reads, and literary critiques for every kind of reader.`,
  },
  privacy: {
    title: 'Privacy Policy & Data Governance Notice',
    content: `Last updated: September 2026

Applicable Law: This Privacy Policy is intended to operate in accordance with applicable laws of India.

1. Information We Collect
When you create an account, log in, or submit a review on Novelty Library, we collect account and reviewer information needed for authentication, spam prevention, and attribution.

2. Age & Children’s Privacy
Novelty Library is designed for readers aged 13 and above. We do not knowingly solicit personal information from children under 13 without guardian consent.

3. How We Use Your Information
Account authentication, security tokens, and profile data are securely processed through our service providers. Published review attribution may include the profile details a reviewer has chosen to make public.

4. No Sale or Commercialization of Personal Data
We do not sell, rent, license, or trade your personal information for marketing or advertising purposes.

5. Account Deletion
You may request deletion of your account and personal identifiers by contacting the support address shown on this page. Published review archive rules may require anonymization rather than removal of review content.

6. Grievance Officer & Contact
For privacy inquiries, data deletion requests, or grievances, contact Novelty Library support.

Right to Modify
We may update this notice periodically to reflect platform improvements.`,
  },
  terms: {
    title: 'Terms of Service & Fair Use',
    content: `Last updated: September 2026

Applicable Law: These Terms are intended to operate in accordance with applicable laws of India.

Scope of these terms
These terms apply to book reviews, reading features, community interactions, and current or future features offered on Novelty Library.

Age Representation & Parental Assent
Novelty Library is designed for readers aged 13 and above. Users must meet the applicable age requirement or access the service with appropriate parental or guardian consent.

Submitting reviews
By submitting a review to Novelty Library, you grant Novelty Library a non-exclusive license to format, edit for presentation, reproduce, and display that submitted review as part of the site and related Novelty Library materials. You retain ownership of your original review.

Book information and fair use
Book titles, cover thumbnails, publisher information, and other book metadata belong to their respective rights holders. Novelty Library uses this material for book identification, review, commentary, and criticism.

Reviewer responsibility
Reviewers are responsible for content they submit and should only submit material they have the right to share.

Copyright Infringement, Intermediary Takedowns & Review Permanence
Rights holders may submit valid takedown requests for third-party material. Review archive rules may preserve assigned review numbers while allowing personal attribution to be anonymized where appropriate.

Right to Modify
We may update these terms periodically to reflect platform improvements.`,
  },
};

export async function fetchFinanceModules(category?: FinanceCategory): Promise<FinanceModule[]> {
  let query = supabase.from('finance_modules').select('*').eq('active', true).order('sort_order', { ascending: true });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FinanceModule[];
}

export async function fetchAllFinanceModules(): Promise<FinanceModule[]> {
  const { data, error } = await supabase.from('finance_modules').select('*').order('category').order('sort_order');
  if (error) throw error;
  return (data ?? []) as FinanceModule[];
}

export async function saveFinanceModule(input: Partial<FinanceModule> & Pick<FinanceModule, 'category' | 'name' | 'dashboard_url'>): Promise<FinanceModule> {
  const payload = {
    category: input.category,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    dashboard_url: input.dashboard_url.trim(),
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
  };
  if (input.id) {
    const { data, error } = await supabase.from('finance_modules').update(payload).eq('id', input.id).select('*').single();
    if (error) throw error;
    return data as FinanceModule;
  }
  const { data, error } = await supabase.from('finance_modules').insert(payload).select('*').single();
  if (error) throw error;
  return data as FinanceModule;
}

export async function deleteFinanceModule(id: string): Promise<void> {
  const { error } = await supabase.from('finance_modules').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchEditablePage(slug: string): Promise<EditablePage> {
  const fallback = PAGE_DEFAULTS[slug] || { title: slug, content: '' };
  const { data, error } = await supabase.from('editable_pages').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) return { slug, ...fallback, updated_at: null };
  return data as EditablePage;
}

export async function saveEditablePage(slug: string, title: string, content: string): Promise<EditablePage> {
  const { data, error } = await supabase
    .from('editable_pages')
    .upsert({ slug, title: title.trim(), content, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    .select('*')
    .single();
  if (error) throw error;
  return data as EditablePage;
}
