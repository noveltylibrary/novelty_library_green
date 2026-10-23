import { useEffect, useState } from 'react';

export type CookieConsent = 'all' | 'essential';

const KEY = 'nl_cookie_consent';
const EVENT = 'nl-cookie-consent-changed';

export function getCookieConsent(): CookieConsent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'essential' ? v : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: CookieConsent): void {
  try { localStorage.setItem(KEY, value); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useCookieConsent(): CookieConsent | null {
  const [value, setValue] = useState<CookieConsent | null>(() => getCookieConsent());
  useEffect(() => {
    const sync = () => setValue(getCookieConsent());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return value;
}
