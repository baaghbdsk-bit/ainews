import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/** Only ever send the reader to a path on this site. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/**
 * Where Supabase sends the reader back after a magic link, an email
 * confirmation, or an OAuth callback.
 *
 * A link opened in the same browser arrives as a `code` (PKCE). A link opened
 * elsewhere - the usual case for email - cannot exchange a code it does not
 * have the verifier for, so the token hash is verified instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(searchParams.get('next'));
  const isRecovery = type === 'recovery' || next.startsWith('/auth/reset-password');

  const failure = () =>
    NextResponse.redirect(
      isRecovery ? `${origin}/auth/reset-password?error=expired` : `${origin}/`,
    );

  // Supabase reports an expired or already-used link as query params rather
  // than a code, so there is nothing to exchange.
  if (searchParams.get('error') || searchParams.get('error_code')) {
    return failure();
  }

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  } catch {
    // Fall through to the failure destination below.
  }

  return failure();
}
