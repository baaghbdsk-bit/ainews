import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * Small HTTP guards shared by the public API routes.
 *
 * The rate limiter is deliberately in-memory: this app runs as a single
 * serverless region and these routes are low-volume. It is best-effort, not a
 * distributed guarantee — a cold start or a second instance has its own window.
 */

export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export interface JsonInit {
  status?: number;
  headers?: Record<string, string>;
}

export function jsonNoStore(data: unknown, init: JsonInit = {}): NextResponse {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: { ...NO_STORE_HEADERS, ...init.headers },
  });
}

/** Best-effort client address; Vercel sets x-forwarded-for at the edge. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 5_000;

function prune(now: number, windowMs: number) {
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((at) => at > now - windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

/** Sliding-window limiter. Returns whether this call is inside the budget. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) prune(now, windowMs);

  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((at) => at > cutoff);

  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, hits);
    return { allowed: false, retryAfterSeconds };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return jsonNoStore(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

export function zodDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

const MAX_JSON_BYTES = 32 * 1024;

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

/** Parse a JSON object body, rejecting wrong media types and malformed JSON. */
export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const contentType = request.headers.get('content-type') ?? '';
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    return {
      ok: false,
      response: jsonNoStore(
        { error: 'Content-Type must be application/json' },
        { status: 415 },
      ),
    };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 }) };
  }

  if (!raw.trim()) {
    return { ok: false, response: jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) {
    return {
      ok: false,
      response: jsonNoStore({ error: 'Request body is too large' }, { status: 400 }),
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, response: jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 }) };
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, response: jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 }) };
  }

  return { ok: true, body };
}

/**
 * Constant-time bearer check. Requiring the `Bearer` prefix keeps the shape the
 * same for both cron routes and avoids accidentally comparing a raw token.
 */
export function bearerMatches(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;

  const provided = Buffer.from(match[1].trim(), 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  if (provided.length !== expected.length) {
    // Keep the comparison cost independent of how close the length was.
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(provided, expected);
}

export interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/** True when the table/function has not been migrated yet (dev fallback). */
export function isMissingSchemaError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code)) return true;
  return /(relation|table|function).*(does not exist|not found)|could not find the (table|function)/i.test(
    error.message ?? '',
  );
}

/** True when a specific column is absent, so the caller can retry without it. */
export function isMissingColumnError(
  error: PostgrestErrorLike | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (code === '42703' || code === 'PGRST204') return true;
  return new RegExp(`column .*${column}.* does not exist|could not find the .*${column}.* column`, 'i').test(
    error.message ?? '',
  );
}

export function isMissingFunctionError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (['42883', 'PGRST202'].includes(code)) return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? '');
}

export function isStoryMissingError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (code === '23503' || code === 'P0002') return true;
  return /story_not_found|violates foreign key constraint/i.test(error.message ?? '');
}

export function isUniqueViolation(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key value/i.test(error.message ?? '');
}
