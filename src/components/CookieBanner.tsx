import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { fetchEditablePage, PAGE_DEFAULTS } from '@/lib/adminConfig';
import { setCookieConsent, useCookieConsent } from '@/lib/cookieConsent';

/** Accept-cookies bar. Message is editable by admins (Admin → Pages → "Cookie bar message"). */
export function CookieBanner({ navigate }: { navigate: (path: string) => void }) {
  const consent = useCookieConsent();
  const [reopened, setReopened] = useState(false);
  const [message, setMessage] = useState(PAGE_DEFAULTS['cookie-banner'].content);

  useEffect(() => {
    let alive = true;
    fetchEditablePage('cookie-banner').then((p) => { if (alive && p.content.trim()) setMessage(p.content.trim()); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener('nl-open-cookie-settings', open);
    return () => window.removeEventListener('nl-open-cookie-settings', open);
  }, []);

  if (consent && !reopened) return null;

  const choose = (value: 'all' | 'essential') => { setCookieConsent(value); setReopened(false); };

  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4">
      <div className="mx-auto max-w-4xl surface-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,.22)' }}>
        <Cookie className="w-6 h-6 shrink-0 hidden sm:block" style={{ color: 'var(--color-teal-dark)' }} />
        <p className="text-sm leading-6 flex-1 whitespace-pre-line" style={{ color: 'var(--color-text)' }}>
          {message}{' '}
          <button type="button" onClick={() => navigate('/cookies')} className="underline underline-offset-2 font-medium" style={{ color: 'var(--color-cyan-dark)' }}>Cookie Policy</button>
        </p>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => choose('essential')} className="btn-ghost text-sm">Essential only</button>
          <button type="button" onClick={() => choose('all')} className="btn-primary !w-auto text-sm">Accept all</button>
        </div>
      </div>
    </div>
  );
}
