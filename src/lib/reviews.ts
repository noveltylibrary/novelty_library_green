import { supabase } from '@/lib/supabase';
import { normalizePicks } from '@/lib/profileCardPicks';
import { prepareImageForUpload, extForImageType } from '@/lib/imageUpload';
import type { Review, ReviewStatus, Profile } from '@/types/review';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';
import { normalizeVerdict, type Verdict } from '@/lib/verdict';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function uniqueSlug(title: string): string {
  const base = slugify(title);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export async function fetchReviews(): Promise<Review[]> {
  // Public Community Reviews are a separate publication store. master_list is
  // only the Accepted Reviews source of truth and is never used as the public
  // publication table.
  const { data, error } = await supabase
    .from('community_reviews')
    .select('*')
    .eq('is_published', true)
    .order('published_on', { ascending: false, nullsFirst: false })
    .order('review_no', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapCommunityRowToReview(row as CommunityReviewRow));
}

function mapMasterListToReview(row: MasterListRow & { id: string; published?: boolean; published_on?: string | null; poster_url?: string | null; poster_link?: string | null }): Review {
  const reviewNumber = Number.parseInt(row.review_no, 10);
  const rw = Number.parseFloat(row.reviewers_rating);
  const gr = Number.parseFloat(row.goodreads_rating);
  const am = Number.parseFloat(row.amazon_rating);
  const slug = `${slugify(row.book_title || 'review')}-${row.review_no || row.id}`;
  return {
    id: row.id,
    slug,
    title: row.book_title || '',
    author: row.author || '',
    genre: row.genre || '',
    traits: row.traits || null,
    language: row.language || '',
    review_text: row.review || '',
    rw_rating: Number.isFinite(rw) ? rw : 0,
    goodreads_rating: Number.isFinite(gr) ? gr : null,
    reviewer_handle: row.instagram || null,
    cover_image_url: row.book_cover || null,
    cover_storage_path: null,
    poster_url: row.poster_url || null,
    poster_link: row.poster_link || null,
    published_on: row.published_on || null,
    buy_link: row.amazon_link || null,
    labels: row.traits ? row.traits.split(',').map((x) => x.trim()).filter(Boolean) : [],
    published_at: row.published_on || row.review_date || row.timestamp || '',
    created_at: row.timestamp || row.created_at || '',
    updated_at: row.updated_at || row.timestamp || '',
    status: 'approved',
    is_published: Boolean(row.published),
    admin_notes: null,
    series_name: row.series || null,
    series_number: Number.parseInt(row.book_number, 10) || null,
    translated_from: row.translated_in || null,
    amazon_rating: Number.isFinite(am) ? am : null,
    review_date: row.review_date || null,
    heard_from: row.heard_from || null,
    form_feedback: row.suggestions || null,
    rating_integer: Number.isFinite(rw) ? Math.round(rw) : null,
    undertaking_accepted: true,
    user_id: null,
    master_review_no: row.review_no || null,
    review_number: Number.isFinite(reviewNumber) ? reviewNumber : null,
    reviewer_name: row.name || null,
    reviewer_email: row.email || null,
    novelty_username: row.novelty_username || null,
    verdict: normalizeVerdict((row as { verdict?: unknown }).verdict),
  } as Review;
}

export async function fetchReviewBySlug(slug: string): Promise<Review | null> {
  const reviewNo = decodeURIComponent(slug).split('-').pop() || '';
  const { data, error } = await supabase
    .from('community_reviews')
    .select('*')
    .eq('is_published', true)
    .eq('review_no', reviewNo)
    .maybeSingle();

  if (error) throw error;
  return data ? mapCommunityRowToReview(data as CommunityReviewRow) : null;
}

const reviewValueCache = new Map<string, Review>();
const reviewPromiseCache = new Map<string, Promise<Review | null>>();

/** Synchronous read of a review that was already loaded or prefetched (lets the page paint instantly). */
const slugKey = (slug: string) => { try { return decodeURIComponent(slug); } catch { return slug; } };
export function peekReview(slug: string): Review | null {
  return reviewValueCache.get(slugKey(slug)) ?? null;
}

/** Cached fetch. Also used to prefetch while the pointer is still hovering a card. */
export function loadReviewCached(slug: string): Promise<Review | null> {
  const key = slugKey(slug);
  const hit = reviewPromiseCache.get(key);
  if (hit) return hit;
  const promise = fetchReviewBySlug(slug).then((review) => {
    if (review) reviewValueCache.set(key, review);
    return review;
  }).catch((err) => { reviewPromiseCache.delete(key); throw err; });
  reviewPromiseCache.set(key, promise);
  return promise;
}
export function storeReviewInCache(slug: string, review: Review): void { reviewValueCache.set(slugKey(slug), review); }

export async function fetchGenres(): Promise<string[]> {
  const reviews = await fetchReviews();
  const genres = new Set(reviews.map((r) => r.genre));
  return Array.from(genres).sort();
}

export interface CommunityReviewRow extends MasterListRow {
  id: string;
  source_master_id: string;
  is_published: boolean;
  published_on: string | null;
  poster_url: string | null;
  poster_link: string | null;
}

function mapCommunityRowToReview(row: CommunityReviewRow): Review {
  return mapMasterListToReview({
    ...row,
    id: row.id,
    published: row.is_published,
    published_on: row.published_on,
    poster_url: row.poster_url,
    poster_link: row.poster_link,
  } as MasterListRow & { id: string; published?: boolean; published_on?: string | null; poster_url?: string | null; poster_link?: string | null });
}

export interface OpenLibraryResult {
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  publishYear: number | null;
  subjects: string[];
  language: string;
}

function mapOpenLibraryLanguage(code?: string): string {
  const map: Record<string, string> = {
    eng: 'English', hin: 'Hindi', ben: 'Bengali', tam: 'Tamil', tel: 'Telugu', mar: 'Marathi',
    guj: 'Gujarati', kan: 'Kannada', mal: 'Malayalam', pan: 'Punjabi', urd: 'Urdu', fra: 'French',
    fre: 'French', spa: 'Spanish', deu: 'German', ger: 'German', ita: 'Italian', por: 'Portuguese',
    jpn: 'Japanese', kor: 'Korean', rus: 'Russian',
  };
  return code ? (map[code.toLowerCase()] || '') : '';
}

export async function searchOpenLibrary(query: string): Promise<OpenLibraryResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open Library search failed');
  const json = await res.json();
  const docs = (json.docs ?? []) as Array<{
    title: string;
    author_name?: string[];
    cover_i?: number;
    isbn?: string[];
    first_publish_year?: number;
    subject?: string[];
    language?: string[];
  }>;
  return docs.map((d) => ({
    title: d.title || '',
    author: d.author_name?.[0] || '',
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    isbn: d.isbn?.[0] || null,
    publishYear: d.first_publish_year || null,
    subjects: (d.subject || []).slice(0, 5),
    language: mapOpenLibraryLanguage(d.language?.[0]),
  }));
}

export async function uploadCoverImage(rawFile: File, userId: string): Promise<{ path: string; publicUrl: string }> {
  const file = await prepareImageForUpload(rawFile);
  const ext = extForImageType(file.type);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('covers').upload(fileName, file, { contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('covers').getPublicUrl(fileName);
  return { path: fileName, publicUrl: urlData.publicUrl };
}

export async function uploadAvatarImage(rawFile: File, userId: string): Promise<{ path: string; publicUrl: string }> {
  const file = await prepareImageForUpload(rawFile);
  const ext = extForImageType(file.type);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(fileName, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return { path: fileName, publicUrl: urlData.publicUrl };
}

export async function uploadProfileHeaderImage(rawFile: File, userId: string, limits?: { maxWidth?: number; maxHeight?: number }): Promise<{ path: string; publicUrl: string }> {
  const file = await prepareImageForUpload(rawFile, limits?.maxWidth ?? 3000, limits?.maxHeight ?? 3000);
  const ext = extForImageType(file.type);
  const fileName = `${userId}/headers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(fileName, file, { contentType: file.type, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return { path: fileName, publicUrl: urlData.publicUrl };
}

// Admin-only poster uploads live under covers/posters/{reviewNo}/... — see
// the "posters_admin_upload" storage policy, which only allows writes under
// that exact prefix from a signed-in admin.
export async function uploadReviewPoster(reviewNo: number, rawFile: File): Promise<string> {
  const file = await prepareImageForUpload(rawFile);
  const ext = extForImageType(file.type);
  const fileName = `posters/${reviewNo}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('covers').upload(fileName, file, {
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Poster upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from('covers').getPublicUrl(fileName);
  return urlData.publicUrl;
}

const POSTER_MATCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poster-match`;

// Looks for {reviewNo}.png / .jpg / .jpeg in the shared Posters Drive folder
// via the poster-match Edge Function. Returns null (not an error) when
// nothing matches; throws only when the lookup itself couldn't run (e.g.
// the Drive API key isn't configured).
export async function autoMatchPosterByReviewNo(reviewNo: number): Promise<string | null> {
  const res = await fetch(`${POSTER_MATCH_URL}?review_no=${encodeURIComponent(String(reviewNo))}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Poster match failed (${res.status})`);
  }
  return data.matched ? (data.posterUrl as string) : null;
}

// Batch variant for Batch Publish / RePublish All — looks up every review
// number in parallel and returns only the ones that actually matched.
export async function findPosterMatchesByReviewNos(reviewNos: number[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(reviewNos));
  const results = await Promise.all(
    unique.map(async (no) => {
      try {
        const url = await autoMatchPosterByReviewNo(no);
        return [String(no), url] as const;
      } catch {
        return [String(no), null] as const;
      }
    })
  );
  const map: Record<string, string> = {};
  for (const [no, url] of results) {
    if (url) map[no] = url;
  }
  return map;
}

function isMissingFormFeedbackColumn(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  const text = [candidate?.code, candidate?.message, candidate?.details].filter(Boolean).join(' ').toLowerCase();
  return candidate?.code === 'PGRST204' && text.includes('form_feedback');
}

export async function submitReview(input: {
  title: string;
  author: string;
  genre: string;
  traits?: string;
  language: string;
  review_text: string;
  rw_rating: number;
  goodreads_rating?: number;
  amazon_rating?: number;
  reviewer_handle?: string;
  reviewer_name?: string;
  reviewer_email?: string;
  cover_image_url?: string;
  cover_storage_path?: string;
  buy_link?: string;
  labels?: string[];
  series_name?: string;
  series_number?: number;
  translated_from?: string;
  review_date?: string;
  heard_from?: string;
  form_feedback?: string;
  rating_integer?: number;
  undertaking_accepted?: boolean;
  verdict: Verdict;
}): Promise<Review> {
  const slug = uniqueSlug(input.title);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  // Reviewer identity (name, Instagram handle, email) is always taken from
  // the submitter's own authenticated profile — never from free-text input
  // on the form — so the caller is expected to pass these through from
  // `useAuth().profile` / `.user` rather than letting the reviewer type them.
  const reviewPayload = {
    slug,
    title: sanitizeUserText(input.title, 300),
    author: sanitizeUserText(input.author, 200),
    genre: sanitizeUserText(input.genre, 100),
    traits: input.traits ? sanitizeUserText(input.traits, 500) : null,
    language: sanitizeUserText(input.language || 'English', 80),
    review_text: sanitizeUserText(input.review_text, 20000),
    rw_rating: input.rw_rating,
    goodreads_rating: input.goodreads_rating || null,
    amazon_rating: input.amazon_rating || null,
    reviewer_handle: input.reviewer_handle ? sanitizeUserText(input.reviewer_handle, 100) : null,
    reviewer_name: input.reviewer_name ? sanitizeUserText(input.reviewer_name, 120) : null,
    reviewer_email: input.reviewer_email ? sanitizeUserText(input.reviewer_email, 320) : null,
    cover_image_url: input.cover_image_url || null,
    cover_storage_path: input.cover_storage_path || null,
    buy_link: input.buy_link ? safeExternalUrl(input.buy_link) : null,
    labels: (input.labels || []).map((x) => sanitizeUserText(x, 80)).filter(Boolean).slice(0, 20),
    published_at: new Date().toISOString().slice(0, 10),
    status: 'pending',
    series_name: input.series_name ? sanitizeUserText(input.series_name, 200) : null,
    series_number: input.series_number || null,
    translated_from: input.translated_from ? sanitizeUserText(input.translated_from, 80) : null,
    review_date: input.review_date || null,
    heard_from: input.heard_from ? sanitizeUserText(input.heard_from, 120) : null,
    form_feedback: input.form_feedback ? sanitizeUserText(input.form_feedback, 4000) : null,
    rating_integer: input.rating_integer || null,
    undertaking_accepted: input.undertaking_accepted || false,
    user_id: userId,
    verdict: normalizeVerdict(input.verdict),
  };

  let { data, error } = await supabase
    .from('reviews')
    .insert(reviewPayload)
    .select()
    .single();

  // Older deployments may not have received the form_feedback migration yet.
  // Do not block an otherwise valid review submission in that case; retry the
  // same insert without the optional feedback column. The migration remains
  // in the project so the field starts persisting automatically once applied.
  if (error && isMissingFormFeedbackColumn(error)) {
    const { form_feedback: _formFeedback, ...legacyPayload } = reviewPayload;
    ({ data, error } = await supabase
      .from('reviews')
      .insert(legacyPayload)
      .select()
      .single());
  }

  if (error) throw error;
  return data as Review;
}

export interface MasterListRow {
  review_no: string;
  timestamp: string;
  name: string;
  email: string;
  novelty_username: string;
  contact_required: string;
  instagram: string;
  website: string;
  book_title: string;
  author: string;
  genre: string;
  series: string;
  book_number: string;
  language: string;
  translated_in: string;
  reviewers_rating: string;
  goodreads_rating: string;
  amazon_rating: string;
  traits: string;
  book_cover: string;
  review: string;
  amazon_link: string;
  review_date: string;
  heard_from: string;
  status: string;
  blogger_draft: string;
  created_at?: string;
  updated_at?: string;
  published?: boolean;
  published_on?: string | null;
  poster_url?: string | null;
  poster_link?: string | null;
  verdict?: string | null;
}

// Review No. is stored as text (it mirrors a free-form spreadsheet column),
// so the next number must be computed by parsing every existing value as an
// integer and taking the max — sorting the text column itself ("10" sorts
// before "9") would silently produce a lower/duplicate number once there
// are 10+ rows.
export async function getNextMasterReviewNo(): Promise<number> {
  const { data, error } = await supabase.from('master_list').select('review_no');
  if (error) throw error;
  let max = 0;
  for (const row of (data ?? []) as { review_no: string }[]) {
    const n = parseInt(row.review_no, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export interface PublishResult {
  reviewNo: string;
  alreadyPublished: boolean;
}

/**
 * Creates the corresponding Master List row for an accepted review.
 * Publication itself is handled separately in `community_reviews`.
 *
 * Review No. assignment:
 * - Pass `customReviewNo` when the admin typed a number into the editable
 *   "Review No." column — that exact integer is used (after checking it
 *   isn't already taken).
 * - Leave `customReviewNo` undefined when the admin left the field blank —
 *   the next sequential number (MAX(review_no) + 1) is auto-assigned.
 *
 * Idempotent: if this review was already published, it just returns the
 * existing Review No. instead of creating a duplicate row.
 */
export async function publishReviewToMasterList(
  review: Review,
  customReviewNo?: number
): Promise<PublishResult> {
  if (review.master_review_no) {
    return { reviewNo: review.master_review_no, alreadyPublished: true };
  }

  let assignedNo: number;
  if (customReviewNo !== undefined) {
    if (!Number.isInteger(customReviewNo) || customReviewNo <= 0) {
      throw new Error('Review No. must be a positive whole number.');
    }
    const { data: existing, error: checkError } = await supabase
      .from('master_list')
      .select('id')
      .eq('review_no', String(customReviewNo))
      .maybeSingle();
    if (checkError) throw checkError;
    if (existing) {
      throw new Error(`Review No. ${customReviewNo} is already assigned to another review.`);
    }
    assignedNo = customReviewNo;
  } else {
    assignedNo = await getNextMasterReviewNo();
  }

  const newRow: Omit<MasterListRow, 'blogger_draft'> & { blogger_draft: string } = {
    review_no: String(assignedNo),
    timestamp: new Date().toISOString(),
    name: review.reviewer_name || review.reviewer_handle || '',
    email: review.reviewer_email || '',
    novelty_username: review.novelty_username || '',
    contact_required: '',
    instagram: review.reviewer_handle || '',
    website: '',
    book_title: review.title,
    author: review.author,
    genre: review.genre,
    series: review.series_name || '',
    book_number: review.series_number ? String(review.series_number) : '',
    language: review.language,
    translated_in: review.translated_from || '',
    reviewers_rating: String(review.rw_rating),
    goodreads_rating: review.goodreads_rating ? String(review.goodreads_rating) : '',
    amazon_rating: review.amazon_rating ? String(review.amazon_rating) : '',
    traits: review.traits || '',
    book_cover: review.cover_image_url || '',
    review: review.review_text,
    amazon_link: review.buy_link || '',
    review_date: review.published_at || '',
    heard_from: review.heard_from || '',
    status: 'Published',
    blogger_draft: '',
    // Only sent when set, so legacy submissions (no verdict) behave exactly as before.
    ...(normalizeVerdict(review.verdict) ? { verdict: normalizeVerdict(review.verdict) } : {}),
  };

  const { error: insertError } = await supabase.from('master_list').insert(newRow);
  if (insertError) throw insertError;

  const { error: linkError } = await supabase
    .from('reviews')
    .update({ master_review_no: String(assignedNo), review_number: assignedNo })
    .eq('id', review.id);
  if (linkError) throw linkError;

  return { reviewNo: String(assignedNo), alreadyPublished: false };
}

export async function fetchAllReviewsForAdmin(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function fetchPublishedReviewsForAdmin(): Promise<Review[]> {
  const { data: masters, error: masterError } = await supabase
    .from('master_list')
    .select('*')
    .order('review_no', { ascending: true, nullsFirst: false });
  if (masterError) throw masterError;

  const { data: community, error: communityError } = await supabase
    .from('community_reviews')
    .select('source_master_id,review_no,is_published,published_on,poster_url,poster_link');
  if (communityError) throw communityError;

  const byMaster = new Map((community ?? []).map((row: any) => [row.source_master_id, row]));
  return (masters ?? []).map((row: any) => {
    const c = byMaster.get(row.id);
    return mapMasterListToReview({
      ...row,
      id: row.id,
      published: Boolean(c?.is_published),
      published_on: c?.published_on ?? null,
      poster_url: c?.poster_url ?? null,
      poster_link: c?.poster_link ?? null,
    });
  });
}

function communitySnapshot(master: any, extra: Record<string, unknown> = {}) {
  return {
    source_master_id: master.id,
    review_no: String(master.review_no ?? ''),
    timestamp: master.timestamp ?? '',
    name: master.name ?? '',
    email: master.email ?? '',
    novelty_username: master.novelty_username ?? '',
    contact_required: master.contact_required ?? '',
    instagram: master.instagram ?? '',
    website: master.website ?? '',
    book_title: master.book_title ?? '',
    author: master.author ?? '',
    genre: master.genre ?? '',
    series: master.series ?? '',
    book_number: master.book_number ?? '',
    language: master.language ?? '',
    translated_in: master.translated_in ?? '',
    reviewers_rating: master.reviewers_rating ?? '',
    goodreads_rating: master.goodreads_rating ?? '',
    amazon_rating: master.amazon_rating ?? '',
    traits: master.traits ?? '',
    book_cover: master.book_cover ?? '',
    review: master.review ?? '',
    amazon_link: master.amazon_link ?? '',
    review_date: master.review_date ?? '',
    heard_from: master.heard_from ?? '',
    agreement: master.agreement ?? '',
    form_rating: master.form_rating ?? '',
    suggestions: master.suggestions ?? '',
    status: master.status ?? '',
    blogger_draft: master.blogger_draft ?? '',
    // Mirror the verdict only when the column exists on the source row; invalid/sheet text becomes NULL.
    ...('verdict' in master ? { verdict: normalizeVerdict(master.verdict) } : {}),
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

async function getMasterById(id: string) {
  const { data, error } = await supabase.from('master_list').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Accepted Review could not be found.');
  return data as any;
}

export async function savePublishedMetadata(reviewId: string, reviewNo: string | number, fields: { posterUrl?: string | null; posterLink?: string | null; publishedOn?: string | null; noveltyUsername?: string | null }): Promise<void> {
  let master = await getMasterById(reviewId);

  // Username is editable from the Publishing Queue. Save it to the accepted
  // source first so every future publication/republication carries it.
  if (fields.noveltyUsername !== undefined) {
    const normalized = fields.noveltyUsername?.trim().replace(/^@/, '').toLowerCase() || null;
    const { error: usernameError } = await supabase
      .from('master_list')
      .update({ novelty_username: normalized, updated_at: new Date().toISOString() })
      .eq('id', reviewId);
    if (usernameError) throw usernameError;
    master = await getMasterById(reviewId);
  }

  const { data: existing } = await supabase
    .from('community_reviews')
    .select('is_published,poster_url,poster_link,published_on,novelty_username')
    .eq('source_master_id', reviewId)
    .maybeSingle();

  // `undefined` means "leave as is"; only an explicit value changes a field.
  const row = communitySnapshot(master, {
    poster_url: fields.posterUrl === undefined ? (existing?.poster_url ?? null) : fields.posterUrl,
    poster_link: fields.posterLink === undefined ? (existing?.poster_link ?? null) : fields.posterLink,
    published_on: fields.publishedOn === undefined ? (existing?.published_on ?? null) : fields.publishedOn,
    novelty_username: master.novelty_username ?? existing?.novelty_username ?? null,
    is_published: Boolean(existing?.is_published),
  });
  void reviewNo;
  const { error } = await supabase.from('community_reviews').upsert(row, { onConflict: 'source_master_id' });
  if (error) throw error;
}

export async function savePosterUrl(reviewId: string, posterUrl: string | null): Promise<void> {
  const master = await getMasterById(reviewId);
  const { data: existing } = await supabase.from('community_reviews').select('poster_link,published_on,is_published').eq('source_master_id', reviewId).maybeSingle();
  const row = communitySnapshot(master, { poster_url: posterUrl, poster_link: existing?.poster_link ?? null, published_on: existing?.published_on ?? null, is_published: Boolean(existing?.is_published) });
  const { error } = await supabase.from('community_reviews').upsert(row, { onConflict: 'source_master_id' });
  if (error) throw error;
}

export async function updateReviewPublication(id: string, isPublished: boolean): Promise<void> {
  const master = await getMasterById(id);
  const { data: existing } = await supabase.from('community_reviews').select('poster_url,poster_link,published_on').eq('source_master_id', id).maybeSingle();
  const now = new Date().toISOString();
  const row = communitySnapshot(master, {
    poster_url: existing?.poster_url ?? null,
    poster_link: existing?.poster_link ?? null,
    published_on: isPublished ? (existing?.published_on || now) : null,
    is_published: isPublished,
  });
  const { error } = await supabase.from('community_reviews').upsert(row, { onConflict: 'source_master_id' });
  if (error) throw error;
}

export async function publishMasterReviewsBatch(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { data: masters, error } = await supabase.from('master_list').select('*').in('id', ids);
  if (error) throw error;
  const now = new Date().toISOString();
  const { data: existing } = await supabase.from('community_reviews').select('source_master_id,poster_url,poster_link,published_on').in('source_master_id', ids);
  const existingMap = new Map((existing ?? []).map((r: any) => [r.source_master_id, r]));
  const rows = (masters ?? []).map((master: any) => {
    const old = existingMap.get(master.id);
    return communitySnapshot(master, { poster_url: old?.poster_url ?? null, poster_link: old?.poster_link ?? null, published_on: old?.published_on || now, is_published: true });
  });
  if (!rows.length) return;
  const { error: upsertError } = await supabase.from('community_reviews').upsert(rows, { onConflict: 'source_master_id' });
  if (upsertError) throw upsertError;
}

export async function redeployMasterReviews(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { data: masters, error } = await supabase.from('master_list').select('*').in('id', ids);
  if (error) throw error;
  const { data: existing } = await supabase.from('community_reviews').select('source_master_id,poster_url,poster_link,published_on,is_published').in('source_master_id', ids);
  const existingMap = new Map((existing ?? []).map((r: any) => [r.source_master_id, r]));
  const now = new Date().toISOString();
  const rows = (masters ?? []).map((master: any) => {
    const old = existingMap.get(master.id);
    return communitySnapshot(master, { poster_url: old?.poster_url ?? null, poster_link: old?.poster_link ?? null, published_on: old?.published_on || now, is_published: true });
  });
  if (!rows.length) return;
  const { error: upsertError } = await supabase.from('community_reviews').upsert(rows, { onConflict: 'source_master_id' });
  if (upsertError) throw upsertError;
}

export async function updateReviewStatus(id: string, status: ReviewStatus, adminNotes?: string): Promise<void> {
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (adminNotes !== undefined) update.admin_notes = adminNotes;
  const { error } = await supabase.from('reviews').update(update).eq('id', id);
  if (error) throw error;
}

export async function updateReview(
  id: string,
  fields: Partial<Review>
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}

export interface SavedReviewDraft {
  id: string;
  name: string;
  draft_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function saveDraft(
  draftData: Record<string, unknown>,
  name: string,
  draftId?: string,
): Promise<SavedReviewDraft> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Must be signed in to save drafts');

  const cleanedName = name.trim().slice(0, 120);
  if (!cleanedName) throw new Error('Please enter a draft name.');
  const payload = { ...draftData, __savedAt: new Date().toISOString() };
  const now = new Date().toISOString();

  if (draftId) {
    const { data, error } = await supabase
      .from('review_drafts')
      .update({ name: cleanedName, draft_data: payload, updated_at: now })
      .eq('id', draftId)
      .eq('user_id', user.id)
      .select('id,name,draft_data,created_at,updated_at')
      .single();
    if (error) throw error;
    return data as SavedReviewDraft;
  }

  const { count, error: countError } = await supabase
    .from('review_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (countError) throw countError;
  if ((count ?? 0) >= 5) throw new Error('You can save up to 5 drafts per account. Load an existing draft and save it again to update it.');

  const { data, error } = await supabase
    .from('review_drafts')
    .insert({ name: cleanedName, draft_data: payload, user_id: user.id, updated_at: now })
    .select('id,name,draft_data,created_at,updated_at')
    .single();
  if (error) throw error;
  return data as SavedReviewDraft;
}

export async function loadDrafts(): Promise<SavedReviewDraft[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('review_drafts')
    .select('id,name,draft_data,created_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedReviewDraft[];
}

export async function loadDraft(id?: string): Promise<Record<string, unknown> | null> {
  const drafts = await loadDrafts();
  const chosen = id ? drafts.find((d) => d.id === id) : drafts[0];
  return chosen?.draft_data ?? null;
}

export interface BookReservation {
  id: string;
  user_id: string | null;
  book_name: string;
  author_name: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  admin_note: string | null;
  admin_id: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
  requester_email?: string | null;
}

export async function checkBookAvailability(title: string): Promise<{ unavailable: boolean; reason: 'reviewed' | 'reserved' | 'available' }> {
  const cleaned = title.trim();
  if (!cleaned) return { unavailable: false, reason: 'available' };
  const { data, error } = await supabase.rpc('check_book_availability', { p_title: cleaned });
  if (error) throw error;
  return (data ?? { unavailable: false, reason: 'available' }) as { unavailable: boolean; reason: 'reviewed' | 'reserved' | 'available' };
}

export async function createBookReservation(bookName: string, authorName?: string): Promise<BookReservation> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('You must be signed in to reserve a book.');
  const title = bookName.trim();
  if (!title) throw new Error('Book name is required.');
  const availability = await checkBookAvailability(title);
  if (availability.unavailable) throw new Error(availability.reason === 'reserved' ? 'This book is already reserved. Please pick another book.' : 'This book is already reviewed. Please pick another book.');

  const { data, error } = await supabase
    .from('book_reservations')
    .insert({ user_id: user.id, book_name: title, author_name: authorName?.trim() || null, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return data as BookReservation;
}

export async function fetchBookReservationsForAdmin(): Promise<BookReservation[]> {
  // book_reservations.user_id references auth.users(id), not public.profiles(id),
  // so PostgREST cannot use profiles:user_id as a foreign-key relationship.
  // Fetch the reservations first, then hydrate requester details from profiles
  // using the authenticated user's UUID. This avoids PGRST200 while preserving
  // the existing database relationship.
  const { data: reservations, error: reservationError } = await supabase
    .from('book_reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (reservationError) throw reservationError;

  const rows = (reservations ?? []) as BookReservation[];
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))
  );

  if (!userIds.length) {
    return rows.map((row) => ({
      ...row,
      requester_name: null,
      requester_email: null,
    }));
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,name,email')
    .in('id', userIds);

  // A missing profile should not prevent admins from seeing the reservation.
  // Keep the reservation itself visible and simply omit requester details.
  if (profileError) {
    return rows.map((row) => ({
      ...row,
      requester_name: null,
      requester_email: null,
    }));
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile as { id: string; name?: string | null; email?: string | null }])
  );

  return rows.map((row) => {
    const profile = row.user_id ? profileMap.get(row.user_id) : undefined;
    return {
      ...row,
      requester_name: profile?.name ?? null,
      requester_email: profile?.email ?? null,
    };
  });
}

export async function updateBookReservationStatus(id: string, status: 'accepted' | 'rejected', adminNote?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('You must be signed in.');
  const { error } = await supabase
    .from('book_reservations')
    .update({ status, admin_note: adminNote?.trim() || null, admin_id: userData.user.id, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBookReservation(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('You must be signed in.');

  const { error } = await supabase
    .from('book_reservations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function adminCreateBookReservation(bookName: string, authorName?: string): Promise<BookReservation> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('You must be signed in.');
  const availability = await checkBookAvailability(bookName);
  if (availability.unavailable) throw new Error(availability.reason === 'reserved' ? 'This book is already reserved.' : 'This book is already reviewed.');
  const { data, error } = await supabase
    .from('book_reservations')
    .insert({ user_id: null, book_name: bookName.trim(), author_name: authorName?.trim() || null, status: 'accepted', admin_id: authData.user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data as BookReservation;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

export async function updateProfile(uid: string, fields: Partial<Profile>): Promise<void> {
  // Never forward the whole Profile object to Supabase. In particular, role /
  // is_admin fields (if introduced later) must never be writable through this
  // generic client helper.
  const allowed: Partial<Profile> = {};
  const textFields = [
    'name', 'instagram_id', 'website', 'novelty_username',
    'favorite_book', 'favorite_author', 'favorite_genre',
  ] as const;
  for (const key of textFields) {
    if (key in fields) (allowed as any)[key] = sanitizeUserText((fields as any)[key], 500).trim() || null;
  }
  for (const key of ['avatar_url', 'header_image_url'] as const) {
    if (key in fields) (allowed as any)[key] = safeExternalUrl((fields as any)[key]);
  }
  if ('social_links' in fields) {
    const links = Array.isArray(fields.social_links) ? fields.social_links : [];
    (allowed as any).social_links = links.slice(0, 12).map((link) => ({
      platform: sanitizeUserText(link?.platform, 40),
      url: safeExternalUrl(link?.url) || '',
    })).filter((link) => link.platform && link.url);
  }
  if ('profile_answers' in fields) (allowed as any).profile_answers = fields.profile_answers ?? {};
  if ('books_read_this_month' in fields) {
    const value = fields.books_read_this_month;
    const number = value == null ? null : Number(value);
    (allowed as any).books_read_this_month = number == null || !Number.isFinite(number)
      ? null
      : Math.max(0, Math.min(10000, number));
  }
  if ('total_books_read' in fields) {
    const value = fields.total_books_read;
    const number = value == null ? null : Number(value);
    (allowed as any).total_books_read = number == null || !Number.isFinite(number)
      ? null
      : Math.max(0, Math.min(100000, number));
  }
  if ('reading_since' in fields) {
    const value = fields.reading_since;
    const number = value == null || (typeof value === 'string' && !value.trim()) ? null : Number(value);
    (allowed as any).reading_since = number == null || !Number.isFinite(number) ? null : number;
  }
  if ('hide_followers' in fields) (allowed as any).hide_followers = Boolean(fields.hide_followers);
  if ('hide_following' in fields) (allowed as any).hide_following = Boolean(fields.hide_following);
  if ('profile_visibility' in fields) (allowed as any).profile_visibility = fields.profile_visibility ?? {};
  if ('selected_question_ids' in fields || 'profile_display_tags' in fields) {
    const picks = normalizePicks(fields.selected_question_ids, fields.profile_display_tags);
    (allowed as any).selected_question_ids = picks.qa;
    (allowed as any).profile_display_tags = picks.tags;
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', uid)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Profile save failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('No profile row was updated. Your profile record may be missing, or Supabase permissions may be blocking the update.');
  }
}

export interface AcceptedReviewCard {
  id: string;
  review_no: string;
  book_title: string;
  author: string;
  genre: string;
  language: string;
  reviewers_rating: string;
  book_cover: string;
  review: string;
  review_date: string;
  accepted_at: string | null;
}

function normalizeProfileMatch(value: string | null | undefined): string {
  return (value || '').trim().replace(/^@/, '').toLowerCase();
}

function normalizeReviewCard(row: any): AcceptedReviewCard {
  return {
    id: String(row.id),
    review_no: String(row.review_no ?? ''),
    book_title: String(row.book_title ?? ''),
    author: String(row.author ?? ''),
    genre: String(row.genre ?? ''),
    language: String(row.language ?? ''),
    reviewers_rating: String(row.reviewers_rating ?? ''),
    book_cover: String(row.book_cover ?? ''),
    review: String(row.review ?? ''),
    review_date: String(row.review_date ?? ''),
    accepted_at: row.accepted_at ?? row.published_on ?? row.timestamp ?? null,
  };
}

/**
 * Profile shelves are read from the Accepted master list and the separate
 * Community Reviews publication store. The RPCs are preferred, but the
 * direct lookup is intentionally retained as a compatibility fallback so a
 * profile does not go blank while an older Supabase function is being updated.
 */
export async function fetchMyAcceptedReviews(): Promise<AcceptedReviewCard[]> {
  const { data, error } = await supabase.rpc('my_accepted_reviews');
  if (error) throw error;
  return (data ?? []).map(normalizeReviewCard);
}

export async function fetchMyPublishedReviews(): Promise<AcceptedReviewCard[]> {
  const { data, error } = await supabase.rpc('my_published_reviews');
  if (error) throw error;
  return (data ?? []).map(normalizeReviewCard);
}

export interface PublicProfileData {
  id: string; novelty_username: string | null; name: string | null; avatar_url: string | null; header_image_url: string | null;
  email: string | null; instagram_id: string | null; website: string | null; social_links: { platform: string; url: string }[];
  favorite_book: string | null; favorite_author: string | null; favorite_genre: string | null; books_read_this_month: number | null;
  total_books_read: number | null; reading_since: number | null; profile_answers: Record<string, unknown>; created_at: string;
  profile_visibility: Record<string, boolean>;
}

export async function fetchPublicProfile(username: string): Promise<PublicProfileData | null> {
  const { data, error } = await supabase.rpc('public_profile_by_username', { p_username: username });
  if (error) throw error;
  return (data?.[0] ?? null) as PublicProfileData | null;
}

export async function fetchPublicAcceptedReviews(username: string): Promise<AcceptedReviewCard[]> {
  const { data, error } = await supabase.rpc('public_accepted_reviews_by_username', { p_username: username });
  if (error) throw error;
  return (data ?? []) as AcceptedReviewCard[];
}

export async function fetchPublicPublishedReviews(username: string): Promise<AcceptedReviewCard[]> {
  const { data, error } = await supabase.rpc('public_published_reviews_by_username', { p_username: username });
  if (error) throw error;
  return (data ?? []) as AcceptedReviewCard[];
}


/**
 * Admin edited a verdict on an Accepted Review (master_list). If that review is already
 * published, mirror ONLY the verdict onto its community_reviews row so the banner shows
 * immediately — nothing else about the published copy is touched, no republish needed.
 * Unpublished / never-snapshotted reviews simply match zero rows.
 */
export async function mirrorVerdictToPublished(masterId: string, verdict: unknown): Promise<void> {
  const { error } = await supabase
    .from('community_reviews')
    .update({ verdict: normalizeVerdict(verdict) })
    .eq('source_master_id', masterId);
  if (error) throw error;
}
