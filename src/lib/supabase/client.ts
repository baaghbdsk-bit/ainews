import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env';

export const createClient = (): ReturnType<typeof createBrowserClient<Database>> | null => {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
};
