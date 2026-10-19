import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * The ONE Supabase client (and therefore the one GoTrueClient) for the whole
 * app. Never call createClient() anywhere else — import `supabase` from here.
 * `src/lib/communitySupabase.ts` re-exports this same instance.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
