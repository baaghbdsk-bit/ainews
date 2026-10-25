import type { User } from '@supabase/supabase-js';

export function isEditor(user: User | null): user is User {
  return user?.app_metadata?.role === 'editor';
}
export function isAdmin(user: User | null): user is User {
  return user?.app_metadata?.role === 'admin' || user?.app_metadata?.role === 'editor';
}
