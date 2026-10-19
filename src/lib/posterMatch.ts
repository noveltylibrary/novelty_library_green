import { fetchBlogPosts, type BlogPost } from '@/lib/blog';
import { autoMatchPosterByReviewNo, findPosterMatchesByReviewNos } from '@/lib/reviews';

/** Where Auto-Match should look for a poster. */
export type PosterSource = 'drive' | 'blog' | 'both';

export interface PosterMatch {
  url: string;
  source: 'drive' | 'blog';
  /** Human-readable note, e.g. the blog post that was matched. */
  detail?: string;
  /** Link to the matching blog post, when one was found (Blog / Drive-then-Blog lookups). */
  blogUrl?: string;
  /** Blogger publication timestamp, copied into the Publishing Queue's Published On field. */
  publishedOn?: string;
  /** Affiliate/target URL attached to the poster image in the Blogger post. */
  posterLink?: string;
}

export interface ReviewLike { review_number?: number | string | null; master_review_no?: number | string | null; title?: string | null; author?: string | null; buy_link?: string | null; amazon_link?: string | null; poster_link?: string | null; affiliate_url?: string | null }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const reviewNoOf = (r: ReviewLike): number | null => {
  const n = Number(r.review_number ?? r.master_review_no);
  return Number.isInteger(n) && n > 0 ? n : null;
};

let blogCache: { at: number; posts: BlogPost[] } | null = null;
let blogFetchPromise: Promise<BlogPost[]> | null = null;
type PreparedPost = { title: string; rawTitle: string; contentForNo: string; contentForAuthor: string; reviewNumbers: number[] };
const preparedPostCache = new WeakMap<BlogPost, PreparedPost>();
const postIndexCache = new WeakMap<BlogPost[], Map<number, BlogPost[]>>();

function preparePost(post: BlogPost) {
  const cached = preparedPostCache.get(post);
  if (cached) return cached;
  const rawTitle = post.title || '';
  const contentForNo = (post.content || '').slice(0, 4000);
  const reviewNumbers = new Set<number>();
  const numberRe = /(?:review\s*(?:no\.?|number|#)\s*:?\s*|#\s*)0*(\d+)(?!\d)/gi;
  const numberedText = `${rawTitle}\n${contentForNo}`;
  let numberMatch: RegExpExecArray | null;
  while ((numberMatch = numberRe.exec(numberedText))) {
    const number = Number(numberMatch[1]);
    if (Number.isInteger(number) && number > 0) reviewNumbers.add(number);
  }
  const prepared: PreparedPost = {
    title: norm(rawTitle),
    rawTitle,
    contentForNo,
    contentForAuthor: norm((post.content || '').slice(0, 3000)),
    reviewNumbers: [...reviewNumbers],
  };
  preparedPostCache.set(post, prepared);
  return prepared;
}

/** Index explicit review numbers once per Blogger result set. */
function getPostIndex(posts: BlogPost[]): Map<number, BlogPost[]> {
  const cached = postIndexCache.get(posts);
  if (cached) return cached;
  const index = new Map<number, BlogPost[]>();
  for (const post of posts) {
    for (const number of preparePost(post).reviewNumbers) {
      const group = index.get(number);
      if (group) group.push(post);
      else index.set(number, [post]);
    }
  }
  postIndexCache.set(posts, index);
  return index;
}

/** Restrict expensive scoring to posts that mention the review number or book title. */
function candidatePosts(posts: BlogPost[], review: ReviewLike): BlogPost[] {
  const candidates = new Set<BlogPost>();
  const no = reviewNoOf(review);
  if (no !== null) {
    for (const post of getPostIndex(posts).get(no) || []) candidates.add(post);
  }
  const book = norm(review.title || '');
  if (book.length >= 3) {
    for (const post of posts) {
      const title = preparePost(post).title;
      if (` ${title} `.includes(` ${book} `)) candidates.add(post);
    }
  }
  return [...candidates];
}

async function getBlogPosts(): Promise<BlogPost[]> {
  if (blogCache && Date.now() - blogCache.at < 5 * 60_000) return blogCache.posts;
  // If the queue's background hydration and a manual Auto-Match happen at the
  // same time, share a single network request instead of crawling Blogger twice.
  if (blogFetchPromise) return blogFetchPromise;
  blogFetchPromise = fetchBlogPosts()
    .then((posts) => {
      blogCache = { at: Date.now(), posts };
      return posts;
    })
    .finally(() => { blogFetchPromise = null; });
  return blogFetchPromise;
}

/** The poster image inside a blog post: first <img> in the post body, else the post thumbnail, at a card-friendly size. */
function postPosterLink(post: BlogPost, review?: ReviewLike): string | null {
  // Blogger affiliate links are not always attached to the poster image or
  // decorated with a tracking parameter. A separate "Buy on Amazon" button may
  // contain a clean product URL, so rank all outbound links from the post body.
  const html = [post.content || '', post.summary || ''].filter(Boolean).join('\n');
  const parseUrl = (raw: string, base: string): URL | null => {
    try {
      const cleaned = raw.trim().replace(/&amp;/gi, '&').replace(/^['"]|['"]$/g, '');
      const url = new URL(cleaned, base);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch { return null; }
  };
  const isAffiliateUrl = (url: URL): boolean => {
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const trackedParam = [...url.searchParams.keys()].some((key) =>
      /^(?:tag|aff|affid|aff_id|affiliate|affiliate_id|ref(?:_|$)|ascsubtag|irclickid|clickid|partner|partner_id|utm_.+|mkevtid|mkcid|campid|creative|linkcode|link_code|scid|psc|spm|zanpid)$/i.test(key)
    );
    const affiliateNetwork = /(^|\.)((amzn\.(to|eu))|(fkrt\.it)|(linksynergy\.com)|(awin1\.com)|(shareasale\.com)|(impact\.com)|(cj\.com)|(partnerize\.com)|(rakuten\.com)|(go\.magik\.ly)|(skimresources\.com)|(qksrv\.net)|(dpbolvw\.net)|(jdoqocy\.com)|(tkqlhce\.com))($|\.)/i.test(host);
    return trackedParam || /(?:tag=|affiliate|aff_id|affid|irclickid|ascsubtag|linkcode=|campid=|zanpid=)/i.test(`${url.search} ${url.hash}`) || affiliateNetwork;
  };
  const isImageOrBloggerAsset = (url: URL): boolean => {
    const host = url.hostname.toLowerCase();
    return /(^|\.)(blogger\.com|blogspot\.com|googleusercontent\.com|gstatic\.com)$/i.test(host)
      || /\.(?:png|jpe?g|gif|webp|svg|avif)(?:$|[?#])/i.test(url.pathname + url.search + url.hash);
  };
  const isBlogOrSocial = (url: URL): boolean => {
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return /(^|\.)(blogger\.com|blogspot\.com|instagram\.com|facebook\.com|fb\.com|pinterest\.[a-z.]+|youtube\.com|youtu\.be|t\.me|telegram\.org|twitter\.com|x\.com|linkedin\.com)$/i.test(host);
  };
  const isRetailerUrl = (url: URL): boolean => {
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return /(^|\.)(amazon\.(?:com|in|co\.uk|ca|de|fr|es|it|co\.jp|com\.au)|amzn\.(?:to|eu)|flipkart\.com|fkrt\.it|bookswagon\.com|crossword\.in|bookswagon\.com|penguin\.co\.in|harpercollins\.co\.in|hachetteindia\.com|indiabookstore\.com)$/i.test(host);
  };
  const buyText = /\b(?:buy|buy now|buy on|shop|shop now|order|purchase|check price|view price|price on|available on|get the book|buy the book|book link|amazon|flipkart|where to buy|click to buy|read on kindle|kindle edition)\b/i;
  const fallback = [review?.poster_link, review?.affiliate_url, review?.buy_link, review?.amazon_link]
    .map((value) => value?.trim())
    .find((value) => value && parseUrl(value, post.url));

  type Candidate = { url: URL; score: number; index: number };
  const rank = (anchor: Element, rawHref: string, index: number): Candidate | null => {
    const url = parseUrl(rawHref, post.url);
    if (!url || isImageOrBloggerAsset(url)) return null;
    const text = [anchor.textContent || '', anchor.getAttribute('title') || '', anchor.getAttribute('aria-label') || '', anchor.getAttribute('data-title') || ''].join(' ').replace(/\s+/g, ' ').trim();
    const hasBuyText = buyText.test(text);
    const tracked = isAffiliateUrl(url);
    const retailer = isRetailerUrl(url);
    const wrappedImage = Boolean(anchor.querySelector('img'));
    const rel = (anchor.getAttribute('rel') || '').toLowerCase();
    const hasAffiliateRel = /nofollow|sponsored|affiliate/.test(rel);
    // Ignore routine social/profile links unless the anchor itself says to buy.
    if (isBlogOrSocial(url) && !hasBuyText) return null;
    let score = 0;
    if (tracked) score += 100;
    if (retailer) score += 85;
    if (hasBuyText) score += 95;
    if (hasAffiliateRel) score += 12;
    if (wrappedImage) score += 30;
    // A plain outbound image anchor can be an opaque affiliate redirect; keep it
    // as a low-priority fallback, after buying CTAs and recognizable stores.
    if (score === 0 && wrappedImage) score = 35;
    if (score === 0) return null;
    return { url, score, index };
  };

  let candidates: Candidate[] = [];
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    let doc = parser.parseFromString(html, 'text/html');
    let anchors = Array.from(doc.querySelectorAll<HTMLElement>('a[href], a[data-href], a[data-url], a[data-link]'));
    // Some proxy/feeds return HTML entities escaped a second time. Decode one
    // level only when the first parse produced no anchors at all.
    if (!anchors.length && /&lt;\s*a\b/i.test(html)) {
      doc = parser.parseFromString(html.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"'), 'text/html');
      anchors = Array.from(doc.querySelectorAll<HTMLElement>('a[href], a[data-href], a[data-url], a[data-link]'));
    }
    anchors.forEach((anchor, index) => {
      const href = anchor.getAttribute('href') || anchor.getAttribute('data-href') || anchor.getAttribute('data-url') || anchor.getAttribute('data-link');
      if (href) {
        const candidate = rank(anchor, href, index);
        if (candidate) candidates.push(candidate);
      }
    });
  } else {
    // Fallback for non-browser environments; browsers use DOM parsing above.
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    anchors.forEach((match, index) => {
      const attrs = match[1] || '';
      const href = /\b(?:href|data-href|data-url|data-link)\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2];
      if (!href) return;
      const text = `${match[2].replace(/<[^>]*>/g, ' ')} ${attrs}`;
      const fakeAnchor = {
        textContent: text,
        getAttribute: (name: string) => name === 'title' ? (/\btitle\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] || '') : name === 'aria-label' ? (/\baria-label\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] || '') : name === 'rel' ? (/\brel\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] || '') : null,
        querySelector: (selector: string) => selector === 'img' && /<img\b/i.test(match[2]) ? {} : null,
      } as unknown as Element;
      const candidate = rank(fakeAnchor, href, index);
      if (candidate) candidates.push(candidate);
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  // For retailer/product CTAs and explicit affiliate links, return the best
  // URL; otherwise preserve the historic external linked-poster fallback.
  // Prefer a real purchase/affiliate CTA (or an external poster anchor scoring
  // at least 30) over a weak generic nofollow URL. If only weak candidates exist,
  // use the known accepted-review purchase URL instead.
  if (candidates.length && (candidates[0].score >= 30 || !fallback)) return candidates[0].url.href;
  return fallback ? parseUrl(fallback, post.url)?.href || null : candidates[0]?.url.href || null;
}
/** Poster image from the post body, falling back to the Blogger thumbnail. */
function postImage(post: BlogPost): string | null {
  const fromBody = /<img[^>]+src=["']([^"']+)["']/i.exec(post.content || '')?.[1];
  const raw = fromBody || post.thumbnail;
  if (!raw) return null;
  return raw
    .replace(/\/s\d{2,4}(-c)?\//, '/s1000/')
    .replace(/=s\d{2,4}(-c)?$/, '=s1000')
    .replace(/\/w\d+-h\d+(-c)?\//, '/s1000/');
}

function scorePost(post: BlogPost, review: ReviewLike, no: number | null): number {
  // Normalize Blogger text once per post instead of doing that work for every
  // review during queue loading and auto-match operations.
  const prepared = preparePost(post);
  const title = prepared.title;
  const book = norm(review.title || '');
  let best = 0;
  // 1) The post says which Review No. it is ("Review No. 10", "Review #10").
  if (no) {
    const noRe = new RegExp(`(?:review\\s*(?:no\\.?|number|#)\\s*:?\\s*|#)0*${no}(?!\\d)`, 'i');
    if (noRe.test(prepared.rawTitle)) best = Math.max(best, 120);
    else if (noRe.test(prepared.contentForNo)) best = Math.max(best, 90);
  }
  // 2) The post title is (or contains, as whole words) the book title.
  if (book.length >= 3 && title) {
    if (title === book) best = Math.max(best, 100);
    else if (` ${title} `.includes(` ${book} `)) best = Math.max(best, 80);
  }
  // Author appearing in the post nudges ties.
  const author = norm(review.author || '');
  if (best && author.length >= 4 && (title.includes(author) || prepared.contentForAuthor.includes(author))) best += 10;
  return best;
}

/** The best-matching blog post for a review (by Review No. in the post, or by book title). Needs no image. */
async function findBlogPost(review: ReviewLike): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  const no = reviewNoOf(review);
  let winner: { post: BlogPost; score: number } | null = null;
  for (const post of candidatePosts(posts, review)) {
    const score = scorePost(post, review, no);
    if (score >= 80 && post.url && (!winner || score > winner.score)) winner = { post, score };
  }
  return winner?.post ?? null;
}

/** Finds the review's blog post and returns its poster image and link. `url` is '' when the post has no usable image. */
export async function matchPosterFromBlog(review: ReviewLike): Promise<PosterMatch | null> {
  const post = await findBlogPost(review);
  if (!post) return null;
  return { url: postImage(post) || '', source: 'blog', detail: post.title, blogUrl: post.url, publishedOn: post.published || post.updated || undefined, posterLink: postPosterLink(post, review) || undefined };
}

/** Blog post link only (best effort; never throws). */
async function blogLinkOf(review: ReviewLike): Promise<{ blogUrl: string; detail: string; publishedOn?: string; posterLink?: string } | null> {
  try {
    const post = await findBlogPost(review);
    return post ? { blogUrl: post.url, detail: post.title, publishedOn: post.published || post.updated || undefined, posterLink: postPosterLink(post, review) || undefined } : null;
  } catch { return null; }
}

/** Single review: Drive folder, blog, or Drive first and then the blog. Throws if the chosen lookup could not run. */
export async function matchPosterForReview(review: ReviewLike, source: PosterSource): Promise<PosterMatch | null> {
  const no = reviewNoOf(review);
  if (source !== 'blog') {
    if (!no) { if (source === 'drive') return null; }
    else {
      try {
        const url = await autoMatchPosterByReviewNo(no);
        if (url) {
          // "Drive, then blog": the poster comes from Drive, and the blog post link is picked up too.
          const link = await blogLinkOf(review);
          return { url, source: 'drive', ...(link ?? {}) };
        }
      } catch (err) {
        if (source === 'drive') throw err;
        // "both": Drive being unavailable should not stop the blog lookup.
      }
    }
    if (source === 'drive') return null;
  }
  return matchPosterFromBlog(review);
}


export interface BlogReviewMetadata { blogUrl: string; publishedOn?: string; posterLink?: string; posterUrl?: string }

/** Match already-fetched Blogger posts to reviews. Pages that already fetched
 * the archive can reuse it rather than issuing a second request. */
export function findBlogMetadataFromPosts(reviews: ReviewLike[], posts: BlogPost[]): Record<string, BlogReviewMetadata> {
  const out: Record<string, BlogReviewMetadata> = {};
  for (const review of reviews) {
    const no = reviewNoOf(review);
    if (no === null) continue;
    let winner: { post: BlogPost; score: number } | null = null;
    for (const post of candidatePosts(posts, review)) {
      const score = scorePost(post, review, no);
      if (score >= 80 && post.url && (!winner || score > winner.score)) winner = { post, score };
    }
    if (winner) {
      const post = winner.post;
      out[String(no)] = { blogUrl: post.url, publishedOn: post.published || post.updated || undefined, posterLink: postPosterLink(post, review) || undefined, posterUrl: postImage(post) || undefined };
    }
  }
  return out;
}

/** Crawl Blogger and return metadata keyed by Review No. Links and dates are
 * discovered at runtime and do not require a database column. */
export async function findBlogMetadata(reviews: ReviewLike[]): Promise<Record<string, BlogReviewMetadata>> {
  try { return findBlogMetadataFromPosts(reviews, await getBlogPosts()); }
  catch { return {}; /* Blogger unavailable; queue still loads from existing data. */ }
}

/** Blog post links for many reviews at once, keyed by Review No. Best effort: returns {} if the blog is unavailable. */
export async function findBlogLinks(reviews: ReviewLike[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    for (const r of reviews) {
      const n = reviewNoOf(r);
      if (n === null) continue;
      const post = await findBlogPost(r);
      if (post) out[String(n)] = post.url;
    }
  } catch { /* blog unavailable */ }
  return out;
}

/** Batch (Batch Publish): Drive matches first, then the blog for whatever is still missing. Keyed by Review No. */
export async function findPosterMatches(reviews: ReviewLike[], source: PosterSource = 'both'): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const nums = reviews.map(reviewNoOf).filter((n): n is number => n !== null);
  if (source !== 'blog') {
    try { Object.assign(out, await findPosterMatchesByReviewNos(nums)); } catch { /* Drive unavailable */ }
  }
  if (source !== 'drive') {
    const missing = reviews.filter((r) => { const n = reviewNoOf(r); return n !== null && !out[String(n)]; });
    if (missing.length) {
      try {
        for (const r of missing) {
          const m = await matchPosterFromBlog(r);
          if (m?.url) out[String(reviewNoOf(r))] = m.url;
        }
      } catch { /* blog unavailable */ }
    }
  }
  return out;
}