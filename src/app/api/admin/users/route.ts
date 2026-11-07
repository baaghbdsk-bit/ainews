import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session-server';
import { isAdmin } from '@/lib/auth/editor';
import { getAdminUsersList, updateAdminUserRole } from '@/lib/admin/users';
import { jsonNoStore, zodDetails } from '@/lib/supabase/api-guard';

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, response: jsonNoStore({ error: 'Sign in required.' }, { status: 401 }) };
  }
  if (!isAdmin(user)) {
    return { user: null, response: jsonNoStore({ error: 'Administrator access required.' }, { status: 403 }) };
  }
  return { user, response: null };
}

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'user']),
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const users = await getAdminUsersList();
    return jsonNoStore({ ok: true, users });
  } catch (err) {
    return jsonNoStore({ ok: false, error: err instanceof Error ? err.message : 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const caller = auth.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = UpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore({ error: 'Invalid parameters', details: zodDetails(parsed.error) }, { status: 400 });
  }

  const { userId, role } = parsed.data;
  const result = await updateAdminUserRole(userId, role, caller.id);

  if (!result.ok) {
    return jsonNoStore({ ok: false, error: result.message }, { status: 400 });
  }

  return jsonNoStore({ ok: true, message: result.message });
}
