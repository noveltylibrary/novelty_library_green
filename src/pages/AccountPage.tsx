import { ArrowLeft, Settings, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AccountPanel, asAccountView, type AccountView } from '@/components/AccountPanel';

/**
 * Accounts & Settings as its own page (opened from the profile page). The sections (Account, Settings,
 * Documentation, Security) and their tabs live in AccountPanel; each tab has its own address (/account/<tab>),
 * so the Back button and a refresh both land where you were.
 */
export function AccountPage({ navigate, view }: { navigate: (path: string) => void; view?: string }) {
  const { user, loading } = useAuth();
  const current = asAccountView(view);
  const openView = (v: AccountView) => navigate(v === 'root' ? '/account' : `/account/${v}`);

  if (loading) return <div className="pt-32 container-prose text-center">Loading…</div>;
  if (!user) return (
    <div className="pt-32 container-prose text-center max-w-md mx-auto">
      <User className="w-12 h-12 mx-auto mb-4" />
      <h1 className="font-serif text-2xl font-semibold mb-2">Sign In Required</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Sign in to manage your account and settings.</p>
      <button type="button" onClick={() => navigate('/auth')} className="btn-primary">Sign In</button>
    </div>
  );

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in nl-account-page">
      <button type="button" onClick={() => navigate('/profile')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Profile</button>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <span className="nl-hub-icon" aria-hidden="true"><Settings className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Your account</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight">Accounts &amp; Settings</h1>
          </div>
        </div>
        <AccountPanel navigate={navigate} view={current} onView={openView} />
      </div>
    </div>
  );
}
