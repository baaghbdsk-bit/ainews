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

export interface FreshnessAuditSummary extends CatalogueAudit {
  /** Whole days between the catalogue snapshot and today. */
  catalogueAgeDays: number;
  /** True once the catalogue is older than the staleness budget. */
  stale: boolean;
}

export interface BenchmarkCoverage {
  benchmarkId: string;
  name: string;
  scoreCount: number;
  modelCount: number;
  coveragePercent: number;
}

/**
 * Catalogue coverage, derived entirely from the data. Deterministic, so it is
 * safe to call during a client render.
 */
export interface CatalogueAudit {
  totalModels: number;
  scoredModelCount: number;
  unscoredModelCount: number;
  currentGenCount: number;
  previousGenCount: number;
  openWeightsCount: number;
  totalBenchmarkScores: number;
  officialEvaluationCount: number;
  independentEvaluationCount: number;
  benchmarkCoverage: Record<string, BenchmarkCoverage>;
  sourceHostCoverage: Record<string, number>;
  uniqueSourceUrlCount: number;
  /** Snapshot date recorded in the catalogue file. A claim, not a measurement. */
  lastAuditedDate: string;
  /**
   * Release date of the newest model the catalogue contains. This is the
   * honest freshness signal: it is derived from the data, so it cannot go
   * stale without the data itself changing.
   */
  newestModelReleaseDate: string;
  coveredProviders: string[];
}

/** How long a model stays in the "current" generation after release. */
export const CURRENT_GENERATION_DAYS = 180;

/** How old the catalogue may get before the audit reports it as stale. */
export const CATALOGUE_STALENESS_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/**
 * The instant the catalogue snapshot was taken, taken from the data itself.
 *
 * Used as the reference point for the generation split so the result is
 * derived from the data rather than frozen per model, and so client and
 * server renders agree. Using `Date.now()` here would make the value differ
 * between the server render and hydration, and would make the page
 * unprerenderable.
 */
export function catalogueAsOf(): string {
  return (
    AI_MODELS_DATA.map((m) => m.lastAuditedDate).sort((a, b) => b.localeCompare(a))[0] ?? 'unknown'
  );
}

/**
 * Derive a model's generation from its release date, measured against the
 * catalogue's own snapshot instant. A label written per model at snapshot
 * time can only be right on the day it was written; this stays correct and
 * stays deterministic.
 */
export function generationFor(model: AIModelRecord): ModelGeneration {
  const reference = Date.parse(catalogueAsOf());
  const released = Date.parse(model.specs.releaseDate);
  if (!Number.isFinite(released) || !Number.isFinite(reference)) return 'previous';
  const ageDays = (reference - released) / MS_PER_DAY;
  return ageDays <= CURRENT_GENERATION_DAYS ? 'current' : 'previous';
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

  if (!model.officialSourceUrl?.startsWith('https://')) {
    errors.push(`Model ${model.id} lacks a valid HTTPS officialSourceUrl`);
  }

  if (model.officialDocumentationUrl && !model.officialDocumentationUrl.startsWith('https://')) {
    errors.push(`Model ${model.id} has an invalid HTTPS officialDocumentationUrl`);
  }

  if (parseFullDate(model.specs.releaseDate) === null) {
    errors.push(`Model ${model.id} has invalid releaseDate: ${model.specs.releaseDate}`);
  }

  if (parseFullDate(model.lastAuditedDate) === null) {
    errors.push(`Model ${model.id} has invalid lastAuditedDate: ${model.lastAuditedDate}`);
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
    } else {
      if (bm.benchmarkId !== key) {
        errors.push(`Model ${model.id} benchmark ${key} has mismatched benchmarkId: ${bm.benchmarkId}`);
      }
      if (bm.category !== definition.category) {
        errors.push(
          `Model ${model.id} benchmark ${key} category ${bm.category} does not match definition ${definition.category}`
        );
      }
      if (bm.unit !== definition.unit) {
        errors.push(
          `Model ${model.id} benchmark ${key} unit ${bm.unit} does not match definition ${definition.unit}`
        );
      }
    }

    if (typeof bm.score !== 'number' || !Number.isFinite(bm.score)) {
      errors.push(`Model ${model.id} benchmark ${key} has a non-finite score: ${bm.score}`);
    } else if (bm.unit === '%' && (bm.score < 0 || bm.score > 100)) {
      errors.push(`Model ${model.id} benchmark ${key} percentage out of bounds: ${bm.score}`);
    } else if (bm.unit === 'ELO' && (bm.score < 500 || bm.score > 2000)) {
      errors.push(`Model ${model.id} benchmark ${key} ELO score unreasonable: ${bm.score}`);
    }

    if (!bm.sourceUrl?.startsWith('https://')) {
      errors.push(`Model ${model.id} benchmark ${key} lacks valid HTTPS sourceUrl`);
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

  // Filter by generation — derived from the release date, so the split stays
  // correct without regenerating the catalogue.
  if (filter.generation && filter.generation !== 'all') {
    list = list.filter((m) => generationFor(m) === filter.generation);
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
 * Catalogue coverage and score distributions. Derived only from the data, so
 * the result is identical on the server and the client.
 */
export function getCatalogueAudit(): CatalogueAudit {
  let totalBenchmarkScores = 0;
  let officialEvaluationCount = 0;
  let independentEvaluationCount = 0;
  let currentGenCount = 0;
  let previousGenCount = 0;
  let openWeightsCount = 0;
  let newestRelease = 0;
  const scoreCounts = new Map<string, { scoreCount: number; modelIds: Set<string> }>();
  const sourceHosts = new Map<string, number>();
  const sourceUrls = new Set<string>();
  const providersSet = new Set<string>();

  const recordSource = (sourceUrl: string | undefined) => {
    if (!sourceUrl) return;
    sourceUrls.add(sourceUrl);
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
      sourceHosts.set(host, (sourceHosts.get(host) ?? 0) + 1);
    } catch {
      // validateModelRecord reports malformed URLs; keep the audit deterministic.
    }
  };

  for (const model of AI_MODELS_DATA) {
    providersSet.add(model.developer);
    recordSource(model.officialSourceUrl);
    recordSource(model.officialDocumentationUrl);
    if (generationFor(model) === 'current') currentGenCount++;
    else previousGenCount++;
    if (model.specs.isOpenWeights) openWeightsCount++;

    const released = Date.parse(model.specs.releaseDate);
    if (Number.isFinite(released) && released > newestRelease) newestRelease = released;

    for (const score of Object.values(model.benchmarks)) {
      totalBenchmarkScores++;
      if (score.evaluationType === 'Official Report') officialEvaluationCount++;
      if (score.evaluationType === 'Independent Evaluation') independentEvaluationCount++;

      const coverage = scoreCounts.get(score.benchmarkId) ?? { scoreCount: 0, modelIds: new Set<string>() };
      coverage.scoreCount++;
      coverage.modelIds.add(model.id);
      scoreCounts.set(score.benchmarkId, coverage);

      recordSource(score.sourceUrl);
    }
  }

  const benchmarkCoverage = Object.fromEntries(
    Object.entries(BENCHMARK_DEFINITIONS).map(([benchmarkId, definition]) => {
      const coverage = scoreCounts.get(benchmarkId);
      const modelCount = coverage?.modelIds.size ?? 0;
      return [
        benchmarkId,
        {
          benchmarkId,
          name: definition.name,
          scoreCount: coverage?.scoreCount ?? 0,
          modelCount,
          coveragePercent: AI_MODELS_DATA.length
            ? Math.round((modelCount / AI_MODELS_DATA.length) * 1000) / 10
            : 0,
        },
      ];
    })
  );

  return {
    totalModels: AI_MODELS_DATA.length,
    scoredModelCount: AI_MODELS_DATA.filter((m) => Object.keys(m.benchmarks).length > 0).length,
    unscoredModelCount: AI_MODELS_DATA.filter((m) => Object.keys(m.benchmarks).length === 0).length,
    currentGenCount,
    previousGenCount,
    openWeightsCount,
    totalBenchmarkScores,
    officialEvaluationCount,
    independentEvaluationCount,
    benchmarkCoverage,
    sourceHostCoverage: Object.fromEntries(
      [...sourceHosts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    ),
    uniqueSourceUrlCount: sourceUrls.size,
    lastAuditedDate: catalogueAsOf(),
    newestModelReleaseDate: newestRelease
      ? new Date(newestRelease).toISOString().slice(0, 10)
      : 'unknown',
    coveredProviders: Array.from(providersSet),
  };
}

/**
 * Catalogue coverage plus how old the data is.
 *
 * Reads the clock, so it must not be called during a client render: the value
 * would differ between the server render and hydration, and Next.js refuses
 * to prerender a page whose output depends on the current time. Client code
 * should use `getCatalogueAudit()` for the data-derived parts and measure the
 * age after mount.
 */
export function getFreshnessAuditSummary(): FreshnessAuditSummary {
  const audit = getCatalogueAudit();
  const audited = Date.parse(audit.lastAuditedDate);
  const catalogueAgeDays = Number.isFinite(audited)
    ? Math.max(0, Math.floor((Date.now() - audited) / MS_PER_DAY))
    : Number.POSITIVE_INFINITY;

  return {
    ...audit,
    catalogueAgeDays: Number.isFinite(catalogueAgeDays) ? catalogueAgeDays : -1,
    stale: catalogueAgeDays > CATALOGUE_STALENESS_DAYS,
  };
}
