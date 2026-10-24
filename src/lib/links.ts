/** Public links shared across the app (footer, home, about, analytics). */
export const BLOG_URL = 'https://noveltylibrary.blogspot.com';
export const INSTAGRAM_URL = 'https://instagram.com/novelty.lib';

/** Reduces '@name', 'instagram.com/name/' or a full URL to a bare Instagram handle ('' when nothing usable). */
export function cleanInstagramHandle(value: string | null | undefined): string {
  const h = (value || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^(www\.)?instagram\.com\//i, '').split(/[/?#\s]/)[0].replace(/^@+/, '').slice(0, 30);
  return /^[A-Za-z0-9._]+$/.test(h) ? h : '';
}

/** https://instagram.com/<handle>, or null when the handle is empty or invalid. */
export function instagramProfileUrl(value: string | null | undefined): string | null {
  const h = cleanInstagramHandle(value);
  return h ? `https://instagram.com/${h}` : null;
}
