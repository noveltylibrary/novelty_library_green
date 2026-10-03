import { supabase } from '@/lib/supabase';

/**
 * v3.1: single Supabase client.
 *
 * The community shelf (`community_reviews`) is served by the SAME Supabase
 * project as the rest of the app (see fetchReviews in src/lib/reviews.ts), so
 * this module no longer calls createClient() a second time. A second client
 * would spin up a second GoTrueClient on the same browser storage key, which
 * is what causes the "Multiple GoTrueClient instances" warning and lets auth
 * tokens drift out of sync (one instance refreshes, the other keeps a stale
 * refresh token).
 *
 * Existing imports of `communitySupabase` keep working — it is the very same
 * object as `supabase`.
 */
export const communitySupabase = supabase;
