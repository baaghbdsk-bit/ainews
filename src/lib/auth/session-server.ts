import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in user for the current request, or null for a guest.
 *
 * Uses the cookie-backed client, so the session comes from the request the
 * user actually made rather than anything the page can hand over.
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
