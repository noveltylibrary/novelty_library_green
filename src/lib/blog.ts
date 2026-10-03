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

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const res = await fetch(endpoint());
  if (!res.ok) throw new Error('Could not load the Novelty Library blog archive');
  const data = (await res.json()) as BlogResponse;
  return data.posts || [];
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
