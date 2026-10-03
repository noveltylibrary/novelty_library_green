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
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (email: string | undefined) => {
    if (!email) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    setIsAdmin(!!data);
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
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user?.email) {
        checkAdmin(data.session.user.email);
      }
      if (data.session?.user?.id) {
        loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
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
          if (newUserEmail) await checkAdmin(newUserEmail);
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

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
