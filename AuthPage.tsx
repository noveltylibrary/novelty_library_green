import { useState } from 'react';
import { BookOpen, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface AuthPageProps {
  navigate: (path: string) => void;
}

export function AuthPage({ navigate }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate('/');
      } else {
        if (!privacyAccepted || !termsAccepted) {
          setError('Please agree to the Privacy Policy and Terms of Service to create an account.');
          setLoading(false);
          return;
        }
        await signUp(email, password);
        setMode('signin');
        setPassword('');
        setError('Account created! Sign in with your credentials.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-20 container-prose">
      <div className="max-w-md mx-auto animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-12 h-12 rounded-2xl gradient-teal flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-semibold mb-2 tracking-tight" style={{ color: 'var(--color-text)' }}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {mode === 'signin' ? 'Access your account to submit reviews' : 'Sign up to start submitting reviews'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-card p-6 space-y-5 shadow-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="input-field pl-10"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Both are required to create your account.</p>
              <div className="flex items-start gap-3 text-sm leading-6" style={{ color: 'var(--color-text-muted)' }}>
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--color-teal-dark)]"
                />
                <span>
                  I have read and agree to the{' '}
                  <button type="button" onClick={() => navigate('/privacy')} className="font-medium underline underline-offset-2" style={{ color: 'var(--color-cyan-dark)' }}>Privacy Policy</button>.
                </span>
              </div>

              <div className="flex items-start gap-3 text-sm leading-6" style={{ color: 'var(--color-text-muted)' }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--color-teal-dark)]"
                />
                <span>
                  I have read and agree to the{' '}
                  <button type="button" onClick={() => navigate('/terms')} className="font-medium underline underline-offset-2" style={{ color: 'var(--color-cyan-dark)' }}>Terms of Service</button>.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || (mode === 'signup' && (!privacyAccepted || !termsAccepted))} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Please wait...' : (<>{mode === 'signin' ? 'Sign In' : 'Create Account'}<ArrowRight className="w-4 h-4" /></>)}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
              className="text-sm transition-colors"
              style={{ color: 'var(--color-cyan-dark)' }}
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        <button onClick={() => navigate('/')} className="block mx-auto mt-6 text-sm transition-colors" style={{ color: 'var(--color-text-muted)' }}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
