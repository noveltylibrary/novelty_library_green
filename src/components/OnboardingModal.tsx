import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  Globe2,
  Instagram,
  Link2,
  LogIn,
  Mail,
  PenLine,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { updateProfile } from '@/lib/reviews';
import { fetchProfileQuestions, type ProfileQuestion } from '@/lib/profileQuestions';
import { ProfileQuestionAnswer, answerText } from '@/components/ProfileQuestionAnswer';

interface OnboardingModalProps {
  splashComplete: boolean;
  navigate: (path: string) => void;
  suppressOnPublicRoute?: boolean;
}

type AuthMode = 'signup' | 'signin';

type OnboardingData = {
  fullName: string;
  email: string;
  password: string;
  instagram: string;
  goodreads: string;
  xHandle: string;
  website: string;
  readingSince: string;
  booksThisMonth: string;
  totalBooksRead: string;
  favoriteBook: string;
  favoriteAuthor: string;
  favoriteGenre: string;
  answers: Record<string, unknown>;
};

const ONBOARDING_KEY = 'nl_onboarding_dismissed';
const TOTAL_STEPS = 5;
const GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Thriller', 'Romance', 'Fantasy',
  'Science Fiction', 'Contemporary', 'Historical Fiction', 'Poetry', 'Biography',
  'Self-Help', 'Literary Fiction', 'Young Adult', 'Other',
];

const FALLBACK_QUESTIONS: ProfileQuestion[] = [
  { id: 'fallback-reading-spot', section: 'Reading Identity', question: 'What is your favourite reading spot?', key: 'favorite_reading_spot', type: 'short_text', options: [], required: false, public_default: true, show_in_profile_card: true, sort_order: 1, active: true },
  { id: 'fallback-reading-goal', section: 'Reading Identity', question: 'What is your current reading goal?', key: 'current_reading_goal', type: 'short_text', options: [], required: false, public_default: true, show_in_profile_card: true, sort_order: 2, active: true },
  { id: 'fallback-trope', section: 'Reading Identity', question: 'What is your favourite trope?', key: 'favorite_trope', type: 'short_text', options: [], required: false, public_default: true, show_in_profile_card: true, sort_order: 3, active: true },
];

const EMPTY: OnboardingData = {
  fullName: '', email: '', password: '', instagram: '', goodreads: '', xHandle: '', website: '',
  readingSince: '', booksThisMonth: '', totalBooksRead: '', favoriteBook: '', favoriteAuthor: '',
  favoriteGenre: '', answers: {},
};

function safeReadDismissed(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) === 'true'; } catch { return false; }
}

function markDismissed(): void {
  try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch { /* ignore */ }
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, '').replace(/\s+/g, '').slice(0, 60);
}

function normalizeInstagram(value: string | null | undefined): string {
  return (value || '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .split(/[/?#]/)[0]
    .replace(/^@+/, '')
    .slice(0, 30);
}

function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getQuestionValue(question: ProfileQuestion, answers: Record<string, unknown>): string {
  return answerText(answers[question.key]);
}

function questionInputType(question: ProfileQuestion): string {
  if (question.type === 'url') return 'url';
  if (question.type === 'number' || question.type === 'year') return 'number';
  return 'text';
}

export function OnboardingModal({ splashComplete, navigate, suppressOnPublicRoute = false }: OnboardingModalProps) {
  const { user, profile, loading: authLoading, refreshProfile, signInWithGoogle } = useAuth();
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [data, setData] = useState<OnboardingData>(() => ({ ...EMPTY }));
  const [questions, setQuestions] = useState<ProfileQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selectedQuestionKeys, setSelectedQuestionKeys] = useState<string[]>([]);
  const [startedAsGuest, setStartedAsGuest] = useState(false);

  const patch = useCallback((changes: Partial<OnboardingData>) => {
    setData((current) => ({ ...current, ...changes }));
  }, []);

  const closeAndRemember = useCallback(() => {
    markDismissed();
    setActive(false);
  }, []);

  useEffect(() => {
    if (!splashComplete || authLoading || user || suppressOnPublicRoute || safeReadDismissed() || active) return;
    setStartedAsGuest(true);
    setActive(true);
    setStep(1);
    setAuthMode('signup');
    setError(null);
    setInfo(null);
    setData((current) => ({
      ...current,
      email: current.email || '',
      fullName: current.fullName || '',
    }));
  }, [splashComplete, authLoading, user, suppressOnPublicRoute, active]);

  useEffect(() => {
    if (suppressOnPublicRoute && active) {
      setActive(false);
    }
  }, [suppressOnPublicRoute, active]);

  useEffect(() => {
    if (!active) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRemember();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, closeAndRemember]);

  useEffect(() => {
    if (!active || step !== 4 || questions.length) return;
    let alive = true;
    setLoadingQuestions(true);
    void fetchProfileQuestions()
      .then((rows) => {
        if (!alive) return;
        const activeRows = rows.filter((row) => row.active !== false);
        const nextQuestions = activeRows.length ? activeRows.slice(0, 8) : FALLBACK_QUESTIONS;
        setQuestions(nextQuestions);

        // When a visitor signs in through the onboarding flow and already has
        // saved profile answers, preselect up to three answered prompts so the
        // Step 4 screen reflects their existing profile instead of making them
        // start from an empty selection.
        setSelectedQuestionKeys((current) => {
          if (current.length) return current;
          const existing = nextQuestions
            .filter((q) => {
              const value = data.answers[q.key];
              return q.type === 'image_upload'
                ? Array.isArray(value) && value.length > 0
                : getQuestionValue(q, data.answers).trim() !== '';
            })
            .slice(0, 3)
            .map((q) => q.key);
          return existing;
        });
      })
      .catch(() => {
        if (alive) setQuestions(FALLBACK_QUESTIONS);
      })
      .finally(() => { if (alive) setLoadingQuestions(false); });
    return () => { alive = false; };
  }, [active, step, questions.length]);

  useEffect(() => {
    if (!active || !profile) return;
    setData((current) => ({
      ...current,
      fullName: current.fullName || profile.name || '',
      instagram: current.instagram || normalizeInstagram(profile.instagram_id),
      website: current.website || profile.website || '',
      readingSince: current.readingSince || (profile.reading_since == null ? '' : String(profile.reading_since)),
      booksThisMonth: current.booksThisMonth || (profile.books_read_this_month == null ? '' : String(profile.books_read_this_month)),
      totalBooksRead: current.totalBooksRead || (profile.total_books_read == null ? '' : String(profile.total_books_read)),
      favoriteBook: current.favoriteBook || profile.favorite_book || '',
      favoriteAuthor: current.favoriteAuthor || profile.favorite_author || '',
      favoriteGenre: current.favoriteGenre || profile.favorite_genre || '',
      answers: Object.keys(current.answers).length ? current.answers : (profile.profile_answers || {}),
    }));
  }, [active, profile]);

  // Keep an onboarding instance alive after Step 1 establishes a session. The
  // initial eligibility check happens while the visitor is a guest; once the
  // account is created, the remaining onboarding steps must continue.
  const isContinuingAfterSignup = active && startedAsGuest;
  if (!active || (!isContinuingAfterSignup && user)) return null;

  const setStepError = (message: string) => { setError(message); setInfo(null); };

  const saveProfilePatch = async (fields: Parameters<typeof updateProfile>[1]) => {
    if (!user) throw new Error('Please sign in to continue.');
    await updateProfile(user.id, fields);
    await refreshProfile();
  };

  const completeStep1 = async () => {
    setSaving(true);
    setStepError('');
    try {
      const name = data.fullName.trim();
      const email = data.email.trim().toLowerCase();
      if (authMode === 'signup' && !name) throw new Error('Please enter your full name.');
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email address.');
      if (!data.password || data.password.length < 6) throw new Error('Password must be at least 6 characters.');

      if (authMode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: data.password });
        if (signInError) throw signInError;
        setInfo('Signed in. Let’s finish your reader profile.');
      } else {
        const { data: authResult, error: signUpError } = await supabase.auth.signUp({
          email,
          password: data.password,
          options: { data: { full_name: name, display_name: name }, emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL || '/'}` },
        });
        if (signUpError) throw signUpError;
        if (!authResult.session) {
          if (Array.isArray(authResult.user?.identities) && authResult.user.identities.length === 0) {
            setStepError('This email already has an account. Sign in instead, or use Continue with Google.');
            setAuthMode('signin');
            return;
          }
          setInfo('Your account was created. Click the confirmation link we emailed you (check spam too), then come back and sign in to continue.');
          setAuthMode('signin');
          return;
        }
        setInfo('Account created. Let’s build your reader card.');
      }

      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('Your session could not be created. Please try signing in again.');
      const signedInName = name || profile?.name || null;
      patch({ email, fullName: signedInName || '', password: '' });
      await saveProfilePatch({ ...(signedInName ? { name: signedInName } : {}), email });
      setStep(2);
      setError(null);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setSaving(false);
    }
  };

  const completeSocials = async () => {
    if (!user) { setStepError('Please sign in to continue.'); return; }
    setSaving(true);
    setStepError('');
    try {
      const socialLinks = [
        { platform: 'goodreads', url: normalizeHttpUrl(data.goodreads) },
        { platform: 'x', url: normalizeHttpUrl(data.xHandle) },
      ].filter((item) => item.url);
      if (data.website.trim()) socialLinks.push({ platform: 'website', url: normalizeHttpUrl(data.website) });
      if (data.instagram.trim()) socialLinks.push({ platform: 'instagram', url: `https://instagram.com/${normalizeHandle(data.instagram)}` });
      await saveProfilePatch({
        instagram_id: normalizeInstagram(data.instagram) || null,
        website: normalizeHttpUrl(data.website) || null,
        social_links: socialLinks,
      });
      setStep(3);
      setInfo(null);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not save your social links.');
    } finally {
      setSaving(false);
    }
  };

  const completeReadingJourney = async () => {
    if (!user) { setStepError('Please sign in to continue.'); return; }
    setSaving(true);
    setStepError('');
    try {
      const currentYear = new Date().getFullYear();
      const readingSince = data.readingSince.trim() ? Number(data.readingSince) : null;
      if (readingSince !== null && (!Number.isInteger(readingSince) || readingSince < 1900 || readingSince > currentYear)) {
        throw new Error(`Reading Since must be a year between 1900 and ${currentYear}.`);
      }
      const numeric = (value: string, max: number) => value.trim() === '' ? null : Math.max(0, Math.min(max, Number(value) || 0));
      await saveProfilePatch({
        reading_since: readingSince,
        books_read_this_month: numeric(data.booksThisMonth, 10000),
        total_books_read: numeric(data.totalBooksRead, 100000),
        favorite_book: data.favoriteBook.trim() || null,
        favorite_author: data.favoriteAuthor.trim() || null,
        favorite_genre: data.favoriteGenre.trim() || null,
      });
      setStep(4);
      setInfo(null);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not save your reading journey.');
    } finally {
      setSaving(false);
    }
  };

  const answeredQuestions = useMemo(() => {
    return selectedQuestionKeys
      .map((key) => questions.find((q) => q.key === key))
      .filter((question): question is ProfileQuestion => !!question && (question.type === 'image_upload' ? Array.isArray(data.answers[question.key]) && (data.answers[question.key] as unknown[]).length > 0 : getQuestionValue(question, data.answers).trim() !== ''));
  }, [data.answers, questions, selectedQuestionKeys]);

  const toggleQuestion = (key: string) => {
    setSelectedQuestionKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (current.length >= 3) return current;
      return [...current, key];
    });
  };

  const completeProfileQuestions = async () => {
    if (!user) { setStepError('Please sign in to continue.'); return; }
    if (answeredQuestions.length < 1) {
      setStepError('Answer at least one prompt, or use Skip to finish this part later.');
      return;
    }
    setSaving(true);
    setStepError('');
    try {
      await saveProfilePatch({ profile_answers: data.answers });
      setStep(5);
      setInfo(null);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not save your profile answers.');
    } finally {
      setSaving(false);
    }
  };

  const skipStep = () => {
    if (step === 4) setStep(5);
    else if (step < TOTAL_STEPS) setStep(step + 1);
    else closeAndRemember();
    setError(null);
    setInfo(null);
  };

  const finishTo = (path?: string) => {
    markDismissed();
    setActive(false);
    if (path) navigate(path);
  };

  const profilePreview = useMemo(() => ({
    name: data.fullName.trim() || profile?.name || 'Your Reader Name',
    username: profile?.novelty_username || null,
    avatarUrl: profile?.avatar_url || null,
    headerImageUrl: profile?.header_image_url || null,
    socialLinks: profile?.social_links || [],
    instagram: normalizeInstagram(data.instagram || profile?.instagram_id),
    booksThisMonth: data.booksThisMonth.trim() ? Number(data.booksThisMonth) : profile?.books_read_this_month ?? null,
    totalBooksRead: data.totalBooksRead.trim() ? Number(data.totalBooksRead) : profile?.total_books_read ?? null,
    publishedBooks: 0,
    avgRating: null,
    readingSince: data.readingSince.trim() ? Number(data.readingSince) : profile?.reading_since ?? null,
    favoriteBook: data.favoriteBook.trim() || profile?.favorite_book || null,
    favoriteAuthor: data.favoriteAuthor.trim() || profile?.favorite_author || null,
    favoriteGenre: data.favoriteGenre.trim() || profile?.favorite_genre || null,
    publishedReviews: [],
    answers: data.answers,
    questions,
  }), [data, profile, questions]);

  const headerTitle = [
    'Build your reader profile',
    'Connect Your Socials',
    'Your Reading Journey',
    'Behind Your Reading Life',
    '🎉 You’re Officially Set Up!',
  ][step - 1];

  const headerSubtitle = [
    'A few details now make the rest of Novelty Library feel like yours.',
    'Optional links help readers discover you beyond Novelty Library.',
    'Tell us what your reading life looks like — you can change everything later.',
    'Choose up to three prompts and make your reader card feel unmistakably yours.',
    'All your details and answers have been woven directly into your personal reader card.',
  ][step - 1];

  const modalMotion = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8, scale: 0.985 } };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="nl-onboarding-title">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" aria-hidden="true" />
      <div className="relative min-h-full px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center sm:min-h-[calc(100vh-5rem)]">
          <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-white/90 shadow-[0_30px_100px_rgba(0,15,25,.35)] backdrop-blur-xl dark:bg-slate-950/90"
          >
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-400/10" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-400/10" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/45 via-transparent to-cyan-100/20 dark:from-white/[0.04] dark:to-cyan-500/[0.03]" />
            </div>

            <div className="relative border-b border-teal-700/10 px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-200">
                    <Sparkles className="h-3.5 w-3.5" /> {step === 1 ? 'Before you sign up' : 'Your Novelty setup'}
                  </div>
                  <h2 id="nl-onboarding-title" className="font-serif text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">{headerTitle}</h2>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{headerSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={closeAndRemember}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-900/10 bg-white/80 text-slate-700 transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  aria-label="Skip onboarding"
                  title="Skip onboarding"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 flex items-center gap-2" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
                {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
                  const n = index + 1;
                  return (
                    <div key={n} className="flex flex-1 items-center gap-2">
                      <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${n <= step ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                      {n === step && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Step {step} of {TOTAL_STEPS}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
              <AnimatePresence mode="wait" initial={false}>
                {step === 1 && (
                  <motion.div key="step-1" {...modalMotion} transition={{ duration: reduceMotion ? 0 : 0.25 }} className="space-y-5">
                    <button
                      type="button"
                      onClick={() => { setStepError(''); void signInWithGoogle().catch((err) => setStepError(err instanceof Error ? err.message : 'Google sign-in failed.')); }}
                      className="btn-ghost w-full justify-center gap-3 border border-slate-900/10 dark:border-white/10"
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
                      Continue with Google
                    </button>
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">or {authMode === 'signup' ? 'create an account' : 'sign in'} with email</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full Name" required={authMode === 'signup'} icon={<UserPlus className="h-4 w-4" />}>
                        <input value={data.fullName} onChange={(e) => patch({ fullName: e.target.value })} placeholder="Jane Doe" className="input-field" autoComplete="name" autoFocus />
                      </Field>
                      <Field label="Email Address" required icon={<Mail className="h-4 w-4" />}>
                        <input value={data.email} onChange={(e) => patch({ email: e.target.value })} placeholder="jane@example.com" type="email" className="input-field" autoComplete="email" />
                      </Field>
                    </div>
                    <Field label="Password" required icon={<LogIn className="h-4 w-4" />}>
                      <input value={data.password} onChange={(e) => patch({ password: e.target.value })} placeholder="At least 6 characters" type="password" className="input-field" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} />
                    </Field>

                    <div className="rounded-2xl border border-cyan-700/10 bg-cyan-50/70 p-4 dark:border-cyan-400/10 dark:bg-cyan-500/[0.06]">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950 shadow-lg"><BookOpen className="h-5 w-5" /></div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Your account is the key to everything here.</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">Create once, then save drafts, follow readers, reserve books, publish reviews, and keep your reading card in one place.</p>
                        </div>
                      </div>
                    </div>

                    {error && <InlineMessage kind="error">{error}</InlineMessage>}
                    {info && <InlineMessage kind="info">{info}</InlineMessage>}

                    <div className="flex flex-col gap-3 border-t border-slate-900/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={() => { setAuthMode((m) => m === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null); }} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">
                        {authMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'} <ArrowRight className="h-4 w-4" />
                      </button>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button type="button" onClick={closeAndRemember} className="btn-ghost">Skip for now</button>
                        <button type="button" onClick={() => void completeStep1()} disabled={saving} className="btn-primary min-w-36 disabled:opacity-50">
                          {saving ? 'Working…' : authMode === 'signup' ? 'Create Account' : 'Sign In'} <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step-2" {...modalMotion} transition={{ duration: reduceMotion ? 0 : 0.25 }} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Instagram Handle" icon={<Instagram className="h-4 w-4" />} hint="Optional">
                        <div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-teal-700 dark:text-teal-300">@</span><input value={normalizeHandle(data.instagram)} onChange={(e) => patch({ instagram: e.target.value.replace(/^@/, '') })} placeholder="noveltyreader" className="input-field pl-8" autoComplete="off" /></div>
                      </Field>
                      <Field label="Goodreads Profile URL" icon={<Link2 className="h-4 w-4" />} hint="Optional">
                        <input value={data.goodreads} onChange={(e) => patch({ goodreads: e.target.value })} placeholder="goodreads.com/user/…" type="url" className="input-field" />
                      </Field>
                      <Field label="X / Twitter Handle" icon={<AtSign className="h-4 w-4" />} hint="Optional">
                        <div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-teal-700 dark:text-teal-300">@</span><input value={normalizeHandle(data.xHandle)} onChange={(e) => patch({ xHandle: e.target.value.replace(/^@/, '') })} placeholder="yourhandle" className="input-field pl-8" /></div>
                      </Field>
                      <Field label="Website / Other Link" icon={<Globe2 className="h-4 w-4" />} hint="Optional">
                        <input value={data.website} onChange={(e) => patch({ website: e.target.value })} placeholder="yourwebsite.com" type="url" className="input-field" />
                      </Field>
                    </div>

                    {error && <InlineMessage kind="error">{error}</InlineMessage>}
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-900/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={closeAndRemember} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Skip</button>
                      <div className="flex gap-2 sm:justify-end"><button type="button" onClick={() => setStep(1)} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</button><button type="button" onClick={() => void completeSocials()} disabled={saving} className="btn-primary min-w-28 disabled:opacity-50">{saving ? 'Saving…' : 'Next'} <ArrowRight className="h-4 w-4" /></button></div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step-3" {...modalMotion} transition={{ duration: reduceMotion ? 0 : 0.25 }} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Reading Since (Year / Era)" icon={<CalendarDays className="h-4 w-4" />} hint="Optional">
                        <input value={data.readingSince} onChange={(e) => patch({ readingSince: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="2024" inputMode="numeric" className="input-field" />
                      </Field>
                      <Field label="Books Read This Month" icon={<BookOpen className="h-4 w-4" />} hint="Optional">
                        <input value={data.booksThisMonth} onChange={(e) => patch({ booksThisMonth: e.target.value.replace(/\D/g, '') })} placeholder="4" inputMode="numeric" className="input-field" />
                      </Field>
                      <Field label="Total Books Read" icon={<BookOpen className="h-4 w-4" />} hint="Estimated · Optional">
                        <input value={data.totalBooksRead} onChange={(e) => patch({ totalBooksRead: e.target.value.replace(/\D/g, '') })} placeholder="102" inputMode="numeric" className="input-field" />
                      </Field>
                      <Field label="Favorite Book" icon={<BookOpen className="h-4 w-4" />} hint="Optional">
                        <input value={data.favoriteBook} onChange={(e) => patch({ favoriteBook: e.target.value })} placeholder="The book you’d reread tomorrow" className="input-field" />
                      </Field>
                      <Field label="Favorite Author" icon={<PenLine className="h-4 w-4" />} hint="Optional">
                        <input value={data.favoriteAuthor} onChange={(e) => patch({ favoriteAuthor: e.target.value })} placeholder="An author you keep returning to" className="input-field" />
                      </Field>
                      <Field label="Favorite Genre" icon={<ChevronDown className="h-4 w-4" />} hint="Optional">
                        <select value={data.favoriteGenre} onChange={(e) => patch({ favoriteGenre: e.target.value })} className="input-field"><option value="">Choose a genre…</option>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select>
                      </Field>
                    </div>
                    {error && <InlineMessage kind="error">{error}</InlineMessage>}
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-900/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={closeAndRemember} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Skip</button>
                      <div className="flex gap-2 sm:justify-end"><button type="button" onClick={() => setStep(2)} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</button><button type="button" onClick={() => void completeReadingJourney()} disabled={saving} className="btn-primary min-w-28 disabled:opacity-50">{saving ? 'Saving…' : 'Next'} <ArrowRight className="h-4 w-4" /></button></div>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div key="step-4" {...modalMotion} transition={{ duration: reduceMotion ? 0 : 0.25 }} className="space-y-5">
                    <div className="rounded-2xl border border-teal-700/10 bg-teal-50/70 p-4 dark:border-teal-400/10 dark:bg-teal-500/[0.06]">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Answer 1–3 prompts</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">Tap a prompt to open its answer box. You can keep your answers short — these are profile details, not essays.</p>
                    </div>
                    {loadingQuestions ? (
                      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300/70 p-10 text-sm text-slate-500 dark:border-slate-700">Loading your reading-life prompts…</div>
                    ) : (
                      <div className="grid gap-3">
                        {questions.slice(0, 8).map((question) => {
                          const selected = selectedQuestionKeys.includes(question.key);
                          return (
                            <div key={question.id} className={`rounded-2xl border p-4 transition ${selected ? 'border-teal-500/40 bg-teal-50/60 dark:bg-teal-500/[0.06]' : 'border-slate-900/10 bg-white/55 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                              <button type="button" onClick={() => toggleQuestion(question.key)} className="flex w-full items-center justify-between gap-3 text-left">
                                <span className="flex min-w-0 items-center gap-3"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${selected ? 'border-teal-500 bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950' : 'border-slate-300 text-transparent dark:border-slate-700'}`}>{selected ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />}</span><span className="text-sm font-semibold text-slate-900 dark:text-white">{question.question}</span></span>
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-400">{selected ? 'Selected' : 'Choose'}</span>
                              </button>
                              {selected && (
                                <div className="mt-3 pl-10">
                                  <ProfileQuestionAnswer question={question} value={data.answers[question.key]} userId={user.id} onChange={(value) => patch({ answers: { ...data.answers, [question.key]: value } })} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedQuestionKeys.length >= 3 && <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">You’ve selected the maximum of 3 prompts.</p>}
                    {error && <InlineMessage kind="error">{error}</InlineMessage>}
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-900/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={closeAndRemember} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Skip</button>
                      <div className="flex gap-2 sm:justify-end"><button type="button" onClick={() => setStep(3)} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</button><button type="button" onClick={() => void completeProfileQuestions()} disabled={saving || loadingQuestions} className="btn-primary min-w-28 disabled:opacity-50">{saving ? 'Saving…' : 'Next'} <ArrowRight className="h-4 w-4" /></button></div>
                    </div>
                  </motion.div>
                )}

                {step === 5 && (
                  <motion.div key="step-5" {...modalMotion} transition={{ duration: reduceMotion ? 0 : 0.25 }} className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-start">
                      <div className="rounded-[1.75rem] border border-teal-700/10 bg-gradient-to-br from-slate-950 to-teal-950 p-5 text-white shadow-xl dark:border-cyan-400/10">
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                            {profilePreview.avatarUrl ? <img src={profilePreview.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-serif text-xl font-bold">{(profilePreview.name || 'Y').slice(0, 1).toUpperCase()}</span>}
                          </div>
                          <div className="min-w-0"><p className="font-serif text-xl font-semibold truncate">{profilePreview.name}</p><p className="mt-0.5 text-xs text-white/60">Your Novelty Library reader card</p></div>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <PreviewStat label="This month" value={data.booksThisMonth || '—'} />
                          <PreviewStat label="Books read" value={data.totalBooksRead || '—'} />
                          <PreviewStat label="Since" value={data.readingSince || '—'} />
                          <PreviewStat label="Genre" value={data.favoriteGenre || '—'} />
                        </div>
                        {(data.favoriteBook || data.favoriteAuthor) && <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">Reading identity</p>{data.favoriteBook && <p className="mt-1 font-serif text-base font-semibold">{data.favoriteBook}</p>}{data.favoriteAuthor && <p className="text-xs text-white/65">by {data.favoriteAuthor}</p>}</div>}
                        {answeredQuestions.length > 0 && <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">Profile prompts</p><span className="text-[10px] font-bold text-white/45">{answeredQuestions.length}/3</span></div><div className="mt-2 flex flex-wrap gap-1.5">{answeredQuestions.map((q) => <span key={q.id} className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{q.question}</span>)}</div></div>}
                      </div>

                      <div className="rounded-[1.75rem] border border-cyan-700/10 bg-cyan-50/60 p-5 dark:border-cyan-400/10 dark:bg-cyan-500/[0.05]">
                        <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950"><Eye className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-900 dark:text-white">A card you can keep.</p><p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">Your profile uses the same visual language as the full Novelty Library ProfileCard, so the setup you just completed carries straight into your public reader identity.</p></div></div>
                        <div className="mt-4 hidden rounded-2xl border border-teal-700/10 bg-white/80 p-4 shadow-sm sm:block dark:bg-slate-950/50">
                          <div className="flex items-center gap-3">
                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-teal-500/20 bg-gradient-to-br from-cyan-100 to-teal-100 font-serif text-lg font-bold text-teal-800 dark:from-cyan-500/10 dark:to-teal-500/10 dark:text-cyan-200">
                              {profilePreview.avatarUrl ? <img src={profilePreview.avatarUrl} alt="" className="h-full w-full object-cover" /> : (profilePreview.name || 'Y').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-serif text-base font-semibold text-slate-900 dark:text-white">{profilePreview.name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profilePreview.instagram ? `@${normalizeInstagram(profilePreview.instagram)}` : 'Novelty Library reader'}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <PreviewStat label="This month" value={data.booksThisMonth || '—'} />
                            <PreviewStat label="Books" value={data.totalBooksRead || '—'} />
                            <PreviewStat label="Since" value={data.readingSince || '—'} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-900/10 pt-5 dark:border-white/10">
                      <button type="button" onClick={() => finishTo('/profile')} className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_28px_rgba(20,184,166,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(20,184,166,.38)]"><Sparkles className="h-4 w-4 transition group-hover:rotate-12" /> View My Profile Card <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
                      <button type="button" onClick={() => finishTo('/submit')} className="btn-primary w-full"><PenLine className="h-4 w-4" /> Write Your First Review</button>
                      <button type="button" onClick={() => finishTo()} className="btn-ghost w-full">Explore Library</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, icon, hint, children }: { label: string; required?: boolean; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-300">{icon}<span>{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{hint ? <span className="ml-auto text-[9px] font-medium tracking-normal text-slate-400">{hint}</span> : null}</span>
      {children}
    </label>
  );
}

function InlineMessage({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${kind === 'error' ? 'border-rose-400/25 bg-rose-50 text-rose-700 dark:bg-rose-500/[0.08] dark:text-rose-200' : 'border-cyan-400/20 bg-cyan-50 text-cyan-900 dark:bg-cyan-500/[0.06] dark:text-cyan-100'}`}>{children}</div>;
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">{label}</p><p className="mt-1 font-serif text-lg font-semibold truncate">{value}</p></div>;
}
