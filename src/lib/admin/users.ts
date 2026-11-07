import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';

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

export async function getAdminUsersList(): Promise<AdminUserItem[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error || !data?.users) {
      console.error('Failed to list users from Supabase:', error);
      return [];
    }

    return data.users.map((u) => {
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
  } catch (err) {
    console.error('getAdminUsersList error:', err);
    return [];
  }
}

export async function updateAdminUserRole(
  targetUserId: string,
  newRole: 'admin' | 'user',
  callerId: string,
): Promise<{ ok: boolean; message: string }> {
  if (callerId === targetUserId && newRole !== 'admin') {
    return { ok: false, message: 'You cannot revoke your own administrator privileges.' };
  }

  const admin = getAdminClient();
  if (!admin) {
    return { ok: false, message: 'Supabase admin client not available.' };
  }

  try {
    const { data: targetUser, error: fetchErr } = await admin.auth.admin.getUserById(targetUserId);
    if (fetchErr || !targetUser?.user) {
      return { ok: false, message: 'Target user not found.' };
    }

    const currentAppMeta = targetUser.user.app_metadata || {};
    const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
      app_metadata: {
        ...currentAppMeta,
        role: newRole,
      },
    });

    if (updateErr) {
      return { ok: false, message: updateErr.message };
    }

    // Best-effort sync to public.profiles table
    try {
      await admin.from('profiles').upsert({
        id: targetUserId,
        role: newRole,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal if profiles table does not have role column
    }

    return {
      ok: true,
      message: `User ${targetUser.user.email} updated to ${newRole.toUpperCase()}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to update user role.',
    };
  }
}
