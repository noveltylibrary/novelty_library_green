import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/review';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string, rawNonce: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  authLinkError: string | null;
  clearAuthLinkError: () => void;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  recovering: boolean;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpResult {
  /** True when Supabase created the account but is waiting for the user to click the email link. */
  needsConfirmation: boolean;
  /** True when the email already belongs to an account (Supabase hides this by returning no identities). */
  alreadyRegistered: boolean;
}

/** Where Supabase should send people after they click an email link or finish Google sign-in. */
function siteUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
}

/**
 * Expired / reused email links come back as `#error=access_denied&error_code=otp_expired&error_description=...`.
 * Read it once, before anything rewrites the hash, so we can show a friendly message.
 */
function readLinkErrorFromUrl(): string | null {
  try {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const params = new URLSearchParams(raw.includes('=') ? raw : window.location.search.replace(/^\?/, ''));
    const code = params.get('error_code') || params.get('error');
    if (!code) return null;
    if (code === 'otp_expired') return 'That email link has expired or was already used. Request a new one below.';
    if (code === 'access_denied') return 'Sign-in was cancelled or the link is no longer valid. Please try again.';
    return params.get('error_description')?.replace(/\+/g, ' ') || 'We could not complete that sign-in. Please try again.';
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(() => readLinkErrorFromUrl());

  const checkAdmin = useCallback(async () => {
    const { data, error } = await supabase.rpc('is_admin');
    setIsAdmin(!error && data === true);
  }, []);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    let row = data as Profile | null;
    if (row && !row.name) {
      // The DB trigger creates the profile row without a name. For Google sign-ins, use the Google display name once.
      const { data: userData } = await supabase.auth.getUser();
      const meta = userData.user?.user_metadata ?? {};
      const googleName = String(meta.full_name || meta.name || meta.display_name || '').trim().slice(0, 120);
      if (googleName) {
        const { error: nameError } = await supabase.from('profiles').update({ name: googleName }).eq('id', uid);
        if (!nameError) row = { ...row, name: googleName };
      }
    }
    setProfile(row);
  }, []);

  useEffect(() => {
    // A broken/expired email link lands on the home route; move to the sign-in page where the message is shown.
    if (authLinkError) {
      try { window.history.replaceState(null, '', window.location.pathname); window.location.hash = '/auth'; } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user?.email) {
        checkAdmin();
      }
      if (data.session?.user?.id) {
        loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Arrived from the reset-password email: send the user to the set-new-password screen.
        setRecovering(true);
        try { window.location.hash = '/auth'; } catch { /* ignore */ }
      }
      (async () => {
        const newUserId = newSession?.user?.id ?? null;
        const newUserEmail = newSession?.user?.email ?? null;

        setSession((prev) => {
          const prevToken = prev?.access_token;
          const newToken = newSession?.access_token;
          if (prevToken && newToken && prevToken === newToken) return prev;
          return newSession;
        });

        setUser((prev) => {
          const prevId = prev?.id;
          if (prevId && newUserId && prevId === newUserId) return prev;
          return newSession?.user ?? null;
        });

        if (event === 'SIGNED_OUT' || (!newUserId)) {
          setIsAdmin(false);
          setProfile(null);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (newUserEmail) await checkAdmin();
          if (newUserId) await loadProfile(newUserId);
        }

        setLoading(false);
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [checkAdmin, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: siteUrl() },
    });
    if (error) throw error;
    // With "Confirm email" on, an already-registered address returns a user with an empty identities list.
    const alreadyRegistered = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
    return { needsConfirmation: !data.session && !alreadyRegistered, alreadyRegistered };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: siteUrl(), queryParams: { prompt: 'select_account' } },
    });
    if (error) throw error;
  }, []);

  /** Google Identity Services path: the account chooser shows our own site name instead of *.supabase.co. */
  const signInWithGoogleIdToken = useCallback(async (idToken: string, rawNonce: string) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce });
    if (error) throw error;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: siteUrl() },
    });
    if (error) throw error;
  }, []);

  const clearAuthLinkError = useCallback(() => setAuthLinkError(null), []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: siteUrl() });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const finishRecovery = useCallback(() => setRecovering(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, loading, signIn, signUp, signInWithGoogle, signInWithGoogleIdToken, resendConfirmation, authLinkError, clearAuthLinkError, resetPassword, updatePassword, recovering, finishRecovery, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
