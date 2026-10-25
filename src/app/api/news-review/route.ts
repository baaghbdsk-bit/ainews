import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session-server';
import { isAdmin } from '@/lib/auth/editor';
import {
  applyNewsReviewAction,
  getNewsReviewFeed,
  type NewsReviewStatus,
} from '@/lib/admin/news-review';
import { jsonNoStore, zodDetails } from '@/lib/supabase/api-guard';

const StatusSchema = z.enum(['pending', 'approved', 'rejected', 'deferred', 'duplicate', 'all']);
const ActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'defer', 'duplicate']),
  reason: z.string().trim().max(2000).optional().nullable(),
  duplicateOf: z.string().trim().min(1).max(200).optional().nullable(),
});

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { user: null, response: jsonNoStore({ error: 'Sign in required.' }, { status: 401 }) };
  if (!isAdmin(user)) return { user: null, response: jsonNoStore({ error: 'Administrator access required.' }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get('status') ?? 'all';
  const statusParsed = StatusSchema.safeParse(statusRaw);
  if (!statusParsed.success) {
    return jsonNoStore({ error: 'Invalid status filter.' }, { status: 400 });
  }
  const status = statusParsed.data as NewsReviewStatus | 'all';
  const search = searchParams.get('search') ?? '';
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '25');

  const feed = await getNewsReviewFeed({
    status,
    search,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  });

  return jsonNoStore(feed);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const user = auth.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid review action.', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const result = await applyNewsReviewAction({
    id: parsed.data.id,
    action: parsed.data.action,
    reason: parsed.data.reason,
    duplicateOf: parsed.data.duplicateOf,
    reviewerId: user.id,
    reviewerEmail: user.email ?? null,
  });

  if (result.error) {
    return jsonNoStore({ error: result.error }, { status: 400 });
  }

  return jsonNoStore({ candidate: result.candidate, message: 'Review decision saved.' });
}
