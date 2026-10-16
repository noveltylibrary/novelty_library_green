export interface BlogPost {
  title: string;
  url: string;
  published: string;
  updated: string;
  thumbnail: string | null;
  summary: string;
  content: string;
  categories: string[];
  author: string;
  id: string;
}

interface BlogResponse {
  posts: BlogPost[];
  total: number;
  favicon?: string;
}

function endpoint(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blog-posts`;
}

const STORE_KEY = 'nl_blog_archive_v1';
const FRESH_MS = 10 * 60_000;
let memory: { at: number; posts: BlogPost[] } | null = null;
let inflight: Promise<BlogPost[]> | null = null;

function readStore(): { at: number; posts: BlogPost[] } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; posts: BlogPost[] };
    return Array.isArray(parsed.posts) && parsed.posts.length ? parsed : null;
  } catch { return null; }
}

function writeStore(entry: { at: number; posts: BlogPost[] }) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(entry)); }
  catch {
    // Quota: keep a slimmer copy (the matcher and links only need metadata).
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ at: entry.at, posts: entry.posts.map((p) => ({ ...p, content: '' })) })); } catch { /* ignore */ }
  }
}

/** Instant, synchronous read of the archive from memory or the last visit (any age). Null if never loaded. */
export function peekBlogPosts(): BlogPost[] | null {
  if (!memory) memory = readStore();
  return memory ? memory.posts : null;
}

function networkFetch(): Promise<BlogPost[]> {
  if (inflight) return inflight; // one shared request, however many callers
  inflight = (async () => {
    const res = await fetch(endpoint());
    if (!res.ok) throw new Error('Could not load the Novelty Library blog archive');
    const data = (await res.json()) as BlogResponse;
    const posts = data.posts || [];
    if (posts.length) {
      memory = { at: Date.now(), posts };
      writeStore(memory);
    }
    return posts;
  })().finally(() => { inflight = null; });
  return inflight;
}

/**
 * Stale-while-revalidate: a cached archive (even one from a previous visit) is returned at once and
 * refreshed quietly in the background, so only the very first visit ever waits for Blogger to be crawled.
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const cached = peekBlogPosts();
  if (cached && memory) {
    if (Date.now() - memory.at > FRESH_MS) void networkFetch().catch(() => undefined);
    return cached;
  }
  return networkFetch();
}

/** Start loading the archive in the background (call once when the app opens). */
export function warmBlogPosts(): void {
  const run = () => { void fetchBlogPosts().catch(() => undefined); };
  if ('requestIdleCallback' in window) (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  else setTimeout(run, 1500);
}

export function upscaleBloggerImage(url: string): string {
  return url.replace(/\/s\d{2,4}(-c)?\//, '/s700-c/');
}

export function blogPostDate(post: BlogPost): string {
  return post.updated || post.published;
}

/** Turns Blogger HTML into readable review copy without injecting third-party HTML into the app. */
export function htmlToText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blockTags = new Set(['P', 'DIV', 'BR', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR']);

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map(walk).join('');
    return blockTags.has(element.tagName) ? `\n${children}\n` : children;
  };

  return walk(doc.body)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function reviewParagraphs(post: BlogPost): string[] {
  const text = htmlToText(post.content || post.summary);
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
