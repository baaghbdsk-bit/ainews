import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Singleton Supabase browser client.
 *
 * Caching the client instance prevents multiple Web Lock acquisitions and
 * eliminate auth token storage contention, ensuring sub-second sign-in and session checks.
 */
export const createClient = (): ReturnType<typeof createBrowserClient<Database>> | null => {
  if (typeof window === 'undefined') return null;
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
};
