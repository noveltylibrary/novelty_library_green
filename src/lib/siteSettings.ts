import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const DEFAULT_SUPPORT_EMAIL = 'support.noveltylibrary@gmail.com';

export async function fetchSupportEmail(): Promise<string> {
  const { data, error } = await supabase.rpc('get_site_support_email');
  if (error) return DEFAULT_SUPPORT_EMAIL;
  return typeof data === 'string' && data.trim() ? data.trim() : DEFAULT_SUPPORT_EMAIL;
}

export function useSupportEmail(): string {
  const [email, setEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    let active = true;
    fetchSupportEmail().then((value) => {
      if (active) setEmail(value);
    });
    return () => { active = false; };
  }, []);

  return email;
}

export async function updateSupportEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid support email address.');
  }
  const { error } = await supabase.rpc('set_site_support_email', { p_email: normalized });
  if (error) throw error;
}
