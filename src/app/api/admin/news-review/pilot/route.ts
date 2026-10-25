import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session-server';
import { isAdmin } from '@/lib/auth/editor';
import { jsonNoStore, zodDetails, rateLimit, tooManyRequests } from '@/lib/supabase/api-guard';
import { runDiscoveryPilot, isPilotEnabled } from '@/lib/discovery/pilot';

const PilotSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(100).optional().default(25),
  maxLimit: z.number().int().min(1).max(500).optional(),
  hours: z.number().int().min(1).max(72).optional().default(24),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
  queryIds: z.array(z.string().min(1).max(80)).max(20).optional(),
  validatePublishers: z.boolean().optional().default(true),
  includeHeld: z.boolean().optional().default(true),
  includeAccepted: z.boolean().optional().default(true),
  maxConcurrency: z.number().int().min(1).max(8).optional().default(4),
});

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { user: null, response: jsonNoStore({ error: 'Sign in required.' }, { status: 401 }) };
  if (!isAdmin(user)) return { user: null, response: jsonNoStore({ error: 'Administrator access required.' }, { status: 403 }) };
  return { user, response: null };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const limitResult = rateLimit('google-news-pilot:' + user.id, 10, 60 * 60 * 1000);
  if (!limitResult.allowed) return tooManyRequests(limitResult.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = PilotSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid pilot request.', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const dryRun = data.dryRun ?? true;

  if (!dryRun && !isPilotEnabled()) {
    return jsonNoStore(
      {
        error:
          'Google News pilot writes are disabled. Set GOOGLE_NEWS_PILOT_ENABLED=true to allow writes.',
      },
      { status: 403 },
    );
  }

  try {
    const result = await runDiscoveryPilot({
      dryRun,
      limit: data.limit,
      maxLimit: data.maxLimit,
      hours: data.hours,
      windowStart: data.windowStart,
      windowEnd: data.windowEnd,
      queryIds: data.queryIds,
      validatePublishers: data.validatePublishers,
      includeHeld: data.includeHeld,
      includeAccepted: data.includeAccepted,
      maxConcurrency: data.maxConcurrency,
    });

    if (!result.ok && result.error) {
      return jsonNoStore({ error: result.error, result }, { status: 400 });
    }
    return jsonNoStore(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pilot failed';
    console.error('[google-news-pilot] route failed:', message);
    return jsonNoStore({ error: 'Pilot failed' }, { status: 500 });
  }
}
