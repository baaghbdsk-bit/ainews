import { AI_MODELS_DATA, BENCHMARK_DEFINITIONS } from './data';
import type {
  AIModelRecord,
  BenchmarkDefinition,
  ModelCapability,
  ModelGeneration,
} from './types';

export interface ModelQueryFilter {
  provider?: string;
  generation?: ModelGeneration | 'all';
  capability?: ModelCapability | 'all';
  query?: string;
  isOpenWeights?: boolean;
}

export interface FreshnessAuditSummary {
  totalModels: number;
  currentGenCount: number;
  historicalBaselineCount: number;
  openWeightsCount: number;
  totalBenchmarkScores: number;
  officialEvaluationCount: number;
  independentEvaluationCount: number;
  lastAuditedDate: string;
  coveredProviders: string[];
}

function parseFullDate(value: string): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

function parseEvaluationDate(value: string): number | null {
  if (typeof value !== 'string') return null;
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(value);
  if (monthOnly) {
    const month = Number(monthOnly[2]);
    if (month < 1 || month > 12) return null;
    return Date.UTC(Number(monthOnly[1]), month - 1, 1);
  }
  return parseFullDate(value);
}

function displayNumeric(value: string): number | null {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Validates the factual integrity of an AI Model Record.
 * Ensures valid scores, pricing, provenance dates, and display values.
 */
export function validateModelRecord(model: AIModelRecord): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!model.id || !model.name || !model.developer) {
    errors.push(`Model is missing core identification: ${model.id}`);
  }

  if (!model.officialSourceUrl?.startsWith('http')) {
    errors.push(`Model ${model.id} lacks a valid HTTP officialSourceUrl`);
  }

  if (model.specs.contextWindowTokens <= 0) {
    errors.push(`Model ${model.id} has invalid contextWindowTokens: ${model.specs.contextWindowTokens}`);
  }

  if (!model.pricing) {
    errors.push(`Model ${model.id} is missing pricing`);
  } else {
    for (const field of ['inputPerMillion', 'outputPerMillion'] as const) {
      const value = model.pricing[field];
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          errors.push(`Model ${model.id} pricing.${field} is not a finite number: ${value}`);
        } else if (value < 0) {
          errors.push(`Model ${model.id} pricing.${field} is negative: ${value}`);
        }
      } else if (value !== null && value !== 'Free (Open Weights)') {
        errors.push(`Model ${model.id} pricing.${field} has an unsupported value: ${String(value)}`);
      }
    }
  }

  for (const [key, bm] of Object.entries(model.benchmarks)) {
    const definition = BENCHMARK_DEFINITIONS[key];
    if (!definition) {
      errors.push(`Model ${model.id} benchmark ${key} has no registered benchmark definition`);
    }

    if (typeof bm.score !== 'number' || !Number.isFinite(bm.score)) {
      errors.push(`Model ${model.id} benchmark ${key} has a non-finite score: ${bm.score}`);
    } else if (bm.unit === '%' && (bm.score < 0 || bm.score > 100)) {
      errors.push(`Model ${model.id} benchmark ${key} percentage out of bounds: ${bm.score}`);
    } else if (bm.unit === 'ELO' && (bm.score < 500 || bm.score > 2000)) {
      errors.push(`Model ${model.id} benchmark ${key} ELO score unreasonable: ${bm.score}`);
    }

    if (!bm.sourceUrl?.startsWith('http')) {
      errors.push(`Model ${model.id} benchmark ${key} lacks valid sourceUrl`);
    }

    const evaluationTimestamp = parseEvaluationDate(bm.evaluationDate);
    if (evaluationTimestamp === null) {
      errors.push(`Model ${model.id} benchmark ${key} has invalid evaluationDate: ${bm.evaluationDate}`);
    }

    const verifiedTimestamp = parseFullDate(bm.lastVerifiedDate);
    if (verifiedTimestamp === null) {
      errors.push(`Model ${model.id} benchmark ${key} has invalid lastVerifiedDate: ${bm.lastVerifiedDate}`);
    }

    if (
      evaluationTimestamp !== null &&
      verifiedTimestamp !== null &&
      verifiedTimestamp < evaluationTimestamp
    ) {
      errors.push(
        `Model ${model.id} benchmark ${key} lastVerifiedDate ${bm.lastVerifiedDate} precedes evaluationDate ${bm.evaluationDate}`
      );
    }

    const shownValue = displayNumeric(bm.displayValue);
    if (shownValue === null) {
      errors.push(`Model ${model.id} benchmark ${key} has a non-numeric displayValue: ${bm.displayValue}`);
    } else if (
      typeof bm.score === 'number' &&
      Number.isFinite(bm.score) &&
      Math.abs(shownValue - bm.score) > 0.05
    ) {
      errors.push(
        `Model ${model.id} benchmark ${key} displayValue ${bm.displayValue} does not match score ${bm.score}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Returns available models filtered by query, generation, capability, or provider.
 * Automatically deduplicates aliases and enforces stable ordering.
 */
export function getAvailableModels(filter?: ModelQueryFilter): AIModelRecord[] {
  let list = [...AI_MODELS_DATA];

  // Prevent alias duplicates by tracking seen primary IDs
  const seenIds = new Set<string>();
  list = list.filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });

  if (!filter) return list;

  // Filter by generation
  if (filter.generation && filter.generation !== 'all') {
    list = list.filter((m) => m.specs.generation === filter.generation);
  }

  // Filter by provider/developer
  if (filter.provider && filter.provider !== 'All') {
    if (filter.provider === 'OpenWeights') {
      list = list.filter((m) => m.specs.isOpenWeights);
    } else {
      list = list.filter((m) => m.developer.toLowerCase() === filter.provider?.toLowerCase());
    }
  }

  // Filter by capability
  if (filter.capability && filter.capability !== 'all') {
    list = list.filter((m) => m.specs.capabilities.includes(filter.capability as ModelCapability));
  }

  // Filter by open weights
  if (filter.isOpenWeights !== undefined) {
    list = list.filter((m) => m.specs.isOpenWeights === filter.isOpenWeights);
  }

  // Search query (matches name, developer, architecture, or aliases)
  if (filter.query && filter.query.trim().length > 0) {
    const q = filter.query.trim().toLowerCase();
    list = list.filter((m) => {
      const matchName = m.name.toLowerCase().includes(q);
      const matchDev = m.developer.toLowerCase().includes(q);
      const matchArch = m.specs.architecture?.toLowerCase().includes(q) ?? false;
      const matchAliases = m.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false;
      return matchName || matchDev || matchArch || matchAliases;
    });
  }

  return list;
}

/**
 * Retrieve a specific model by ID or alias
 */
export function getModelById(idOrAlias: string): AIModelRecord | undefined {
  const norm = idOrAlias.toLowerCase().trim();
  return AI_MODELS_DATA.find(
    (m) =>
      m.id.toLowerCase().trim() === norm ||
      m.aliases?.some((alias) => alias.toLowerCase().trim() === norm)
  );
}

/**
 * Returns supported benchmark definitions
 */
export function getBenchmarkDefinitions(): Record<string, BenchmarkDefinition> {
  return BENCHMARK_DEFINITIONS;
}

/**
 * Generates an audit summary of model coverage, score distributions, and freshness.
 */
export function getFreshnessAuditSummary(): FreshnessAuditSummary {
  let totalBenchmarkScores = 0;
  let officialEvaluationCount = 0;
  let independentEvaluationCount = 0;
  let currentGenCount = 0;
  let historicalBaselineCount = 0;
  let openWeightsCount = 0;
  const providersSet = new Set<string>();

  for (const model of AI_MODELS_DATA) {
    providersSet.add(model.developer);
    if (model.specs.generation === 'current') currentGenCount++;
    if (model.specs.generation === 'historical-baseline') historicalBaselineCount++;
    if (model.specs.isOpenWeights) openWeightsCount++;

    for (const score of Object.values(model.benchmarks)) {
      totalBenchmarkScores++;
      if (score.evaluationType === 'Official Report') officialEvaluationCount++;
      if (score.evaluationType === 'Independent Evaluation') independentEvaluationCount++;
    }
  }

  return {
    totalModels: AI_MODELS_DATA.length,
    currentGenCount,
    historicalBaselineCount,
    openWeightsCount,
    totalBenchmarkScores,
    officialEvaluationCount,
    independentEvaluationCount,
    lastAuditedDate:
      AI_MODELS_DATA.map((m) => m.lastAuditedDate).sort((a, b) => b.localeCompare(a))[0] ?? 'unknown',
    coveredProviders: Array.from(providersSet),
  };
}
