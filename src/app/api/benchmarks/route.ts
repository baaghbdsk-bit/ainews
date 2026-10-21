import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAvailableModels,
  getBenchmarkDefinitions,
  getFreshnessAuditSummary,
  validateModelRecord,
} from '@/lib/benchmarks/service';
import type { ModelCapability, ModelGeneration } from '@/lib/benchmarks/types';
import { zodDetails } from '@/lib/supabase/api-guard';

const GENERATIONS = ['current', 'previous', 'historical-baseline', 'all'] as const;
const CAPABILITIES = [
  'Reasoning',
  'Coding',
  'Multimodal',
  'Mathematics',
  'General',
  'Enterprise',
  'Efficient',
  'all',
] as const;

const BenchmarkQuerySchema = z.object({
  provider: z.string().trim().min(1).max(100).optional(),
  generation: z.enum(GENERATIONS).optional(),
  capability: z.enum(CAPABILITIES).optional(),
  query: z.string().trim().max(200).optional(),
});

function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = BenchmarkQuerySchema.safeParse({
    provider: clean(searchParams.get('provider')),
    generation: clean(searchParams.get('generation')),
    capability: clean(searchParams.get('capability')),
    query: clean(searchParams.get('query')),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid query parameters',
        details: zodDetails(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const models = getAvailableModels({
      provider: parsed.data.provider,
      generation: parsed.data.generation as ModelGeneration | 'all' | undefined,
      capability: parsed.data.capability as ModelCapability | 'all' | undefined,
      query: parsed.data.query,
    });

    const definitions = getBenchmarkDefinitions();
    const audit = getFreshnessAuditSummary();

    return NextResponse.json(
      {
        success: true,
        count: models.length,
        models,
        definitions,
        audit,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Failed to retrieve benchmark data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve benchmark data' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const models = getAvailableModels();
    const validationResults = models.map((m) => ({
      modelId: m.id,
      modelName: m.name,
      ...validateModelRecord(m),
    }));

    const invalidCount = validationResults.filter((r) => !r.valid).length;
    const audit = getFreshnessAuditSummary();

    return NextResponse.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      invalidCount,
      allValid: invalidCount === 0,
      validationResults: invalidCount > 0 ? validationResults.filter((r) => !r.valid) : 'All models valid',
      audit,
    });
  } catch (error) {
    console.error('Failed to audit benchmarks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to audit benchmarks' },
      { status: 500 }
    );
  }
}
