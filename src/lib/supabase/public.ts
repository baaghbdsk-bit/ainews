import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env';

/**
 * Cookie-free client for public reads.
 *
 * Unlike `@/lib/supabase/server`, this never touches `cookies()`, so it can be
 * called inside a `'use cache'` scope and skips the `@supabase/ssr` cookie
 * handshake on every request.
 *
 * Returns `null` when Supabase is not configured (missing/placeholder env), so
 * callers can degrade gracefully without throwing.
 */
export const createPublicClient = (): ReturnType<
  typeof createSupabaseClient<Database>
> | null => {
  if (!isSupabaseConfigured()) return null;
  return createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey());
};