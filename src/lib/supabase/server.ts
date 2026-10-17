import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from './types';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(cookieStore.toString());
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware handling cookie updates.
          }
        },
      },
    }
  );
};
