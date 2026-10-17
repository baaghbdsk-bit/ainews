import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

/**
 * Cookie-free client for public reads.
 *
 * Unlike `@/lib/supabase/server`, this never touches `cookies()`, so it can be
 * called inside a `'use cache'` scope and skips the `@supabase/ssr` cookie
 * handshake on every request.
 */
export const createPublicClient = () =>
  createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey());