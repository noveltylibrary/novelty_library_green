/**
 * Google Identity Services (GIS) helper.
 *
 * Signing in through GIS (instead of the Supabase OAuth redirect) means Google's
 * account chooser says "to continue to <your site>" rather than showing the raw
 * *.supabase.co address. The returned ID token is handed to Supabase with
 * supabase.auth.signInWithIdToken().
 */
export const GOOGLE_CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '').trim();

export const googleIdentityEnabled = GOOGLE_CLIENT_ID.length > 0;

interface GisCredentialResponse { credential: string }
interface GisButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill';
  logo_alignment?: 'left' | 'center';
  width?: number;
}
export interface GisApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GisCredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: GisButtonConfig) => void;
}

declare global {
  interface Window { google?: { accounts?: { id?: GisApi } } }
}

let loader: Promise<GisApi> | null = null;

export function loadGoogleIdentity(): Promise<GisApi> {
  if (loader) return loader;
  loader = new Promise<GisApi>((resolve, reject) => {
    const ready = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api); else reject(new Error('Google sign-in did not load.'));
    };
    if (window.google?.accounts?.id) { ready(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = ready;
    script.onerror = () => { loader = null; reject(new Error('Could not reach Google. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return loader;
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

/** Fresh nonce pair: `raw` goes to Supabase, `hashed` (SHA-256 hex) goes to Google. */
export async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: toHex(digest) };
}
