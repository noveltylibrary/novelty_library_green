import { useEffect, useState } from 'react';

/** Round profile picture (same crop as the profile card's), falling back to the reader's initial. */
export function UserAvatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const box = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (url && !failed) {
    return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="rounded-full object-cover shrink-0" style={{ ...box, border: '1px solid var(--color-border)' }} />;
  }
  return <span className="rounded-full flex items-center justify-center font-bold shrink-0 nl-chip" style={{ ...box, justifyContent: 'center' }} aria-hidden="true">{(name || 'R').charAt(0).toUpperCase()}</span>;
}
