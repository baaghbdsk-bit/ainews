import type { User } from '@supabase/supabase-js';

// Designated admin accounts
const ADMIN_EMAILS = new Set([
  'baaghbdsk@gmail.com',
  ...(typeof process !== 'undefined' && process.env?.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase())
    : []),
]);

export function isEditor(user: User | null): user is User {
  if (!user) return false;
  if (user.app_metadata?.role === 'editor' || user.app_metadata?.role === 'admin') return true;
  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) return true;
  return false;
}

export function isAdmin(user: User | null): user is User {
  if (!user) return false;
  if (user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'editor') return true;
  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) return true;
  return false;
}
