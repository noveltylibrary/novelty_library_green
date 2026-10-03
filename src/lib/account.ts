import { supabase } from '@/lib/supabase';

export async function deleteCurrentAccount(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: {},
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  await supabase.auth.signOut();
}
