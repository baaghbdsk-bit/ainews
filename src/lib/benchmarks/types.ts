export type BenchmarkCategory =
  | 'Coding'
  | 'Reasoning'
  | 'Mathematics'
  | 'General Knowledge'
  | 'Human Preference'
  | 'Multimodal'
  | 'Agentic';

/**
 * How recently a model shipped. "current" is a rolling window (see
 * `generationFor` in service.ts) rather than a stored label, so a model ages
 * out of it on its own. `historical-baseline` was removed: nothing ever
 * produced it, so the filter always returned an empty set.
 */
export type ModelGeneration = 'current' | 'previous';
export type ModelAvailability = 'Generally Available' | 'Public Preview' | 'Legacy / Deprecated';
export type ModelCapability =
  | 'Reasoning'
  | 'Coding'
  | 'Multimodal'
  | 'Mathematics'
  | 'General'
  | 'Enterprise'
  | 'Efficient';

export interface ModelBenchmarkScore {
  benchmarkId: string;
  name: string;
  category: BenchmarkCategory;
  score: number; // percentage (0-100) or ELO (e.g. 1350)
  displayValue: string;
  unit: '%' | 'ELO';
  evaluationType: 'Official Report' | 'Independent Evaluation';
  evaluator: string; // e.g. "Anthropic Technical Report", "LMSYS Chatbot Arena", "Artificial Analysis"
  evaluationDate: string; // e.g. "2025-02"
  sourceUrl: string;
  methodologyNotes?: string;
  datasetVersion?: string;
  lastVerifiedDate: string;
}

export interface ModelPricing {
  // null = price is unknown or depends on the hosting provider
  inputPerMillion: number | 'Free (Open Weights)' | null;
  outputPerMillion: number | 'Free (Open Weights)' | null;
  unit: string;
  notes?: string;
}

export interface ModelSpecs {
  contextWindowTokens: number;
  displayContext: string;
  generationSpeedTps?: number; // tokens per second
  license: 'Open Weights (Apache 2.0 / MIT / Community)' | 'Proprietary Cloud API';
  isOpenWeights: boolean;
  releaseDate: string; // ISO date e.g. "2025-02-24"
  versionIdentifier: string; // e.g. "claude-3-7-sonnet-20250219"
  /**
   * Generation label captured when the catalogue snapshot was generated.
   * Prefer `generationFor(model)` from service.ts, which derives the label
   * from `releaseDate` at read time so it never goes stale.
   */
  generation: ModelGeneration;
  availability: ModelAvailability;
  capabilities: ModelCapability[];
  architecture?: string;
}

export interface AIModelRecord {
  id: string;
  name: string;
  developer: string;
  developerColor: string; // e.g. "violet", "blue", "cyan", "amber", "emerald", "rose"
  tagline: string;
  specs: ModelSpecs;
  pricing: ModelPricing;
  benchmarks: Record<string, ModelBenchmarkScore>;
  officialSourceUrl: string;
  officialDocumentationUrl?: string;
  lastAuditedDate: string;
  aliases?: string[];
}

export interface BenchmarkDefinition {
  id: string;
  name: string;
  shortName: string;
  category: BenchmarkCategory;
  unit: '%' | 'ELO';
  description: string;
  whatItMeasures: string;
  realWorldSignificance: string;
  limitations: string;
  higherIsBetter: boolean;
}
