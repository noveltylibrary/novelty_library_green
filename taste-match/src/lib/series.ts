/**
 * A series name can carry a note that the book reads fine on its own, e.g.
 * "Discworld (Standalone Sufficed)", "Discworld - standalone sufficed", "Discworld – Stand-alone sufficed".
 * Matching ignores case, brackets, hyphens/dashes and spaces between the words.
 */
const STANDALONE_RE = /[\s\-–—:,;|/]*[([{]?\s*stand[\s\-_]*alone[\s\-_]*suffic(?:ed|es|ient)\s*[)\]}]?[\s\-–—:,;|/]*/i;

export function parseSeriesName(raw: string | null | undefined): { name: string; standalone: boolean } {
  const text = (raw || '').trim();
  if (!text) return { name: '', standalone: false };
  if (!STANDALONE_RE.test(text)) return { name: text, standalone: false };
  const name = text.replace(STANDALONE_RE, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–—:,;|/]+|[\s\-–—:,;|/]+$/g, '').trim();
  return { name, standalone: true };
}
