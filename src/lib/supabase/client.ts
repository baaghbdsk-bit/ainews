import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

export const createClient = () =>
  createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
