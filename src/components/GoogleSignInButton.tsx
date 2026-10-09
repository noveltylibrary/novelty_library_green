import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { createNoncePair, googleIdentityEnabled, GOOGLE_CLIENT_ID, loadGoogleIdentity } from '@/lib/googleIdentity';

interface Props {
  onError?: (message: string) => void;
  onStart?: () => void;
  /** Shown only while the legacy redirect flow is used (no VITE_GOOGLE_CLIENT_ID set). */
  fallbackLabel?: string;
}

const GOOGLE_G = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
);

/**
 * "Continue with Google". Uses Google Identity Services when VITE_GOOGLE_CLIENT_ID is set
 * (account chooser shows this site's name), otherwise falls back to the Supabase redirect flow.
 */
export default function GoogleSignInButton({ onError, onStart, fallbackLabel = 'Continue with Google' }: Props) {
  const { signInWithGoogle, signInWithGoogleIdToken } = useAuth();
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onError, onStart });
  cb.current = { onError, onStart };

  useEffect(() => {
    if (!googleIdentityEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const [gis, nonce] = await Promise.all([loadGoogleIdentity(), createNoncePair()]);
        if (cancelled || !holder.current) return;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          cancel_on_tap_outside: true,
          callback: (res) => {
            cb.current.onStart?.();
            signInWithGoogleIdToken(res.credential, nonce.raw).catch((err) =>
              cb.current.onError?.(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'));
          },
        });
        const dark = document.documentElement.classList.contains('dark');
        holder.current.innerHTML = '';
        gis.renderButton(holder.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, Math.round(holder.current.clientWidth || 320))),
        });
      } catch (err) {
        if (cancelled) return;
        setFailed(true);
        cb.current.onError?.(err instanceof Error ? err.message : 'Google sign-in failed to load.');
      }
    })();
    return () => { cancelled = true; };
  }, [signInWithGoogleIdToken]);

  if (!googleIdentityEnabled || failed) {
    return (
      <button
        type="button"
        onClick={() => { onStart?.(); void signInWithGoogle().catch((err) => onError?.(err instanceof Error ? err.message : 'Google sign-in failed.')); }}
        className="btn-ghost w-full justify-center gap-3 border border-slate-900/10 dark:border-white/10"
      >
        {GOOGLE_G}
        {fallbackLabel}
      </button>
    );
  }
  return <div ref={holder} className="flex w-full justify-center min-h-[44px]" />;
}
