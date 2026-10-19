import DOMPurify from 'dompurify';

/**
 * Defense-in-depth sanitizers for values that originate in Supabase/user input.
 * React already escapes normal JSX text nodes; these helpers make that guarantee
 * explicit and protect future refactors that may introduce rich-text rendering.
 */
export function sanitizeUserText(value: unknown, maxLength?: number): string {
  const text = typeof value === 'string' ? value : '';
  const sanitized = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  return maxLength ? sanitized.slice(0, maxLength) : sanitized;
}

export function sanitizeRichTextHtml(value: unknown): string {
  const html = typeof value === 'string' ? value : '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
      'blockquote', 'ul', 'ol', 'li', 'a',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
    ADD_ATTR: ['target'],
  });
}

export function safeExternalUrl(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}
