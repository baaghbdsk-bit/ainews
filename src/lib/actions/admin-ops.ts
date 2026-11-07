'use server';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import { getSessionUser } from '@/lib/auth/session-server';
import { isAdmin } from '@/lib/auth/editor';
import { runIngest } from '@/lib/feeds/ingest';
import { revalidatePath, revalidateTag } from 'next/cache';
import { AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';
import { STORIES_TAG } from '@/lib/cache-tags';

export interface AdminOpResult {
  ok: boolean;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastSignInAt?: string;
  provider: string;
  emailVerified: boolean;
}

function getAdminClient(): SupabaseClient | null {
  try {
    const url = supabaseUrl();
    const key = supabaseServiceRoleKey();
    if (!url || !key) return null;
    return createSupabaseClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

export async function adminTriggerIngest(mode?: 'full' | 'enrich' | 'summarize' | 'images'): Promise<AdminOpResult> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return { ok: false, message: 'Forbidden: Admin access required', timestamp: new Date().toISOString() };
  }

  try {
    const res = await runIngest({
      enrichOnly: mode === 'enrich',
      summarizeOnly: mode === 'summarize',
      imagesOnly: mode === 'images',
    });

    revalidateTag(AI_NEWS_TAG, 'max');
    revalidateTag(STORIES_TAG, 'max');
    revalidatePath('/');

    return {
      ok: true,
      message: `Ingestion completed successfully: ${res.newItems} new stories ingested, ${res.fetched} fetched, ${res.enriched} enriched.`,
      data: res,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Ingestion failed.',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function adminTriggerRevalidate(): Promise<AdminOpResult> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return { ok: false, message: 'Forbidden: Admin access required', timestamp: new Date().toISOString() };
  }

  try {
    revalidatePath('/');
    revalidatePath('/explore');
    revalidatePath('/latest');
    revalidatePath('/benchmarks');
    revalidateTag(AI_NEWS_TAG, 'max');
    revalidateTag(STORIES_TAG, 'max');

    return {
      ok: true,
      message: 'Global edge cache purged and revalidated across all routes and tags.',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Revalidation failed.',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function adminListUsers(): Promise<{ ok: boolean; users: AdminUserItem[]; error?: string }> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return { ok: false, users: [], error: 'Forbidden: Admin access required' };
  }

  const admin = getAdminClient();
  if (!admin) {
    return { ok: false, users: [], error: 'Server configuration missing' };
  }

  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) {
      return { ok: false, users: [], error: error.message };
    }

    const users: AdminUserItem[] = (data?.users ?? []).map((u) => {
      const isUserAdmin = u.app_metadata?.role === 'admin' || u.app_metadata?.role === 'editor';
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const displayName =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        u.email?.split('@')[0] ||
        'User';
      const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined;
      const provider =
        (typeof u.app_metadata?.provider === 'string' && u.app_metadata.provider) ||
        ((u.app_metadata?.providers as string[])?.[0]) ||
        'email';

      return {
        id: u.id,
        email: u.email ?? 'No email',
        fullName: displayName,
        avatarUrl: avatar,
        role: isUserAdmin ? 'admin' : 'user',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? undefined,
        provider,
        emailVerified: Boolean(u.email_confirmed_at || meta.neubench_email_verified === true),
      };
    });

    return { ok: true, users };
  } catch (err) {
    return { ok: false, users: [], error: err instanceof Error ? err.message : 'Failed to list users.' };
  }
}

export async function adminSetUserRole(targetUserId: string, newRole: 'admin' | 'user'): Promise<AdminOpResult> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return { ok: false, message: 'Forbidden: Admin access required', timestamp: new Date().toISOString() };
  }

  // Prevent self-lockout
  if (user.id === targetUserId && newRole !== 'admin') {
    return {
      ok: false,
      message: 'You cannot revoke your own administrator privileges.',
      timestamp: new Date().toISOString(),
    };
  }

  const admin = getAdminClient();
  if (!admin) {
    return { ok: false, message: 'Server configuration missing', timestamp: new Date().toISOString() };
  }

  try {
    const { data: targetUser, error: fetchErr } = await admin.auth.admin.getUserById(targetUserId);
    if (fetchErr || !targetUser?.user) {
      return { ok: false, message: 'Target user not found', timestamp: new Date().toISOString() };
    }

    const currentAppMeta = targetUser.user.app_metadata || {};
    const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
      app_metadata: {
        ...currentAppMeta,
        role: newRole,
      },
    });

    if (updateErr) {
      return { ok: false, message: updateErr.message, timestamp: new Date().toISOString() };
    }

    // Also update public.profiles if table exists
    try {
      await admin.from('profiles').upsert({
        id: targetUserId,
        role: newRole,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Ignored if profiles table does not have role column yet
    }

    return {
      ok: true,
      message: `User ${targetUser.user.email} is now a ${newRole.toUpperCase()}.`,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to update user role.',
      timestamp: new Date().toISOString(),
    };
  }
}
