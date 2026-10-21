import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import {
  clientIp,
  isMissingColumnError,
  isMissingSchemaError,
  jsonNoStore,
  rateLimit,
  readJsonBody,
  tooManyRequests,
  zodDetails,
} from '@/lib/supabase/api-guard';

export const VALID_CATEGORIES = [
  'bug',
  'accuracy',
  'quality',
  'ui_ux',
  'feature',
  'other',
] as const;

export type FeedbackCategory = (typeof VALID_CATEGORIES)[number];

const POST_LIMIT = 5;
const GET_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const MAX_METADATA_BYTES = 8 * 1024;

const TrimmedString = (min: number, max: number) =>
  z.string().transform((value) => value.trim()).pipe(z.string().min(min).max(max));

const FeedbackSchema = z
  .object({
    category: z.enum(VALID_CATEGORIES),
    comment: TrimmedString(3, 2000),
    email: z.string().trim().email().max(254).optional().or(z.literal('').transform(() => undefined)),
    clientId: TrimmedString(1, 128).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.metadata === undefined) return;
    const bytes = Buffer.byteLength(JSON.stringify(value.metadata), 'utf8');
    if (bytes > MAX_METADATA_BYTES) {
      ctx.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: `Metadata must be at most ${MAX_METADATA_BYTES} bytes.`,
      });
    }
  });

interface FeedbackRecord {
  id: string;
  category: FeedbackCategory;
  comment: string;
  email?: string;
  clientId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Development fallback only: used when the table is not migrated. */
const memoryFeedback: FeedbackRecord[] = [];

function getAdminClient(): SupabaseClient | null {
  try {
    const url = supabaseUrl();
    const serviceKey = supabaseServiceRoleKey();
    if (!url || !serviceKey) return null;
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  } catch {
    return null;
  }
}

function remember(record: FeedbackRecord) {
  memoryFeedback.unshift(record);
  if (memoryFeedback.length > 500) memoryFeedback.length = 500;
}

function memoryStats() {
  return {
    totalCount: memoryFeedback.length,
    recentCount: Math.min(memoryFeedback.length, 10),
  };
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = FeedbackSchema.safeParse(body.body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid feedback submission', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const ipLimit = rateLimit(`feedback:post:ip:${clientIp(request)}`, POST_LIMIT, RATE_WINDOW_MS);
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

  if (parsed.data.clientId) {
    const clientLimit = rateLimit(
      `feedback:post:client:${parsed.data.clientId}`,
      POST_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!clientLimit.allowed) return tooManyRequests(clientLimit.retryAfterSeconds);
  }

  const { category, comment, email, clientId, metadata } = parsed.data;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const record: FeedbackRecord = {
    id,
    category,
    comment,
    email,
    clientId,
    metadata: metadata ?? {},
    createdAt,
  };

  const success = {
    success: true,
    id,
    message: 'Feedback received successfully. Thank you for helping improve NeuBench!',
  };

  const supabase = getAdminClient();
  if (!supabase) {
    remember(record);
    return jsonNoStore(success);
  }

  try {
    const baseRow = {
      id,
      category,
      comment,
      client_id: clientId ?? null,
      metadata: metadata ?? {},
      created_at: createdAt,
    };

    // The email column arrives with migration 013. Until it is applied, fall
    // back to the JSONB metadata bag so no reply address is silently dropped.
    const row = email ? { ...baseRow, email } : baseRow;

    const { data, error } = await supabase
      .from('feedback_submissions')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      if (isMissingSchemaError(error)) {
        remember(record);
        return jsonNoStore(success);
      }
      if (email && isMissingColumnError(error, 'email')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('feedback_submissions')
          .insert({ ...baseRow, metadata: { ...(metadata ?? {}), email } })
          .select('id')
          .single();

        if (!fallbackError) {
          return jsonNoStore({ ...success, id: fallbackData?.id ?? id });
        }
        console.error('Failed to store feedback:', fallbackError);
        return jsonNoStore(
          { error: 'Failed to process feedback submission.' },
          { status: 500 },
        );
      }
      console.error('Failed to store feedback:', error);
      return jsonNoStore(
        { error: 'Failed to process feedback submission.' },
        { status: 500 },
      );
    }

    return jsonNoStore({ ...success, id: data?.id ?? id });
  } catch (err) {
    console.error('Feedback POST error:', err);
    return jsonNoStore(
      { error: 'Failed to process feedback submission.' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(`feedback:get:${clientIp(request)}`, GET_LIMIT, RATE_WINDOW_MS);
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

  const supabase = getAdminClient();
  if (!supabase) return jsonNoStore(memoryStats());

  try {
    const { count, error } = await supabase
      .from('feedback_submissions')
      .select('id', { count: 'exact', head: true });

    if (error) {
      if (isMissingSchemaError(error)) return jsonNoStore(memoryStats());
      console.error('Failed to read feedback stats:', error);
      return jsonNoStore({ error: 'Failed to load feedback stats' }, { status: 500 });
    }

    const totalCount = count ?? 0;
    return jsonNoStore({ totalCount, recentCount: Math.min(totalCount, 10) });
  } catch (err) {
    console.error('Feedback GET error:', err);
    return jsonNoStore({ error: 'Failed to load feedback stats' }, { status: 500 });
  }
}
