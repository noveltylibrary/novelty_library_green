import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { normalizePosterUrl } from '@/lib/posterUrl';
import { safeExternalUrl } from '@/lib/sanitize';

/**
 * Small book cover for lists and previews. Stored poster links (Google Drive, Blogger, retailer hosts) must be
 * normalised and sent without a referrer, otherwise they load as a blank box; a book icon shows only when there is
 * no usable image.
 */
export function CoverImg({ src, alt = '' }: { src: string | null | undefined; alt?: string }) {
  const url = safeExternalUrl(normalizePosterUrl(src));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return <BookOpen aria-hidden="true" />;
  return <img src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
