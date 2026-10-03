import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { normalizePosterUrl } from '@/lib/posterUrl';

interface PosterImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Show a visible placeholder when there is no poster / it fails to load. */
  showPlaceholder?: boolean;
}

/**
 * Always renders the poster at its natural 1:1 ratio inside a square box.
 * `object-contain` guarantees nothing is cropped (no cutting down).
 */
export function PosterImage({ src, alt, className = '', showPlaceholder = true }: PosterImageProps) {
  const url = normalizePosterUrl(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    if (!showPlaceholder) return null;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)', background: 'var(--color-paper)' }} aria-label="No poster available">
        <ImageOff className="w-5 h-5 opacity-60" />
        <span>{url ? 'Poster failed to load' : 'No poster'}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full object-contain ${className}`}
    />
  );
}
