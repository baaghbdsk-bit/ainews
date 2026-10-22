import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import {
  clientIp,
  jsonNoStore,
  rateLimit,
  tooManyRequests,
  zodDetails,
} from '@/lib/supabase/api-guard';

const BodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(72),
});

/**
 * Create an account that can sign in immediately.
 *
 * The project has email confirmation on, which would otherwise park a new
 * reader on a "check your inbox" screen. Creating the user with the admin API
 * skips that wall; the account is marked unverified in its metadata, which is
 * what the profile shows, so no verification flow is implied.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`signup:${clientIp(request)}`, 5, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Send an email and password.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      {
        error: 'Enter a valid email and a password of at least 6 characters.',
        details: zodDetails(parsed.error),
      },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  try {
    const admin = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { neubench_email_verified: false },
    });

    if (error) {
      if (/already|exists|registered/i.test(error.message)) {
        return jsonNoStore(
          { error: 'An account with this email already exists. Sign in instead.' },
          { status: 409 },
        );
      }
      console.error('Signup failed:', error);
      return jsonNoStore({ error: 'Could not create the account. Try again.' }, { status: 500 });
    }

    return jsonNoStore({ ok: true, userId: data.user?.id ?? null }, { status: 201 });
  } catch (err) {
    console.error('Signup route error:', err);
    return jsonNoStore({ error: 'Could not create the account. Try again.' }, { status: 500 });
  }
}
