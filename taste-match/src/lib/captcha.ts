/**
 * Cloudflare Turnstile helper.
 *
 * `getCaptchaToken()` mints a one-time token on demand and is passed to Supabase as
 * `options.captchaToken` (Supabase → Authentication → Attack Protection → CAPTCHA).
 * The widget is mounted off the page flow, stays hidden unless Cloudflare needs the
 * visitor to interact, and is removed as soon as it returns a token.
 *
 * When VITE_TURNSTILE_SITE_KEY is empty this is a no-op that returns undefined, so the
 * code is safe to deploy BEFORE CAPTCHA is switched on in Supabase.
 * The Turnstile script is only loaded the first time a token is needed (never on page load).
 */

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || '';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_TIMEOUT_MS = 90_000;

export const captchaEnabled = SITE_KEY.length > 0;

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('unavailable')));
    script.onerror = () => reject(new Error('blocked'));
    document.head.appendChild(script);
  }).catch((err) => {
    scriptPromise = null; // allow a retry on the next attempt
    throw new Error(
      err instanceof Error && err.message === 'blocked'
        ? 'Could not load the security check. Please disable content blockers for this site and try again.'
        : 'The security check is unavailable right now. Please try again.',
    );
  });
  return scriptPromise;
}

/** Resolves with a fresh Turnstile token, or undefined when CAPTCHA is not configured. */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!captchaEnabled) return undefined;
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    const host = document.createElement('div');
    host.setAttribute('aria-live', 'polite');
    host.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;';
    document.body.appendChild(host);

    let widgetId: string | null = null;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try { if (widgetId) turnstile.remove(widgetId); } catch { /* already removed */ }
      host.remove();
      fn();
    };
    const timer = window.setTimeout(
      () => finish(() => reject(new Error('The security check timed out. Please try again.'))),
      TOKEN_TIMEOUT_MS,
    );

    try {
      widgetId = turnstile.render(host, {
        sitekey: SITE_KEY,
        appearance: 'interaction-only',
        callback: (token: string) => finish(() => resolve(token)),
        'error-callback': () => finish(() => reject(new Error('The security check failed. Please try again.'))),
        'timeout-callback': () => finish(() => reject(new Error('The security check timed out. Please try again.'))),
      });
    } catch {
      finish(() => reject(new Error('The security check could not start. Please try again.')));
    }
  });
}
