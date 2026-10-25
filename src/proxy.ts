import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env';

/**
 * Optimistic gate for the admin console. The page repeats this check with
 * `getSessionUser()`; this proxy exists so a non-admin gets a redirect before
 * any admin render starts (and so a guest never sees the route's shell).
 *
 * Scoped to /admin only: running a session lookup on every request would add
 * latency to the public timeline for no benefit.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    if (data.user?.app_metadata?.role === 'admin') return response;
  } catch {
    // Fall through to the redirect: the page's own check is the secure one.
  }

  return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
