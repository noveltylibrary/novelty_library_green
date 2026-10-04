import { useEffect, useState } from 'react';
import { BookOpen, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface AuthPageProps {
  navigate: (path: string) => void;
}

export function AuthPage({ navigate }: AuthPageProps) {
  const { user, signIn, signUp, signInWithGoogle, resendConfirmation, resetPassword, updatePassword, recovering, finishRecovery, authLinkError, clearAuthLinkError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsResend, setNeedsResend] = useState(false);

  // Already signed in (e.g. just came back from Google): nothing to do here.
  useEffect(() => {
    if (user && !recovering) navigate('/');
  }, [user, recovering, navigate]);

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle(); // leaves the page for Google; nothing else to do on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await resendConfirmation(email);
      setNeedsResend(false);
      setNotice('A fresh confirmation link is on its way. Check your inbox (and spam).');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setError(/rate limit|seconds/i.test(raw) ? 'Please wait a minute before requesting another email.' : (raw || 'Could not resend the email.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsResend(false);
    clearAuthLinkError();
    setLoading(true);
    try {
      if (recovering) {
        await updatePassword(password);
        finishRecovery();
        setPassword('');
        navigate('/');
        return;
      }
      if (mode === 'forgot') {
        await resetPassword(email);
        setNotice('If an account exists for this email, a password reset link is on its way. Check your inbox (and spam).');
        return;
      }
      if (mode === 'signin') {
        await signIn(email, password);
        navigate('/');
      } else {
        if (!privacyAccepted || !termsAccepted) {
          setError('Please agree to the Privacy Policy and Terms of Service to create an account.');
          setLoading(false);
          return;
        }
        const result = await signUp(email, password);
        setPassword('');
        if (result.alreadyRegistered) {
          setMode('signin');
          setError('This email already has an account. Sign in with your password, or use "Continue with Google" if you signed up that way.');
        } else if (result.needsConfirmation) {
          setMode('signin');
          setNeedsResend(true);
          setNotice('Almost there! We sent a confirmation link to your email. Click it, then sign in. Check your spam folder if you do not see it.');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Authentication failed';
      if (/rate limit/i.test(raw)) {
        setError('Too many emails have been requested right now. Please wait a while and try again.');
      } else if (/email not confirmed/i.test(raw)) {
        setNeedsResend(true);
        setError('Please confirm your email first. Click the link we sent you, or request a new one below.');
      } else if (/invalid login credentials/i.test(raw)) {
        setError('Wrong email or password. If you signed up with Google, use "Continue with Google" instead.');
      } else {
        setError(raw);
      }
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
            {recovering ? 'Set New Password' : mode === 'forgot' ? 'Reset Password' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {recovering ? 'Choose a new password for your account' : mode === 'forgot' ? "Enter your email and we'll send you a reset link" : mode === 'signin' ? 'Access your account to submit reviews' : 'Sign up to start submitting reviews'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-card p-6 space-y-5 shadow-sm">
          {!recovering && mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={googleLoading || loading}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-surface, #fff)', borderColor: 'var(--color-border, rgba(0,0,0,0.15))', color: 'var(--color-text)' }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
                  <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
                </svg>
                {googleLoading ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                By continuing with Google you agree to our{' '}
                <button type="button" onClick={() => navigate('/privacy')} className="underline underline-offset-2">Privacy Policy</button> and{' '}
                <button type="button" onClick={() => navigate('/terms')} className="underline underline-offset-2">Terms of Service</button>.
              </p>
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                <span className="h-px flex-1" style={{ background: 'currentColor', opacity: 0.2 }} />or use email<span className="h-px flex-1" style={{ background: 'currentColor', opacity: 0.2 }} />
              </div>
            </>
          )}
          {authLinkError && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#ef4444' }}>{authLinkError}</p>
            </div>
          )}
          {!recovering && <div>
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
          </div>}

          {(mode !== 'forgot' || recovering) && <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>{recovering ? 'New password' : 'Password'}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                autoComplete={mode === 'signin' && !recovering ? 'current-password' : 'new-password'}
                className="input-field pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!recovering && mode !== 'forgot' && (
              <div className="mt-2 text-right">
                <button type="button" onClick={() => { setMode('forgot'); setError(null); setNotice(null); }} className="text-xs font-medium transition-colors" style={{ color: 'var(--color-cyan-dark)' }}>Forgot password?</button>
              </div>
            )}
          </div>}

          {mode === 'signup' && !recovering && (
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

          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#059669' }} />
              <p className="text-sm" style={{ color: '#059669' }}>{notice}</p>
            </div>
          )}

          {needsResend && !recovering && (
            <button type="button" onClick={() => void handleResend()} disabled={loading || !email} className="block mx-auto text-sm font-medium underline underline-offset-2 disabled:opacity-50" style={{ color: 'var(--color-cyan-dark)' }}>
              {email ? 'Resend confirmation email' : 'Enter your email above to resend the confirmation'}
            </button>
          )}

          <button type="submit" disabled={loading || (mode === 'signup' && !recovering && (!privacyAccepted || !termsAccepted))} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Please wait...' : (<>{recovering ? 'Update Password' : mode === 'forgot' ? 'Send Reset Link' : mode === 'signin' ? 'Sign In' : 'Create Account'}<ArrowRight className="w-4 h-4" /></>)}
          </button>

          {!recovering && <div className="text-center pt-2 space-y-2">
            {mode === 'forgot' ? (
              <button type="button" onClick={() => { setMode('signin'); setError(null); setNotice(null); }} className="text-sm transition-colors" style={{ color: 'var(--color-cyan-dark)' }}>Back to sign in</button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }}
                className="text-sm transition-colors"
                style={{ color: 'var(--color-cyan-dark)' }}
              >
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            )}
          </div>}
        </form>

        <button onClick={() => navigate('/')} className="block mx-auto mt-6 text-sm transition-colors" style={{ color: 'var(--color-text-muted)' }}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
