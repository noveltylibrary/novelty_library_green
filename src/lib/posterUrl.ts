/**
 * Poster URL helpers.
 *
 * Why posters from Google Drive used to show blank:
 *   `https://drive.google.com/uc?export=view&id=...` is NOT a reliable
 *   <img> source. Google serves it as a redirect/interstitial, rate-limits
 *   it, and often blocks hot-linking, so the <img> silently fails.
 *   The `thumbnail` endpoint returns a real image for any file shared as
 *   "Anyone with the link", so every Drive link is converted to it here.
 */
const DRIVE_ID_PATTERNS = [
  /drive\.google\.com\/file\/d\/([\w-]+)/i,
  /drive\.google\.com\/(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([\w-]+)/i,
  /lh3\.googleusercontent\.com\/d\/([\w-]+)/i,
  /docs\.google\.com\/uc\?(?:[^#]*&)?id=([\w-]+)/i,
];

export function extractDriveId(url: string): string | null {
  for (const re of DRIVE_ID_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Turns any stored poster link into a URL that reliably renders in <img>. */
export function normalizePosterUrl(raw: string | null | undefined): string | null {
  const url = (raw || '').trim();
  if (!url) return null;

  const driveId = extractDriveId(url);
  if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;

  // Blogger/Googleusercontent: remove the square-crop flag ("-c") so nothing
  // is cut off, and ask for a large size.
  if (/(blogger\.googleusercontent\.com|bp\.blogspot\.com|googleusercontent\.com)/i.test(url)) {
    return url
      .replace(/\/s\d{2,4}(-c)?\//, '/s1600/')
      .replace(/=s\d{2,4}(-c)?$/, '=s1600')
      .replace(/\/w\d+-h\d+(-c)?\//, '/s1600/');
  }

  return url;
}
